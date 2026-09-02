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
        # In-memory cache of Yjs documents
        self.documents: Dict[str, Doc] = {}
        # Document lock for concurrent updates
        self.locks: Dict[str, asyncio.Lock] = {}
        # Track document versions
        self.versions: Dict[str, int] = {}
    
    def get_document_lock(self, doc_id: str) -> asyncio.Lock:
        """Get or create a lock for a document."""
        if doc_id not in self.locks:
            self.locks[doc_id] = asyncio.Lock()
        return self.locks[doc_id]
    
    async def get_or_create_document(self, doc_id: str) -> Doc:
        """Get a Yjs document from cache or create one."""
        if doc_id not in self.documents:
            # Try to load from Redis
            ydoc = await self._load_from_redis(doc_id)
            if not ydoc:
                # Create new document
                ydoc = Doc()
                # Initialize with empty content
                text = ydoc.get("content", type=Text)
                text.insert(0, "")
                # Save to Redis
                await self._save_to_redis(doc_id, ydoc)
            
            self.documents[doc_id] = ydoc
            self.versions[doc_id] = ydoc.state.get("content", {}).get("version", 0)
        
        return self.documents[doc_id]
    
    async def apply_update(self, doc_id: str, update_base64: str) -> Tuple[Doc, int]:
        """Apply a Yjs update to a document."""
        async with self.get_document_lock(doc_id):
            ydoc = await self.get_or_create_document(doc_id)
            
            try:
                # Decode and apply update
                update_bytes = base64.b64decode(update_base64)
                ydoc.apply_update(update_bytes)
                
                # Get current version
                version = self.versions.get(doc_id, 0) + 1
                self.versions[doc_id] = version
                
                # Get the text content
                text = ydoc.get("content", type=Text)
                content = text.to_string()
                
                # Save to Redis
                await self._save_to_redis(doc_id, ydoc)
                
                # Save snapshot to PostgreSQL (every 10 updates)
                if version % 10 == 0:
                    await self._save_snapshot_to_db(doc_id, ydoc, content)
                
                return ydoc, version
                
            except Exception as e:
                raise Exception(f"Failed to apply update: {str(e)}")
    
    async def get_document_state(self, doc_id: str) -> Dict:
        """Get current document state."""
        ydoc = await self.get_or_create_document(doc_id)
        text = ydoc.get("content", type=Text)
        
        return {
            "content": text.to_string(),
            "version": self.versions.get(doc_id, 0),
            "document_id": doc_id
        }
    
    async def get_snapshot(self, doc_id: str) -> str:
        """Get a snapshot of the document for database storage."""
        ydoc = await self.get_or_create_document(doc_id)
        snapshot = ydoc.get_snapshot()
        return base64.b64encode(snapshot).decode()
    
    async def get_content(self, doc_id: str) -> str:
        """Get the current text content."""
        ydoc = await self.get_or_create_document(doc_id)
        text = ydoc.get("content", type=Text)
        return text.to_string()
    
    async def update_content(self, doc_id: str, content: str) -> Tuple[Doc, int]:
        """Update the entire document content."""
        async with self.get_document_lock(doc_id):
            ydoc = await self.get_or_create_document(doc_id)
            
            # Get existing text
            text = ydoc.get("content", type=Text)
            
            # Clear and set new content
            # Note: In production, you'd use incremental updates
            # For now, we'll replace the entire content
            text.delete(0, len(text.to_string()))
            text.insert(0, content)
            
            version = self.versions.get(doc_id, 0) + 1
            self.versions[doc_id] = version
            
            # Save to Redis
            await self._save_to_redis(doc_id, ydoc)
            
            # Save to DB
            await self._save_snapshot_to_db(doc_id, ydoc, content)
            
            return ydoc, version
    
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
            print(f"Error loading from Redis: {e}")
        return None
    
    async def _save_to_redis(self, doc_id: str, ydoc: Doc):
        """Save document state to Redis."""
        try:
            # Get current state as update
            update = ydoc.get_snapshot()
            data = base64.b64encode(update).decode()
            # Cache for 1 hour
            await redis_client.setex(f"yjs_doc:{doc_id}", 3600, data)
        except Exception as e:
            print(f"Error saving to Redis: {e}")
    
    async def _save_snapshot_to_db(self, doc_id: str, ydoc: Doc, content: str):
        """Save snapshot to PostgreSQL for persistence."""
        try:
            snapshot = ydoc.get_snapshot()
            snapshot_base64 = base64.b64encode(snapshot).decode()
            
            async with AsyncSessionLocal() as db:
                # Get current document
                result = await db.execute(
                    select(Document).where(Document.id == doc_id)
                )
                document = result.scalar_one_or_none()
                
                if document:
                    # Update document content
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
        """Load document from database snapshot."""
        if content:
            try:
                data = json.loads(content)
                snapshot_base64 = data.get("snapshot")
                if snapshot_base64:
                    ydoc = Doc()
                    update_bytes = base64.b64decode(snapshot_base64)
                    ydoc.apply_update(update_bytes)
                    
                    # Store in memory
                    self.documents[doc_id] = ydoc
                    self.versions[doc_id] = data.get("version", 0)
                    
                    return ydoc
            except Exception as e:
                print(f"Error loading from DB: {e}")
        return None
    
    async def get_version(self, doc_id: str) -> int:
        """Get the current version of a document."""
        return self.versions.get(doc_id, 0)

yjs_service = YjsService()