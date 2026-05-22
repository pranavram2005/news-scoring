"""add ingested news fields

Revision ID: 20260522_0002
Revises: 20260520_0001
Create Date: 2026-05-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260522_0002"
down_revision: Union[str, Sequence[str], None] = "20260520_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("article_scores", sa.Column("source", sa.String(length=255), nullable=True))
    op.add_column("article_scores", sa.Column("title", sa.Text(), nullable=True))
    op.add_column("article_scores", sa.Column("published_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("article_scores", sa.Column("url", sa.Text(), nullable=True))
    op.create_index(op.f("ix_article_scores_published_at"), "article_scores", ["published_at"], unique=False)
    op.create_index("uq_article_scores_url", "article_scores", ["url"], unique=True)


def downgrade() -> None:
    op.drop_index("uq_article_scores_url", table_name="article_scores")
    op.drop_index(op.f("ix_article_scores_published_at"), table_name="article_scores")
    op.drop_column("article_scores", "url")
    op.drop_column("article_scores", "published_at")
    op.drop_column("article_scores", "title")
    op.drop_column("article_scores", "source")
