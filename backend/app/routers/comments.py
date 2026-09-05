from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.document import Comment
from app.schemas.comment import CommentCreate, CommentResponse
from app.routers.users import get_current_user
from app.models.user import User
from app.services.document_service import DocumentService
import uuid

router = APIRouter()

@router.get("/{document_id}/comments", response_model=list[CommentResponse])
async def get_comments(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all comments for a document."""
    # Check permission
    await DocumentService.get_document(db, document_id, current_user.id)
    
    result = await db.execute(
        select(Comment).where(
            Comment.document_id == document_id,
            Comment.parent_id.is_(None)
        ).order_by(Comment.created_at.desc())
    )
    return result.scalars().all()

@router.post("/{document_id}/comments", response_model=CommentResponse)
async def create_comment(
    document_id: uuid.UUID,
    comment_data: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new comment."""
    # Check permission
    has_permission = await DocumentService.check_permission(
        db, document_id, current_user.id, "commenter"
    )
    if not has_permission:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    comment = Comment(
        document_id=document_id,
        user_id=current_user.id,
        content=comment_data.content,
        selection=comment_data.selection,
        parent_id=comment_data.parent_id,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return comment