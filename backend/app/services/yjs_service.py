from pycrdt import Doc, Text, Array, Map
import base64
import json
from typing import Dict, Optional, Tuple, Any
from app.redis_client import redis_client
from app.database import AsyncSessionLocal
from app.models.document import Document
from sqlalchemy import select
import asyncio

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
        if doc_id not in self.documents:
            ydoc = await self._load_from_redis(doc_id)
            if not ydoc:
                ydoc = Doc()
                text = ydoc.get("content", type=Text)
                text.insert(0, "")
                await self._save_to_redis(doc_id, ydoc)
            
            self.documents[doc_id] = ydoc
            self.versions[doc_id] = 0
        
        return self.documents[doc_id]
    
    async def apply_update(self, doc_id: str, update_base64: str) -> Tuple[Doc, int]:
        async with self.get_document_lock(doc_id):
            ydoc = await self.get_or_create_document(doc_id)
            
            try:
                update_bytes = base64.b64decode(update_base64)
                ydoc.apply_update(update_bytes)
                
                version = self.versions.get(doc_id, 0) + 1
                self.versions[doc_id] = version
                
                text = ydoc.get("content", type=Text)
                content = str(text)
                
                await self._save_to_redis(doc_id, ydoc)
                
                if version % 10 == 0:
                    await self._save_snapshot_to_db(doc_id, ydoc, content)
                
                return ydoc, version
                
            except Exception as e:
                raise Exception(f"Failed to apply update: {str(e)}")
    
    async def get_document_state(self, doc_id: str) -> Dict:
        ydoc = await self.get_or_create_document(doc_id)
        text = ydoc.get("content", type=Text)
        
        return {
            "content": str(text),
            "version": self.versions.get(doc_id, 0),
            "document_id": doc_id
        }
    
    async def get_snapshot(self, doc_id: str) -> str:
        ydoc = await self.get_or_create_document(doc_id)
        # Try to get snapshot using available method
        snapshot = self._get_doc_snapshot(ydoc)
        return base64.b64encode(snapshot).decode()
    
    def _get_doc_snapshot(self, ydoc: Doc) -> bytes:
        """Get snapshot from document using available method."""
        # Try different methods
        if hasattr(ydoc, 'get_snapshot'):
            return ydoc.get_snapshot()
        elif hasattr(ydoc, 'to_snapshot'):
            return ydoc.to_snapshot()
        elif hasattr(ydoc, 'snapshot'):
            return ydoc.snapshot()
        elif hasattr(ydoc, 'encode_state'):
            return ydoc.encode_state()
        elif hasattr(ydoc, 'state'):
            return ydoc.state()
        else:
            # Fallback: use update() for full state
            return ydoc.update()
    
    async def get_content(self, doc_id: str) -> str:
        ydoc = await self.get_or_create_document(doc_id)
        text = ydoc.get("content", type=Text)
        return str(text)
    
    async def update_content(self, doc_id: str, content: str) -> Tuple[Doc, int]:
        async with self.get_document_lock(doc_id):
            ydoc = await self.get_or_create_document(doc_id)
            
            text = ydoc.get("content", type=Text)
            
            # Clear and set new content
            current_len = len(str(text))
            if current_len > 0:
                # Use slice assignment to clear
                text[0:current_len] = ""
            text.insert(0, content)
            
            version = self.versions.get(doc_id, 0) + 1
            self.versions[doc_id] = version
            
            await self._save_to_redis(doc_id, ydoc)
            await self._save_snapshot_to_db(doc_id, ydoc, content)
            
            return ydoc, version
    
    async def _load_from_redis(self, doc_id: str) -> Optional[Doc]:
        try:
            data = await redis_client.get(f"yjs_doc:{doc_id}")
            if data:
                ydoc = Doc()
                update_bytes = base64.b64decode(data)
                ydoc.apply_update(update_bytes)
                return ydoc
        except Exception as e:
            print(f"Error loading from Redis: {e}")
        return None
    
    async def _save_to_redis(self, doc_id: str, ydoc: Doc):
        try:
            snapshot = self._get_doc_snapshot(ydoc)
            data = base64.b64encode(snapshot).decode()
            await redis_client.setex(f"yjs_doc:{doc_id}", 3600, data)
        except Exception as e:
            print(f"Error saving to Redis: {e}")
    
    async def _save_snapshot_to_db(self, doc_id: str, ydoc: Doc, content: str):
        try:
            snapshot = self._get_doc_snapshot(ydoc)
            snapshot_base64 = base64.b64encode(snapshot).decode()
            
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(Document).where(Document.id == doc_id)
                )
                document = result.scalar_one_or_none()
                
                if document:
                    document.content = json.dumps({
                        "snapshot": snapshot_base64,
                        "content": content,
                        "version": self.versions.get(doc_id, 0)
                    })
                    document.version = self.versions.get(doc_id, 0)
                    await db.commit()
        except Exception as e:
            print(f"Failed to save snapshot to DB: {e}")
    
    async def load_from_db(self, doc_id: str, content: Optional[str] = None) -> Optional[Doc]:
        if content:
            try:
                data = json.loads(content)
                snapshot_base64 = data.get("snapshot")
                if snapshot_base64:
                    ydoc = Doc()
                    update_bytes = base64.b64decode(snapshot_base64)
                    ydoc.apply_update(update_bytes)
                    
                    self.documents[doc_id] = ydoc
                    self.versions[doc_id] = data.get("version", 0)
                    
                    return ydoc
            except Exception as e:
                print(f"Error loading from DB: {e}")
        return None
    
    async def get_version(self, doc_id: str) -> int:
        return self.versions.get(doc_id, 0)
    
    async def delete_document(self, doc_id: str):
        if doc_id in self.documents:
            del self.documents[doc_id]
        if doc_id in self.versions:
            del self.versions[doc_id]
        if doc_id in self.locks:
            del self.locks[doc_id]
        
        await redis_client.delete(f"yjs_doc:{doc_id}")

yjs_service = YjsService()