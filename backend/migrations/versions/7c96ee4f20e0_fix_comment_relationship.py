"""Fix comment relationship

Revision ID: 7c96ee4f20e0
Revises: bd4350495db8
Create Date: 2026-09-05 16:26:49.895506

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '7c96ee4f20e0'
down_revision: Union[str, Sequence[str], None] = 'bd4350495db8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Fix comment relationship - remove cascade and add proper constraints."""
    
    # Drop the existing comments table if it exists (to recreate with correct schema)
    # WARNING: This will delete all existing comment data!
    op.execute("DROP TABLE IF EXISTS comments CASCADE")
    
    # Recreate comments table with correct schema
    op.create_table(
        'comments',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('document_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('selection', sa.JSON(), nullable=True),
        sa.Column('parent_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('resolved', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolved_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['parent_id'], ['comments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['resolved_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for performance
    op.create_index('idx_comments_document', 'comments', ['document_id'])
    op.create_index('idx_comments_user', 'comments', ['user_id'])
    op.create_index('idx_comments_parent', 'comments', ['parent_id'])
    op.create_index('idx_comments_created', 'comments', ['created_at'])
    op.create_index('idx_comments_resolved', 'comments', ['resolved'])


def downgrade() -> None:
    """Downgrade schema - restore previous version."""
    
    # Drop indexes
    op.drop_index('idx_comments_resolved', table_name='comments')
    op.drop_index('idx_comments_created', table_name='comments')
    op.drop_index('idx_comments_parent', table_name='comments')
    op.drop_index('idx_comments_user', table_name='comments')
    op.drop_index('idx_comments_document', table_name='comments')
    
    # Drop the table
    op.drop_table('comments')