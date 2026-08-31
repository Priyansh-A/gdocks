from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload
from app.models.document import Document, Permission, DocumentVersion
from app.models.user import User
from app.schemas.document import DocumentCreate, DocumentUpdate
from app.core.exceptions import NotFoundError, PermissionDenied
import uuid
import json
from typing import List, Optional

class DocumentService:
    @staticmethod
    async def create_document(
        db: AsyncSession,
        user_id: uuid.UUID,
        document_data: DocumentCreate
    ) -> Document:
        """Create a new document."""
        document = Document(
            title=document_data.title,
            content=json.dumps({"ops": []}),  # Empty document state
            owner_id=user_id,
            version=0
        )
        db.add(document)
        await db.flush()
        
        # Add owner permission
        permission = Permission(
            document_id=document.id,
            user_id=user_id,
            role="owner"
        )
        db.add(permission)
        await db.commit()
        await db.refresh(document)
        
        return document
    
    @staticmethod
    async def get_document(
        db: AsyncSession,
        document_id: uuid.UUID,
        user_id: uuid.UUID
    ) -> Document:
        """Get a document by ID with permission check."""
        # Get document with permissions
        result = await db.execute(
            select(Document)
            .where(
                and_(
                    Document.id == document_id,
                    Document.is_deleted == False
                )
            )
            .options(selectinload(Document.permissions))
        )
        document = result.scalar_one_or_none()
        
        if not document:
            raise NotFoundError("Document not found")
        
        # Check permission
        has_permission = await DocumentService.check_permission(
            db, document_id, user_id, "viewer"
        )
        if not has_permission:
            raise PermissionDenied("You don't have permission to view this document")
        
        return document
    
    @staticmethod
    async def get_user_documents(
        db: AsyncSession,
        user_id: uuid.UUID,
        include_archived: bool = False
    ) -> List[Document]:
        """Get all documents for a user (owned or shared)."""
        # Get documents where user is owner or has permission
        query = select(Document).where(
            and_(
                Document.is_deleted == False,
                or_(
                    Document.owner_id == user_id,
                    Document.permissions.any(
                        and_(
                            Permission.user_id == user_id,
                            Permission.role.in_(["editor", "viewer", "commenter"])
                        )
                    )
                )
            )
        ).options(selectinload(Document.permissions))
        
        if not include_archived:
            query = query.where(Document.is_archived == False)
        
        query = query.order_by(Document.last_edited_at.desc())
        
        result = await db.execute(query)
        return result.scalars().all()
    
    @staticmethod
    async def update_document(
        db: AsyncSession,
        document_id: uuid.UUID,
        user_id: uuid.UUID,
        update_data: DocumentUpdate
    ) -> Document:
        """Update a document."""
        # Check permission
        has_permission = await DocumentService.check_permission(
            db, document_id, user_id, "editor"
        )
        if not has_permission:
            raise PermissionDenied("You don't have permission to edit this document")
        
        document = await DocumentService.get_document(db, document_id, user_id)
        
        if update_data.title is not None:
            document.title = update_data.title
        
        if update_data.content is not None:
            # Save version before updating content
            await DocumentService.save_version(
                db,
                document.id,
                document.content,
                user_id
            )
            document.content = update_data.content
            document.version += 1
        
        await db.commit()
        await db.refresh(document)
        return document
    
    @staticmethod
    async def delete_document(
        db: AsyncSession,
        document_id: uuid.UUID,
        user_id: uuid.UUID
    ) -> bool:
        """Soft delete a document."""
        # Check if user is owner
        is_owner = await DocumentService.is_owner(db, document_id, user_id)
        if not is_owner:
            raise PermissionDenied("Only the owner can delete this document")
        
        document = await DocumentService.get_document(db, document_id, user_id)
        document.is_deleted = True
        await db.commit()
        return True
    
    @staticmethod
    async def check_permission(
        db: AsyncSession,
        document_id: uuid.UUID,
        user_id: uuid.UUID,
        required_role: str
    ) -> bool:
        """Check if user has required permission."""
        result = await db.execute(
            select(Permission).where(
                and_(
                    Permission.document_id == document_id,
                    Permission.user_id == user_id
                )
            )
        )
        permission = result.scalar_one_or_none()
        
        if not permission:
            return False
        
        # Role hierarchy
        role_levels = {
            "viewer": 1,
            "commenter": 2,
            "editor": 3,
            "owner": 4
        }
        
        return role_levels.get(permission.role, 0) >= role_levels.get(required_role, 0)
    
    @staticmethod
    async def is_owner(
        db: AsyncSession,
        document_id: uuid.UUID,
        user_id: uuid.UUID
    ) -> bool:
        """Check if user is the owner of the document."""
        result = await db.execute(
            select(Permission).where(
                and_(
                    Permission.document_id == document_id,
                    Permission.user_id == user_id,
                    Permission.role == "owner"
                )
            )
        )
        return result.scalar_one_or_none() is not None
    
    @staticmethod
    async def save_version(
        db: AsyncSession,
        document_id: uuid.UUID,
        snapshot: str,
        user_id: uuid.UUID
    ):
        """Save a version of the document."""
        version = DocumentVersion(
            document_id=document_id,
            version=await DocumentService.get_next_version(db, document_id),
            snapshot=snapshot,
            user_id=user_id
        )
        db.add(version)
        await db.flush()
    
    @staticmethod
    async def get_next_version(
        db: AsyncSession,
        document_id: uuid.UUID
    ) -> int:
        """Get the next version number."""
        result = await db.execute(
            select(func.count()).select_from(DocumentVersion)
            .where(DocumentVersion.document_id == document_id)
        )
        count = result.scalar() or 0
        return count + 1