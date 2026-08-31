from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import uuid
from app.database import get_db
from app.schemas.document import (
    DocumentCreate, DocumentUpdate, DocumentResponse,
    DocumentWithPermissions, PermissionCreate, PermissionResponse
)
from app.services.document_service import DocumentService
from app.routers.users import get_current_user
from app.models.user import User
from app.core.exceptions import NotFoundError, PermissionDenied

router = APIRouter()

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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all documents for the current user."""
    documents = await DocumentService.get_user_documents(
        db, current_user.id, include_archived
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
    
    # Get user's role
    user_role = None
    is_owner = False
    for perm in document.permissions:
        if perm.user_id == current_user.id:
            user_role = perm.role
            if perm.role == "owner":
                is_owner = True
    
    return DocumentWithPermissions(
        **document.__dict__,
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
    # Check if current user is owner
    is_owner = await DocumentService.is_owner(db, document_id, current_user.id)
    if not is_owner:
        raise PermissionDenied("Only the owner can add permissions")
    
    # Check if document exists
    await DocumentService.get_document(db, document_id, current_user.id)
    
    # Create permission
    from app.models.document import Permission
    permission = Permission(
        document_id=document_id,
        user_id=permission_data.user_id,
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
    # Check if current user is owner
    is_owner = await DocumentService.is_owner(db, document_id, current_user.id)
    if not is_owner:
        raise PermissionDenied("Only the owner can remove permissions")
    
    # Don't remove owner's own permission
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove your own owner permission"
        )
    
    # Delete permission
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