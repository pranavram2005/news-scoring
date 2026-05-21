import asyncio

from celery.exceptions import SoftTimeLimitExceeded
from celery.utils.log import get_task_logger
from sqlalchemy.exc import SQLAlchemyError

from app.celery_app import celery_app
from app.database import SessionLocal
from app.db.repositories import create_article_score
from app.services.scoring_service import ScoringServiceError, analyze_article_relevance

logger = get_task_logger(__name__)


class LoggedTaskError(RuntimeError):
    pass


@celery_app.task(bind=True, name="app.tasks.article_scoring.score_article")
def score_article(self, topic: str, article: str) -> dict[str, object]:
    logger.info("Starting article scoring task %s", self.request.id)

    try:
        try:
            scoring_result = asyncio.run(analyze_article_relevance(topic=topic, article=article))
        except ScoringServiceError as exc:
            logger.exception("Scoring service failed for task %s", self.request.id)
            raise LoggedTaskError(str(exc)) from exc

        db = SessionLocal()
        try:
            saved_score = create_article_score(
                db,
                topic=topic,
                article=article,
                scoring_result=scoring_result,
            )
            logger.info("Completed article scoring task %s", self.request.id)
            return {
                "id": saved_score.id,
                "topic": saved_score.topic,
                "article": saved_score.article,
                "relevance_score": saved_score.relevance_score,
                "confidence_score": saved_score.confidence_score,
                "short_reason": saved_score.short_reason,
                "created_at": saved_score.created_at.isoformat(),
            }
        except SQLAlchemyError as exc:
            db.rollback()
            logger.exception("Failed to store article score for task %s", self.request.id)
            raise LoggedTaskError("Failed to store article score.") from exc
        finally:
            db.close()
    except SoftTimeLimitExceeded as exc:
        logger.exception("Article scoring task %s timed out", self.request.id)
        raise LoggedTaskError("Article scoring task timed out.") from exc
    except LoggedTaskError:
        raise
    except Exception:
        logger.exception("Article scoring task %s failed unexpectedly", self.request.id)
        raise
