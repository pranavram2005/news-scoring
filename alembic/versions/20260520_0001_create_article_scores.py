"""create article scores

Revision ID: 20260520_0001
Revises:
Create Date: 2026-05-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260520_0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "article_scores",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("topic", sa.String(length=255), nullable=False),
        sa.Column("article", sa.Text(), nullable=False),
        sa.Column("relevance_score", sa.Integer(), nullable=False),
        sa.Column("confidence_score", sa.Integer(), nullable=False),
        sa.Column("short_reason", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "confidence_score >= 0 AND confidence_score <= 100",
            name="ck_article_scores_confidence_score_range",
        ),
        sa.CheckConstraint(
            "relevance_score >= 0 AND relevance_score <= 100",
            name="ck_article_scores_relevance_score_range",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_article_scores_id"), "article_scores", ["id"], unique=False)
    op.create_index(op.f("ix_article_scores_topic"), "article_scores", ["topic"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_article_scores_topic"), table_name="article_scores")
    op.drop_index(op.f("ix_article_scores_id"), table_name="article_scores")
    op.drop_table("article_scores")
