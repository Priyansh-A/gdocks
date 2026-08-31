from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
import uuid

class MediaBase(BaseModel):
    file_name: str
    mime_type: str
    file_size: int

class MediaCreate(MediaBase):
    storage_url: str
    public_id: str
    thumbnail_url: Optional[str] = None
    meta_data: Optional[Dict[str, Any]] = None

class MediaResponse(MediaBase):
    id: uuid.UUID
    document_id: uuid.UUID
    uploaded_by: Optional[uuid.UUID]
    storage_url: str
    thumbnail_url: Optional[str]
    public_id: str
    meta_data: Optional[Dict[str, Any]]
    created_at: datetime
    
    class Config:
        from_attributes = True