from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import uuid
from app.database import get_db
from app.schemas.media import MediaResponse
from app.services.cloudinary_service import cloudinary_service
from app.services.document_service import DocumentService
from app.routers.users import get_current_user
from app.models.user import User
from app.models.media import Media
from app.core.exceptions import PermissionDenied, NotFoundError

router = APIRouter()

@router.post("/upload", response_model=MediaResponse)
async def upload_file(
    document_id: uuid.UUID = Query(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Upload a file to a document."""
    # Check document permission
    has_permission = await DocumentService.check_permission(
        db, document_id, current_user.id, "editor"
    )
    if not has_permission:
        raise PermissionDenied("You don't have permission to upload files to this document")
    
    # Check file size
    file_size = len(await file.read())
    await file.seek(0)  # Reset file position
    
    from app.config import settings
    if file_size > settings.CLOUDINARY_MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max size: {settings.CLOUDINARY_MAX_FILE_SIZE} bytes"
        )
    
    # Upload to Cloudinary
    upload_result = await cloudinary_service.upload_file(
        file=file,
        folder=f"{settings.CLOUDINARY_UPLOAD_FOLDER}/{document_id}",
        transformation={
            "quality": "auto",
            "fetch_format": "auto"
        }
    )
    
    if not upload_result["success"]:
        raise HTTPException(
            status_code=500,
            detail=f"Upload failed: {upload_result.get('error', 'Unknown error')}"
        )
    
    # Save to database
    media = Media(
        document_id=document_id,
        uploaded_by=current_user.id,
        file_name=file.filename,
        file_size=file_size,
        mime_type=file.content_type or "application/octet-stream",
        storage_url=upload_result["url"],
        thumbnail_url=upload_result.get("thumbnail_url"),
        public_id=upload_result["public_id"],
        meta_data=upload_result.get("metadata", {})
    )
    db.add(media)
    await db.commit()
    await db.refresh(media)
    
    return media

@router.get("/{document_id}", response_model=List[MediaResponse])
async def get_document_media(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all media for a document."""
    # Check permission
    has_permission = await DocumentService.check_permission(
        db, document_id, current_user.id, "viewer"
    )
    if not has_permission:
        raise PermissionDenied("You don't have permission to view this document's media")
    
    # Get media
    from sqlalchemy import select
    result = await db.execute(
        select(Media).where(Media.document_id == document_id)
        .order_by(Media.created_at.desc())
    )
    return result.scalars().all()

@router.delete("/{media_id}")
async def delete_media(
    media_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a media file."""
    # Get media
    from sqlalchemy import select
    result = await db.execute(
        select(Media).where(Media.id == media_id)
    )
    media = result.scalar_one_or_none()
    if not media:
        raise NotFoundError("Media not found")
    
    # Check permission
    has_permission = await DocumentService.check_permission(
        db, media.document_id, current_user.id, "editor"
    )
    if not has_permission:
        raise PermissionDenied("You don't have permission to delete this media")
    
    # Delete from Cloudinary
    resource_type = "image"
    if media.mime_type and media.mime_type.startswith("video/"):
        resource_type = "video"
    
    await cloudinary_service.delete_file(media.public_id, resource_type)
    
    # Delete from database
    await db.delete(media)
    await db.commit()
    
    return {"message": "Media deleted successfully"}

@router.get("/{media_id}/url")
async def get_media_url(
    media_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get the URL for a media file."""
    # Get media
    from sqlalchemy import select
    result = await db.execute(
        select(Media).where(Media.id == media_id)
    )
    media = result.scalar_one_or_none()
    if not media:
        raise NotFoundError("Media not found")
    
    # Check permission
    has_permission = await DocumentService.check_permission(
        db, media.document_id, current_user.id, "viewer"
    )
    if not has_permission:
        raise PermissionDenied("You don't have permission to view this media")
    
    return {
        "url": media.storage_url,
        "thumbnail_url": media.thumbnail_url
    }