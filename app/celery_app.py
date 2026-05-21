import os

from celery import Celery

from app.redis_client import REDIS_URL


def _env_int(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default

    try:
        return int(raw_value)
    except ValueError:
        return default


TASK_SOFT_TIME_LIMIT_SECONDS = _env_int("CELERY_TASK_SOFT_TIME_LIMIT_SECONDS", 75)
TASK_TIME_LIMIT_SECONDS = _env_int("CELERY_TASK_TIME_LIMIT_SECONDS", 90)

celery_app = Celery(
    "news_article_scoring",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["app.tasks.article_scoring"],
)

celery_app.conf.update(
    task_track_started=True,
    task_soft_time_limit=TASK_SOFT_TIME_LIMIT_SECONDS,
    task_time_limit=TASK_TIME_LIMIT_SECONDS,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    broker_connection_retry_on_startup=True,
    broker_transport_options={
        "max_retries": 1,
        "interval_start": 0,
        "interval_step": 0,
        "interval_max": 0,
    },
    result_backend_transport_options={
        "retry_policy": {
            "max_retries": 1,
            "interval_start": 0,
            "interval_step": 0,
            "interval_max": 0,
        },
    },
)
