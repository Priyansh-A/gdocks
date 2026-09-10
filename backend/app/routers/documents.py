from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
import uuid
from app.database import get_db
from app.schemas.document import (
    DocumentCreate, DocumentUpdate, DocumentResponse,
    DocumentWithPermissions, PermissionCreate, PermissionResponse,
    DocumentType
)
from app.services.document_service import DocumentService
from app.routers.users import get_current_user
from app.models.user import User
from app.core.exceptions import NotFoundError, PermissionDenied

router = APIRouter(prefix="/documents", tags=["Documents"])

@router.post("/", response_model=DocumentResponse)
async def create_document(
    document_data: DocumentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new document."""
    document = await DocumentService.create_document(
        db, current_user.id, document_data
    )
    return document

@router.get("/", response_model=List[DocumentResponse])
async def get_documents(
    include_archived: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all documents for the current user with pagination."""
    documents = await DocumentService.get_user_documents(
        db, current_user.id, include_archived, limit=limit, offset=offset
    )
    return documents

@router.get("/{document_id}", response_model=DocumentWithPermissions)
async def get_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific document by ID."""
    document = await DocumentService.get_document(
        db, document_id, current_user.id
    )
    
    user_role = None
    is_owner = False
    for perm in document.permissions:
        if perm.user_id == current_user.id:
            user_role = perm.role
            if perm.role == "owner":
                is_owner = True
    
    return DocumentWithPermissions(
        id=document.id,
        title=document.title,
        content=document.content,
        document_type=document.document_type,
        file_url=document.file_url,
        file_metadata=document.file_metadata,
        version=document.version,
        owner_id=document.owner_id,
        is_archived=document.is_archived,
        last_edited_at=document.last_edited_at,
        created_at=document.created_at,
        updated_at=document.updated_at,
        permissions=document.permissions,
        is_owner=is_owner,
        user_role=user_role
    )

@router.put("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: uuid.UUID,
    document_data: DocumentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a document."""
    document = await DocumentService.update_document(
        db, document_id, current_user.id, document_data
    )
    return document

@router.delete("/{document_id}")
async def delete_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a document (soft delete)."""
    await DocumentService.delete_document(
        db, document_id, current_user.id
    )
    return {"message": "Document deleted successfully"}

@router.post("/{document_id}/permissions", response_model=PermissionResponse)
async def add_permission(
    document_id: uuid.UUID,
    permission_data: PermissionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Add a user permission to a document."""
    is_owner = await DocumentService.is_owner(db, document_id, current_user.id)
    if not is_owner:
        raise PermissionDenied("Only the owner can add permissions")
    
    await DocumentService.get_document(db, document_id, current_user.id)

    target_user_id = permission_data.user_id
    if not target_user_id:
        if not permission_data.email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either user_id or email is required"
            )
        result = await db.execute(
            select(User).where(User.email == permission_data.email.lower())
        )
        target_user = result.scalar_one_or_none()
        if not target_user:
            raise NotFoundError("User not found with the provided email")
        target_user_id = target_user.id
    else:
        result = await db.execute(select(User).where(User.id == target_user_id))
        if not result.scalar_one_or_none():
            raise NotFoundError("User not found")
    
    if target_user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already own this document"
        )
    
    from app.models.document import Permission
    existing = await db.execute(
        select(Permission).where(
            (Permission.document_id == document_id) &
            (Permission.user_id == target_user_id)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This user already has access to the document"
        )
    
    permission = Permission(
        document_id=document_id,
        user_id=target_user_id,
        role=permission_data.role
    )
    db.add(permission)
    await db.commit()
    await db.refresh(permission)
    return permission

@router.delete("/{document_id}/permissions/{user_id}")
async def remove_permission(
    document_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove a user's permission from a document."""
    is_owner = await DocumentService.is_owner(db, document_id, current_user.id)
    if not is_owner:
        raise PermissionDenied("Only the owner can remove permissions")
    
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove your own owner permission"
        )
    
    from app.models.document import Permission
    result = await db.execute(
        Permission.__table__.delete().where(
            (Permission.document_id == document_id) &
            (Permission.user_id == user_id)
        )
    )
    await db.commit()
    
    if result.rowcount == 0:
        raise NotFoundError("Permission not found")
    
    return {"message": "Permission removed successfully"}

@router.get("/{document_id}/permissions", response_model=List[PermissionResponse])
async def get_document_permissions(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all permissions for a document."""
    await DocumentService.get_document(db, document_id, current_user.id)

    from app.models.document import Permission
    result = await db.execute(
        select(Permission)
        .where(Permission.document_id == document_id)
        .order_by(Permission.created_at.asc())
    )
    return result.scalars().all()

@router.put("/{document_id}/permissions/{user_id}", response_model=PermissionResponse)
async def update_permission(
    document_id: uuid.UUID,
    user_id: uuid.UUID,
    permission_data: PermissionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a user's permission role on a document."""
    is_owner = await DocumentService.is_owner(db, document_id, current_user.id)
    if not is_owner:
        raise PermissionDenied("Only the owner can update permissions")

    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own owner role"
        )

    from app.models.document import Permission
    result = await db.execute(
        select(Permission).where(
            (Permission.document_id == document_id) &
            (Permission.user_id == user_id)
        )
    )
    permission = result.scalar_one_or_none()
    if not permission:
        raise NotFoundError("Permission not found")

    if permission.role == "owner":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change the owner role"
        )

    permission.role = permission_data.role
    await db.commit()
    await db.refresh(permission)
    return permission

@router.get("/{document_id}/check-permission")
async def check_user_permission(
    document_id: uuid.UUID,
    role: str = Query(..., pattern="^(viewer|commenter|editor|owner)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Check if the current user has the required permission level."""
    try:
        has_permission = await DocumentService.check_permission(
            db, document_id, current_user.id, role
        )
    except NotFoundError:
        raise NotFoundError("Document not found")

    user_role = None
    from app.models.document import Permission
    result = await db.execute(
        select(Permission).where(
            (Permission.document_id == document_id) &
            (Permission.user_id == current_user.id)
        )
    )
    permission = result.scalar_one_or_none()
    if permission:
        user_role = permission.role

    return {"has_permission": has_permission, "role": user_role}

@router.post("/{document_id}/archive")
async def archive_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Archive a document."""
    document = await DocumentService.archive_document(
        db, document_id, current_user.id
    )
    return {"message": "Document archived successfully", "document": document}

@router.post("/{document_id}/restore")
async def restore_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Restore a document from archive."""
    document = await DocumentService.restore_document(
        db, document_id, current_user.id
    )
    return {"message": "Document restored successfully", "document": document}

@router.get("/{document_id}/versions")
async def get_document_versions(
    document_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get version history of a document."""
    versions = await DocumentService.get_document_versions(
        db, document_id, current_user.id, limit, offset
    )
    return versions

@router.post("/{document_id}/restore/{version_id}")
async def restore_version(
    document_id: uuid.UUID,
    version_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Restore a document to a specific version."""
    document = await DocumentService.restore_version(
        db, document_id, version_id, current_user.id
    )
    return {"message": "Version restored successfully", "document": document}