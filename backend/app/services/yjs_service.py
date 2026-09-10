from pycrdt import Doc, XmlFragment
import base64
import json
import logging
from typing import Dict, Optional, Tuple
from app.redis_client import redis_client
from app.database import AsyncSessionLocal
from app.models.document import Document
from sqlalchemy import select
import asyncio

logger = logging.getLogger(__name__)


class YjsService:
    def __init__(self):
        self.documents: Dict[str, Doc] = {}
        self.locks: Dict[str, asyncio.Lock] = {}
        self.versions: Dict[str, int] = {}

    def get_document_lock(self, doc_id: str) -> asyncio.Lock:
        if doc_id not in self.locks:
            self.locks[doc_id] = asyncio.Lock()
        return self.locks[doc_id]

    async def get_or_create_document(self, doc_id: str) -> Doc:
        """Get a Yjs document from cache or create one."""
        if doc_id not in self.documents:
            ydoc = await self._load_from_redis(doc_id)
            if not ydoc:
                ydoc = Doc()
                self.documents[doc_id] = ydoc
                self.versions[doc_id] = 0
                await self._save_to_redis(doc_id, ydoc)
            else:
                self.documents[doc_id] = ydoc
                self.versions.setdefault(doc_id, 0)
        return self.documents[doc_id]

    async def apply_update(self, doc_id: str, update_base64: str) -> Tuple[Doc, int]:
        """Apply a Yjs update to a document."""
        async with self.get_document_lock(doc_id):
            ydoc = await self.get_or_create_document(doc_id)

            try:
                update_bytes = base64.b64decode(update_base64)
                ydoc.apply_update(update_bytes)

                version = self.versions.get(doc_id, 0) + 1
                self.versions[doc_id] = version

                await self._save_to_redis(doc_id, ydoc)

                if version % 10 == 0:
                    await self._save_snapshot_to_db(doc_id, ydoc)

                return ydoc, version

            except Exception as e:
                logger.error("Failed to apply update for %s: %s", doc_id, e)
                raise Exception(f"Failed to apply update: {str(e)}")

    async def get_document_state(self, doc_id: str) -> Dict:
        """Get current document state."""
        ydoc = await self.get_or_create_document(doc_id)
        fragment = ydoc.get("content", type=XmlFragment)

        return {
            "content": fragment.to_py() if hasattr(fragment, "to_py") else "",
            "version": self.versions.get(doc_id, 0),
            "document_id": doc_id,
        }

    async def get_snapshot(self, doc_id: str) -> str:
        """Get a snapshot of the document for database storage."""
        ydoc = await self.get_or_create_document(doc_id)
        snapshot = ydoc.get_update()
        return base64.b64encode(snapshot).decode()

    async def get_content(self, doc_id: str) -> str:
        """Get the current document state as a base64 update."""
        ydoc = await self.get_or_create_document(doc_id)
        return base64.b64encode(ydoc.get_update()).decode()

    async def update_content(self, doc_id: str, content: str) -> Tuple[Doc, int]:
        """Replace document state entirely from a base64 Yjs update."""
        async with self.get_document_lock(doc_id):
            ydoc = await self.get_or_create_document(doc_id)

            try:
                new_doc = Doc()
                new_doc.apply_update(base64.b64decode(content))
                self.documents[doc_id] = new_doc
            except Exception:
                pass

            version = self.versions.get(doc_id, 0) + 1
            self.versions[doc_id] = version

            await self._save_to_redis(doc_id, self.documents[doc_id])
            await self._save_snapshot_to_db(doc_id, self.documents[doc_id])

            return self.documents[doc_id], version

    async def _load_from_redis(self, doc_id: str) -> Optional[Doc]:
        """Load document state from Redis."""
        try:
            data = await redis_client.get(f"yjs_doc:{doc_id}")
            if data:
                ydoc = Doc()
                update_bytes = base64.b64decode(data)
                ydoc.apply_update(update_bytes)
                return ydoc
        except Exception as e:
            logger.error("Error loading from Redis: %s", e)
        return None

    async def _save_to_redis(self, doc_id: str, ydoc: Doc):
        """Save document state to Redis."""
        try:
            update = ydoc.get_update()
            data = base64.b64encode(update).decode()
            await redis_client.setex(f"yjs_doc:{doc_id}", 3600, data)
        except Exception as e:
            logger.error("Error saving to Redis: %s", e)

    async def _save_snapshot_to_db(self, doc_id: str, ydoc: Doc):
        """Save snapshot to PostgreSQL for persistence."""
        try:
            snapshot = ydoc.get_update()
            snapshot_base64 = base64.b64encode(snapshot).decode()

            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(Document).where(Document.id == doc_id)
                )
                document = result.scalar_one_or_none()

                if document:
                    document.content = json.dumps({
                        "snapshot": snapshot_base64,
                        "version": self.versions.get(doc_id, 0),
                    })
                    document.version = self.versions.get(doc_id, 0)
                    await db.commit()
        except Exception as e:
            logger.error("Failed to save snapshot to DB: %s", e)

    async def load_from_db(self, doc_id: str, content: Optional[str] = None) -> Optional[Doc]:
        """Load document from database snapshot."""
        if not content:
            return None
        try:
            data = json.loads(content)
            snapshot_base64 = data.get("snapshot")
            if not snapshot_base64:
                return None
            ydoc = Doc()
            update_bytes = base64.b64decode(snapshot_base64)
            ydoc.apply_update(update_bytes)

            # The shared content type must be an XmlFragment for the TipTap
            # collaboration extension. Legacy snapshots used a Text type, which
            # is incompatible; treat those as new documents.
            try:
                ydoc.get("content", type=XmlFragment)
            except Exception:
                return None

            self.documents[doc_id] = ydoc
            self.versions[doc_id] = data.get("version", 0)
            return ydoc
        except Exception as e:
            logger.error("Error loading from DB: %s", e)
        return None

    async def get_version(self, doc_id: str) -> int:
        return self.versions.get(doc_id, 0)


yjs_service = YjsService()