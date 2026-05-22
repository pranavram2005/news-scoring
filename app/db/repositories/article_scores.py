from datetime import datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import ArticleScore
from app.schemas import LLMScoringResult


def create_article_score(
    db: Session,
    *,
    topic: str,
    article: str,
    scoring_result: LLMScoringResult,
) -> ArticleScore:
    article_score = ArticleScore(
        topic=topic,
        article=article,
        relevance_score=scoring_result.relevance_score,
        confidence_score=scoring_result.confidence_score,
        short_reason=scoring_result.short_reason,
    )

    db.add(article_score)
    db.commit()
    db.refresh(article_score)
    return article_score


def create_ingested_article_score(
    db: Session,
    *,
    topic: str,
    article: str,
    source: str | None,
    title: str,
    published_at: datetime | None,
    url: str,
    image_url: str | None,
    scoring_result: LLMScoringResult,
) -> ArticleScore | None:
    if get_article_score_by_url(db, url) is not None:
        return None

    article_score = ArticleScore(
        topic=topic,
        article=article,
        source=source,
        title=title,
        published_at=published_at,
        url=url,
        image_url=image_url,
        relevance_score=scoring_result.relevance_score,
        confidence_score=scoring_result.confidence_score,
        short_reason=scoring_result.short_reason,
    )

    db.add(article_score)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return None

    db.refresh(article_score)
    return article_score


def get_article_score_by_url(db: Session, url: str) -> ArticleScore | None:
    return db.query(ArticleScore).filter(ArticleScore.url == url).one_or_none()


def get_article_scores(db: Session) -> list[ArticleScore]:
    return db.query(ArticleScore).order_by(ArticleScore.created_at.desc(), ArticleScore.id.desc()).all()


def get_latest_news_scores(db: Session, limit: int = 50, category: str | None = None) -> list[ArticleScore]:
    query = db.query(ArticleScore).filter(ArticleScore.url.isnot(None))
    if category is not None and category.strip():
        query = query.filter(ArticleScore.topic.ilike(f"%{category.strip()}%"))

    return (
        query.order_by(ArticleScore.published_at.desc().nullslast(), ArticleScore.created_at.desc(), ArticleScore.id.desc())
        .limit(limit)
        .all()
    )


def delete_article_score(db: Session, score_id: int) -> bool:
    article_score = db.get(ArticleScore, score_id)
    if article_score is None:
        return False

    db.delete(article_score)
    db.commit()
    return True


def delete_all_article_scores(db: Session) -> int:
    deleted_count = db.query(ArticleScore).delete(synchronize_session=False)
    db.commit()
    return deleted_count
