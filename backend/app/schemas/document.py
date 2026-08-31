from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid

class DocumentBase(BaseModel):
    title: str = "Untitled Document"

class DocumentCreate(DocumentBase):
    pass

class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None

class DocumentResponse(DocumentBase):
    id: uuid.UUID
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