from sqlalchemy import Column, String, BigInteger, DateTime, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base
import uuid

class Media(Base):
    __tablename__ = "media"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    file_name = Column(String(255), nullable=False)
    file_size = Column(BigInteger, nullable=False)
    mime_type = Column(String(100), nullable=False)
    storage_url = Column(String(500), nullable=False)  # Cloudinary URL
    thumbnail_url = Column(String(500), nullable=True)  # For images/videos
    public_id = Column(String(255), nullable=False)  # Cloudinary public ID
    meta_data = Column(JSON, nullable=True)  # width, height, duration, etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    document = relationship("Document", back_populates="media")
    uploader = relationship("User")