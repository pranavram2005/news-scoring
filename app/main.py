import logging
import os

from fastapi import Depends, FastAPI, HTTPException
from celery.exceptions import CeleryError
from kombu.exceptions import KombuError
from redis.exceptions import RedisError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.celery_app import celery_app
from app.db.database import get_db
from app.db.models import ArticleScore
from app.db.repositories import create_article_score, delete_article_score, get_article_score, get_article_scores
from app.schemas import AnalyzeRequest, ArticleScoreResponse, TaskEnqueuedResponse, TaskStatusResponse
from app.services.scoring_service import ScoringServiceError, analyze_article_relevance
from app.tasks.article_scoring import score_article

TRACKED_TASK_STATES = {"PENDING", "STARTED", "SUCCESS", "FAILURE"}
USE_CELERY = os.getenv("USE_CELERY", "false").lower() in {"1", "true", "yes"}
DIRECT_TASK_PREFIX = "score-"

logger = logging.getLogger(__name__)

app = FastAPI(
    title="News Article Scoring API",
    description="A FastAPI backend for scoring article relevance to a topic.",
    version="0.1.0",
)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/scores", response_model=list[ArticleScoreResponse])
async def list_scores(db: Session = Depends(get_db)) -> list[ArticleScoreResponse]:
    scores = get_article_scores(db)
    return [
        ArticleScoreResponse(
            id=score.id,
            topic=score.topic,
            article=score.article,
            relevance_score=score.relevance_score,
            confidence_score=score.confidence_score,
            short_reason=score.short_reason,
            created_at=score.created_at,
        )
        for score in scores
    ]


@app.delete("/scores/{score_id}")
async def delete_score(score_id: int, db: Session = Depends(get_db)) -> dict[str, bool]:
    deleted = delete_article_score(db, score_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Score not found.")

    return {"deleted": True}


@app.post("/analyze", response_model=TaskEnqueuedResponse)
async def analyze_article(payload: AnalyzeRequest, db: Session = Depends(get_db)) -> TaskEnqueuedResponse:
    if not USE_CELERY:
        try:
            scoring_result = await analyze_article_relevance(topic=payload.topic, article=payload.article)
            saved_score = create_article_score(
                db,
                topic=payload.topic,
                article=payload.article,
                scoring_result=scoring_result,
            )
        except ScoringServiceError as exc:
            logger.exception("Direct article scoring failed")
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        except SQLAlchemyError as exc:
            db.rollback()
            logger.exception("Failed to store direct article score")
            raise HTTPException(status_code=500, detail="Failed to store article score.") from exc

        return TaskEnqueuedResponse(task_id=f"{DIRECT_TASK_PREFIX}{saved_score.id}", status="SUCCESS")

    try:
        task = score_article.delay(topic=payload.topic, article=payload.article)
    except (CeleryError, KombuError, RedisError, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="Task queue unavailable.") from exc

    return TaskEnqueuedResponse(task_id=task.id, status=task.status)


@app.get("/task/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(task_id: str, db: Session = Depends(get_db)) -> TaskStatusResponse:
    if task_id.startswith(DIRECT_TASK_PREFIX):
        score_id = _parse_direct_task_id(task_id)
        if score_id is None:
            return TaskStatusResponse(task_id=task_id, status="FAILURE", result={"error": "Invalid direct task id."})

        score = get_article_score(db, score_id)
        if score is None:
            return TaskStatusResponse(task_id=task_id, status="FAILURE", result={"error": "Score not found."})

        return TaskStatusResponse(task_id=task_id, status="SUCCESS", result=_article_score_to_dict(score))

    try:
        task = celery_app.AsyncResult(task_id)
        status = task.status

        result = None
        if status == "SUCCESS":
            result = task.result
        elif status == "FAILURE":
            result = _format_task_error(task.result)
        elif status in {"PENDING", "STARTED"}:
            result = None
        elif task.ready():
            result = _format_task_error(task.result)

        if status not in TRACKED_TASK_STATES and task.ready():
            status = "FAILURE"
    except (CeleryError, KombuError, RedisError, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="Task backend unavailable.") from exc

    return TaskStatusResponse(task_id=task_id, status=status, result=result)


def _parse_direct_task_id(task_id: str) -> int | None:
    raw_score_id = task_id.removeprefix(DIRECT_TASK_PREFIX)
    try:
        return int(raw_score_id)
    except ValueError:
        return None


def _article_score_to_dict(score: ArticleScore) -> dict[str, object]:
    return {
        "id": score.id,
        "topic": score.topic,
        "article": score.article,
        "relevance_score": score.relevance_score,
        "confidence_score": score.confidence_score,
        "short_reason": score.short_reason,
        "created_at": score.created_at.isoformat(),
    }


def _format_task_error(raw_result: object) -> dict[str, str]:
    if isinstance(raw_result, dict):
        if isinstance(raw_result.get("error"), str):
            return {"error": raw_result["error"]}

        exc_message = raw_result.get("exc_message")
        if isinstance(exc_message, list) and exc_message:
            return {"error": " ".join(str(part) for part in exc_message)}
        if isinstance(exc_message, str):
            return {"error": exc_message}

    if isinstance(raw_result, BaseException):
        message = str(raw_result) or raw_result.__class__.__name__
    elif raw_result is None:
        message = "Task failed."
    else:
        message = str(raw_result)

    return {"error": message}
