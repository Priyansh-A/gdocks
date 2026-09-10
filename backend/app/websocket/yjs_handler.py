import base64
import logging
from typing import Dict, List

from fastapi import WebSocket
from pycrdt import Doc

from app.core.security import decode_token
from app.core.session_store import check_version
from app.database import AsyncSessionLocal
from app.models.document import Document
from app.services.document_service import DocumentService
from app.services.yjs_service import yjs_service

logger = logging.getLogger(__name__)


def encode_var_uint(value: int) -> bytes:
    result = bytearray()
    while value >= 128:
        result.append((value & 0b01111111) | 0b10000000)
        value >>= 7
    result.append(value)
    return bytes(result)


def decode_var_uint(buf: memoryview, offset: int):
    value = 0
    shift = 0
    i = offset
    n = len(buf)
    if i >= n:
        raise ValueError("Truncated varuint")
    while True:
        byte = buf[i]
        value |= (byte & 0b01111111) << shift
        i += 1
        if i > n:
            raise ValueError("Truncated varuint")
        if byte & 0b10000000 == 0:
            break
        shift += 7
    return value, i


def encode_var_uint8_array(data: bytes) -> bytes:
    return encode_var_uint(len(data)) + data


def decode_var_uint8_array(buf: memoryview, offset: int):
    length, i = decode_var_uint(buf, offset)
    end = i + length
    if end > len(buf):
        raise ValueError("Truncated varuint8array")
    return bytes(buf[i:end]), end


class YjsWebSocketHandler:
    """Server-side implementation of the y-websocket protocol.

    Mirrors y-protocols wire format:
        outer varuint message type:
            0 = sync message (inner varuint: 0 step1, 1 step2, 2 update)
            1 = awareness update
            2 = auth message

    Updates are idempotent in Yjs, so forwarding a received update verbatim to
    other clients is safe: each client merges it with its own state.
    """

    MSG_SYNC = 0
    MSG_AWARENESS = 1
    MSG_AUTH = 2

    SYNC_STEP1 = 0
    SYNC_STEP2 = 1
    SYNC_UPDATE = 2

    def __init__(self):
        self.rooms: Dict[str, List[WebSocket]] = {}

    async def handle_connection(self, websocket: WebSocket, document_id: str, token: str):
        try:
            payload = decode_token(token)
            user_id = payload.get("sub")
            if not user_id:
                await websocket.close(code=4001, reason="Invalid token")
                return
            if payload.get("type") != "access" or not await check_version(str(user_id), payload.get("ver")):
                await websocket.close(code=4001, reason="Session revoked")
                return
        except ValueError:
            await websocket.close(code=4001, reason="Invalid token")
            return

        async with AsyncSessionLocal() as db:
            has_permission = await DocumentService.check_permission(
                db, document_id, user_id, "viewer"
            )
            if not has_permission:
                await websocket.close(code=4003, reason="Permission denied")
                return

            result = await db.execute(
                Document.__table__.select().where(Document.id == document_id)
            )
            row = result.scalar_one_or_none()
            content = row.content if row else None

        await websocket.accept()

        # Ensure the shared Yjs document exists, loading persisted state when available.
        if document_id in yjs_service.documents:
            ydoc = yjs_service.documents[document_id]
        elif content:
            ydoc = await yjs_service.load_from_db(document_id, content)
            if not ydoc:
                ydoc = await yjs_service.get_or_create_document(document_id)
        else:
            ydoc = await yjs_service.get_or_create_document(document_id)

        room = self.rooms.setdefault(document_id, [])
        room.append(websocket)

        try:
            while True:
                data = await websocket.receive_bytes()
                await self._process(data, websocket, document_id, ydoc)
        except Exception:
            pass
        finally:
            if websocket in room:
                room.remove(websocket)
            if not room:
                self.rooms.pop(document_id, None)

    async def _process(self, data: bytes, websocket: WebSocket, document_id: str, ydoc: Doc):
        buf = memoryview(data)
        outer_type, offset = decode_var_uint(buf, 0)

        if outer_type == self.MSG_SYNC:
            await self._handle_sync(buf, offset, websocket, document_id, ydoc)
        elif outer_type == self.MSG_AWARENESS:
            awareness_update, _ = decode_var_uint8_array(buf, offset)
            payload = (
                encode_var_uint(self.MSG_AWARENESS)
                + encode_var_uint8_array(awareness_update)
            )
            await self._broadcast_bytes(document_id, websocket, payload)
        elif outer_type == self.MSG_AUTH:
            token_bytes, _ = decode_var_uint8_array(buf, offset)
            await websocket.send_bytes(
                encode_var_uint(self.MSG_AUTH)
                + encode_var_uint8_array(b"permission-granted")
            )

    async def _handle_sync(self, buf: memoryview, offset: int, websocket: WebSocket,
                           document_id: str, ydoc: Doc):
        sync_type, i = decode_var_uint(buf, offset)

        if sync_type == self.SYNC_STEP1:
            state_vector, _ = decode_var_uint8_array(buf, i)
            # A full update applied from an empty doc is always a safe superset;
            # Yjs merges it idempotently with whatever the client already holds.
            update = ydoc.get_update()
            response = (
                encode_var_uint(self.MSG_SYNC)
                + encode_var_uint(self.SYNC_STEP2)
                + encode_var_uint8_array(update)
            )
            await websocket.send_bytes(response)

        elif sync_type in (self.SYNC_STEP2, self.SYNC_UPDATE):
            update, _ = decode_var_uint8_array(buf, i)
            await yjs_service.apply_update(
                document_id, base64.b64encode(update).decode()
            )
            payload = (
                encode_var_uint(self.MSG_SYNC)
                + encode_var_uint(self.SYNC_STEP2)
                + encode_var_uint8_array(update)
            )
            await self._broadcast_bytes(document_id, websocket, payload)

    async def _broadcast_bytes(self, document_id: str, sender: WebSocket, payload: bytes):
        for conn in self.rooms.get(document_id, []):
            if conn is not sender:
                try:
                    await conn.send_bytes(payload)
                except Exception:
                    pass


yjs_ws_handler = YjsWebSocketHandler()