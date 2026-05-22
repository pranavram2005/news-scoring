from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.repositories import (
    create_article_score,
    create_ingested_article_score,
    delete_all_article_scores,
    delete_article_score,
    get_article_score_by_url,
    get_article_scores,
    get_latest_news_scores,
)
from app.schemas import (
    AnalyzeRequest,
    AnalyzeNewsRequest,
    ArticleScoreResponse,
    AnalyzeResponse,
    LatestNewsResponse,
    NewsPreviewResponse,
)
from app.services.image_service import get_news_image_url
from app.services.news_fetcher import fetch_latest_articles
from app.services.scoring_service import ScoringServiceError, analyze_article_relevance

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
            source=score.source,
            title=score.title,
            published_at=score.published_at,
            url=score.url,
            image_url=score.image_url,
            relevance_score=score.relevance_score,
            confidence_score=score.confidence_score,
            short_reason=score.short_reason,
            created_at=score.created_at,
        )
        for score in scores
    ]


@app.get("/latest-news", response_model=list[LatestNewsResponse])
async def latest_news(
    limit: int = 9,
    category: str | None = None,
    db: Session = Depends(get_db),
) -> list[LatestNewsResponse]:
    scores = get_latest_news_scores(db, limit=max(1, min(limit, 100)), category=category)
    return [
        LatestNewsResponse(
            id=score.id,
            source=score.source,
            title=score.title or score.article[:120],
            article=score.article,
            published_at=score.published_at,
            url=score.url or "",
            image_url=score.image_url,
            topic=score.topic,
            relevance_score=score.relevance_score,
            confidence_score=score.confidence_score,
            short_reason=score.short_reason,
            created_at=score.created_at,
        )
        for score in scores
        if score.url
    ]


@app.get("/news", response_model=list[NewsPreviewResponse])
async def news_previews(category: str, limit: int = 9) -> list[NewsPreviewResponse]:
    articles = await fetch_latest_articles(query=category, page_size=max(1, min(limit, 9)))
    previews: list[NewsPreviewResponse] = []
    for article in articles[: max(1, min(limit, 9))]:
        previews.append(
            NewsPreviewResponse(
                source=article.source,
                title=article.title,
                article=article.text_for_scoring,
                published_at=article.published_at,
                url=article.url,
                image_url=await get_news_image_url(article.title, category),
            )
        )

    return sorted(previews, key=lambda preview: bool(preview.image_url), reverse=True)


@app.post("/analyze-news", response_model=LatestNewsResponse)
async def analyze_news(payload: AnalyzeNewsRequest, db: Session = Depends(get_db)) -> LatestNewsResponse:
    existing_score = get_article_score_by_url(db, payload.url)
    if existing_score is not None:
        score = existing_score
    else:
        scoring_result = await analyze_article_relevance(topic=payload.topic, article=payload.article)
        saved_score = create_ingested_article_score(
            db,
            topic=payload.topic,
            article=payload.article,
            source=payload.source,
            title=payload.title,
            published_at=payload.published_at,
            url=payload.url,
            image_url=payload.image_url,
            scoring_result=scoring_result,
        )
        if saved_score is None:
            score = get_article_score_by_url(db, payload.url)
            if score is None:
                raise HTTPException(status_code=409, detail="Article was already saved but could not be loaded.")
        else:
            score = saved_score

    return LatestNewsResponse(
        id=score.id,
        source=score.source,
        title=score.title or score.article[:120],
        article=score.article,
        published_at=score.published_at,
        url=score.url or "",
        image_url=score.image_url,
        topic=score.topic,
        relevance_score=score.relevance_score,
        confidence_score=score.confidence_score,
        short_reason=score.short_reason,
        created_at=score.created_at,
    )


@app.delete("/scores/{score_id}")
async def delete_score(score_id: int, db: Session = Depends(get_db)) -> dict[str, bool]:
    deleted = delete_article_score(db, score_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Score not found.")

    return {"deleted": True}


@app.delete("/scores")
async def delete_all_scores(db: Session = Depends(get_db)) -> dict[str, int]:
    deleted_count = delete_all_article_scores(db)
    return {"deleted": deleted_count}


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_article(payload: AnalyzeRequest, db: Session = Depends(get_db)) -> AnalyzeResponse:
    try:
        scoring_result = await analyze_article_relevance(topic=payload.topic, article=payload.article)
        create_article_score(db, topic=payload.topic, article=payload.article, scoring_result=scoring_result)
    except ScoringServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to store article score.") from exc

    return AnalyzeResponse(
        topic=payload.topic,
        relevance_score=scoring_result.relevance_score,
        confidence_score=scoring_result.confidence_score,
        short_reason=scoring_result.short_reason,
    )
