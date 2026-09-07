from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid
from enum import Enum

class DocumentType(str, Enum):
    DOCUMENT = "document"
    PDF = "pdf"
    MEDIA = "media"

class DocumentBase(BaseModel):
    title: str = "Untitled Document"
    document_type: DocumentType = DocumentType.DOCUMENT

class DocumentCreate(DocumentBase):
    content: Optional[str] = None
    file_url: Optional[str] = None
    file_metadata: Optional[Dict[str, Any]] = None

class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    file_url: Optional[str] = None
    file_metadata: Optional[Dict[str, Any]] = None
    is_archived: Optional[bool] = None

class DocumentResponse(DocumentBase):
    id: uuid.UUID
    content: Optional[str] = None
    file_url: Optional[str] = None
    file_metadata: Optional[Dict[str, Any]] = None
    version: int
    owner_id: uuid.UUID
    is_archived: bool
    last_edited_at: datetime
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class PermissionBase(BaseModel):
    role: str = Field(..., pattern="^(owner|editor|viewer|commenter)$")

class PermissionCreate(PermissionBase):
    user_id: uuid.UUID

class PermissionResponse(PermissionBase):
    id: uuid.UUID
    document_id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    
    class Config:
        from_attributes = True

class DocumentWithPermissions(DocumentResponse):
    permissions: List[PermissionResponse] = []
    is_owner: bool = False
    user_role: Optional[str] = None