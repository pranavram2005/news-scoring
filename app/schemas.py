from datetime import datetime

from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    topic: str = Field(..., min_length=1, examples=["climate change"])
    article: str = Field(..., min_length=1, examples=["Climate policy updates were announced today."])


class AnalyzeResponse(BaseModel):
    topic: str
    relevance_score: int = Field(..., ge=0, le=100)
    confidence_score: int = Field(..., ge=0, le=100)
    short_reason: str


class TaskEnqueuedResponse(BaseModel):
    task_id: str
    status: str


class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    result: dict | None = None


class IngestNewsRequest(BaseModel):
    category: str = Field(..., min_length=1, max_length=80, examples=["sports"])
    limit: int = Field(9, ge=1, le=9)


class NewsPreviewResponse(BaseModel):
    source: str | None = None
    title: str
    article: str
    published_at: datetime | None = None
    url: str
    image_url: str | None = None


class AnalyzeNewsRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=255)
    source: str | None = None
    title: str = Field(..., min_length=1)
    article: str = Field(..., min_length=1)
    published_at: datetime | None = None
    url: str = Field(..., min_length=1)
    image_url: str | None = None


class ArticleScoreResponse(BaseModel):
    id: int
    topic: str
    article: str
    source: str | None = None
    title: str | None = None
    published_at: datetime | None = None
    url: str | None = None
    image_url: str | None = None
    relevance_score: int = Field(..., ge=0, le=100)
    confidence_score: int = Field(..., ge=0, le=100)
    short_reason: str
    created_at: datetime


class LatestNewsResponse(BaseModel):
    id: int
    source: str | None = None
    title: str
    article: str
    published_at: datetime | None = None
    url: str
    image_url: str | None = None
    topic: str
    relevance_score: int = Field(..., ge=0, le=100)
    confidence_score: int = Field(..., ge=0, le=100)
    short_reason: str
    created_at: datetime


class LLMScoringResult(BaseModel):
    relevance_score: int = Field(..., ge=0, le=100)
    confidence_score: int = Field(..., ge=0, le=100)
    short_reason: str = Field(..., min_length=1)
