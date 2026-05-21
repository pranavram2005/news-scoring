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


def get_article_scores(db: Session) -> list[ArticleScore]:
    return db.query(ArticleScore).order_by(ArticleScore.created_at.desc(), ArticleScore.id.desc()).all()


def get_article_score(db: Session, score_id: int) -> ArticleScore | None:
    return db.get(ArticleScore, score_id)


def delete_article_score(db: Session, score_id: int) -> bool:
    article_score = db.get(ArticleScore, score_id)
    if article_score is None:
        return False

    db.delete(article_score)
    db.commit()
    return True
