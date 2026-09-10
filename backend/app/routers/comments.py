from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.comment import Comment
from app.models.user import User
from app.schemas.comment import CommentCreate, CommentResponse, CommentUpdate
from app.routers.users import get_current_user
from app.services.document_service import DocumentService
from app.core.exceptions import PermissionDenied
import uuid

router = APIRouter()


def _comment_to_response(comment: Comment) -> CommentResponse:
    username = comment.user.username if comment.user else "Unknown"
    user_avatar = comment.user.avatar_url if comment.user else None
    replies = [_comment_to_response(r) for r in (comment.replies or [])]
    return CommentResponse(
        id=comment.id,
        document_id=comment.document_id,
        user_id=comment.user_id,
        content=comment.content,
        selection=comment.selection,
        parent_id=comment.parent_id,
        username=username,
        user_avatar=user_avatar,
        resolved=comment.resolved or False,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
        replies=replies,
        reply_count=len(replies),
    )


@router.get("/{document_id}/comments", response_model=list[CommentResponse])
async def get_comments(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all comments for a document."""
    await DocumentService.get_document(db, document_id, current_user.id)

    result = await db.execute(
        select(Comment)
        .where(
            Comment.document_id == document_id,
            Comment.parent_id.is_(None),
        )
        .options(selectinload(Comment.user), selectinload(Comment.replies).selectinload(Comment.user))
        .order_by(Comment.created_at.desc())
    )
    comments = result.scalars().unique().all()
    return [_comment_to_response(c) for c in comments]


@router.post("/{document_id}/comments", response_model=CommentResponse)
async def create_comment(
    document_id: uuid.UUID,
    comment_data: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new comment."""
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

    result = await db.execute(
        select(Comment)
        .where(Comment.id == comment.id)
        .options(selectinload(Comment.user))
    )
    comment = result.scalar_one()
    return _comment_to_response(comment)


@router.put("/{document_id}/comments/{comment_id}", response_model=CommentResponse)
async def update_comment(
    document_id: uuid.UUID,
    comment_id: uuid.UUID,
    comment_data: CommentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a comment (content, or resolve/unresolve)."""
    await DocumentService.get_document(db, document_id, current_user.id)

    result = await db.execute(
        select(Comment).where(
            Comment.id == comment_id,
            Comment.document_id == document_id,
        )
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    is_owner = current_user.id == comment.user_id
    is_editor = await DocumentService.check_permission(db, document_id, current_user.id, "editor")

    if comment_data.content is not None:
        if not is_owner:
            raise HTTPException(status_code=403, detail="Only the author can edit the comment")
        comment.content = comment_data.content

    if comment_data.resolved is not None:
        if not (is_owner or is_editor):
            raise HTTPException(status_code=403, detail="Permission denied")
        comment.resolved = comment_data.resolved
        from datetime import datetime
        comment.resolved_at = datetime.utcnow() if comment_data.resolved else None
        comment.resolved_by = current_user.id if comment_data.resolved else None

    await db.commit()

    result = await db.execute(
        select(Comment)
        .where(Comment.id == comment.id)
        .options(selectinload(Comment.user))
    )
    comment = result.scalar_one()
    return _comment_to_response(comment)


@router.delete("/{document_id}/comments/{comment_id}", status_code=204)
async def delete_comment(
    document_id: uuid.UUID,
    comment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a comment (author or editor+ only)."""
    await DocumentService.get_document(db, document_id, current_user.id)

    result = await db.execute(
        select(Comment).where(
            Comment.id == comment_id,
            Comment.document_id == document_id,
        )
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    is_owner = current_user.id == comment.user_id
    is_editor = await DocumentService.check_permission(db, document_id, current_user.id, "editor")
    if not (is_owner or is_editor):
        raise PermissionDenied("Permission denied")

    await db.delete(comment)
    await db.commit()
    return