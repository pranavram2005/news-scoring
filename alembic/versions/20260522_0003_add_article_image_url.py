"""add article image url

Revision ID: 20260522_0003
Revises: 20260522_0002
Create Date: 2026-05-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260522_0003"
down_revision: Union[str, Sequence[str], None] = "20260522_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("article_scores", sa.Column("image_url", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("article_scores", "image_url")
