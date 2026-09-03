from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID

class CommentBase(BaseModel):
    """Base comment schema."""
    content: str = Field(..., min_length=1, max_length=10000)
    selection: Optional[Dict[str, Any]] = Field(
        None,
        description="Text selection range {start: 0, end: 10}"
    )
    parent_id: Optional[UUID] = Field(
        None,
        description="Parent comment ID for threaded replies"
    )

class CommentCreate(CommentBase):
    """Schema for creating a new comment."""
    pass

class CommentUpdate(BaseModel):
    """Schema for updating a comment."""
    content: Optional[str] = Field(None, min_length=1, max_length=10000)
    resolved: Optional[bool] = None

class CommentResponse(CommentBase):
    """Schema for comment response."""
    id: UUID
    document_id: UUID
    user_id: UUID
    username: str
    user_avatar: Optional[str] = None
    resolved: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None
    replies: List['CommentResponse'] = []
    reply_count: int = 0
    
    class Config:
        from_attributes = True

class CommentWithReplies(CommentResponse):
    """Comment with nested replies."""
    replies: List['CommentResponse'] = []

# Handle forward references
CommentResponse.model_rebuild()
CommentWithReplies.model_rebuild()

class CommentResolveRequest(BaseModel):
    """Schema for resolving/unresolving a comment."""
    resolved: bool = True

class CommentSearchParams(BaseModel):
    """Schema for searching comments."""
    document_id: Optional[UUID] = None
    user_id: Optional[UUID] = None
    resolved: Optional[bool] = None
    search: Optional[str] = Field(None, description="Search in comment content")
    limit: int = Field(50, ge=1, le=100)
    offset: int = Field(0, ge=0)

class CommentStats(BaseModel):
    """Comment statistics for a document."""
    total: int
    resolved: int
    unresolved: int
    by_user: Dict[str, int]  # user_id -> count
    recent_activity: List[CommentResponse]