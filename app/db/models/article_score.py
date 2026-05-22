from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ArticleScore(Base):
    __tablename__ = "article_scores"
    __table_args__ = (
        CheckConstraint("relevance_score >= 0 AND relevance_score <= 100", name="ck_article_scores_relevance_score_range"),
        CheckConstraint("confidence_score >= 0 AND confidence_score <= 100", name="ck_article_scores_confidence_score_range"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    topic: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    article: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str | None] = mapped_column(String(255), nullable=True)
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    url: Mapped[str | None] = mapped_column(Text, nullable=True, unique=True)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    relevance_score: Mapped[int] = mapped_column(Integer, nullable=False)
    confidence_score: Mapped[int] = mapped_column(Integer, nullable=False)
    short_reason: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
