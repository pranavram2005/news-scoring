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


class ArticleScoreResponse(BaseModel):
    id: int
    topic: str
    article: str
    relevance_score: int = Field(..., ge=0, le=100)
    confidence_score: int = Field(..., ge=0, le=100)
    short_reason: str
    created_at: datetime


class LLMScoringResult(BaseModel):
    relevance_score: int = Field(..., ge=0, le=100)
    confidence_score: int = Field(..., ge=0, le=100)
    short_reason: str = Field(..., min_length=1)
