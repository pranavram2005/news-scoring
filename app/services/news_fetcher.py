import os
import ssl
from dataclasses import dataclass
from datetime import datetime

import httpx
import truststore
from dotenv import load_dotenv

load_dotenv()

NEWSAPI_URL = "https://newsapi.org/v2/everything"
GNEWS_URL = "https://gnews.io/api/v4/search"


class NewsFetcherError(RuntimeError):
    pass


@dataclass(frozen=True)
class FetchedArticle:
    source: str | None
    title: str
    description: str | None
    content: str | None
    published_at: datetime | None
    url: str

    @property
    def text_for_scoring(self) -> str:
        parts = [self.title, self.description, self.content]
        return "\n\n".join(part for part in parts if part)


def _ssl_context() -> ssl.SSLContext:
    return truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)


def _provider() -> str:
    return os.getenv("NEWS_API_PROVIDER", "newsapi").strip().lower()


def _query(query: str | None = None) -> str:
    if query is not None and query.strip():
        return query.strip()

    return os.getenv("NEWS_QUERY", "technology OR business OR science").strip()


def _page_size(page_size: int | None = None) -> int:
    if page_size is not None:
        return max(1, min(page_size, 100))

    raw_value = os.getenv("NEWS_FETCH_PAGE_SIZE", "10")
    try:
        return max(1, min(int(raw_value), 100))
    except ValueError:
        return 10


async def fetch_latest_articles(query: str | None = None, page_size: int | None = None) -> list[FetchedArticle]:
    provider = _provider()
    if provider == "gnews":
        return await _fetch_gnews(query=query, page_size=page_size)
    if provider == "newsapi":
        return await _fetch_newsapi(query=query, page_size=page_size)

    raise NewsFetcherError("NEWS_API_PROVIDER must be either 'newsapi' or 'gnews'.")


async def _fetch_newsapi(query: str | None, page_size: int | None) -> list[FetchedArticle]:
    api_key = os.getenv("NEWSAPI_API_KEY") or os.getenv("NEWS_API_KEY")
    if not api_key:
        raise NewsFetcherError("NEWSAPI_API_KEY or NEWS_API_KEY is not configured.")

    params = {
        "apiKey": api_key,
        "q": _query(query),
        "language": os.getenv("NEWS_LANGUAGE", "en"),
        "sortBy": "publishedAt",
        "pageSize": _page_size(page_size),
    }
    async with httpx.AsyncClient(verify=_ssl_context(), timeout=30) as client:
        response = await client.get(NEWSAPI_URL, params=params)
        response.raise_for_status()

    payload = response.json()
    if payload.get("status") != "ok":
        raise NewsFetcherError(str(payload.get("message") or "NewsAPI request failed."))

    return [_newsapi_article(article) for article in payload.get("articles", []) if article.get("url") and article.get("title")]


async def _fetch_gnews(query: str | None, page_size: int | None) -> list[FetchedArticle]:
    api_key = os.getenv("GNEWS_API_KEY") or os.getenv("NEWS_API_KEY")
    if not api_key:
        raise NewsFetcherError("GNEWS_API_KEY or NEWS_API_KEY is not configured.")

    params = {
        "apikey": api_key,
        "q": _query(query),
        "lang": os.getenv("NEWS_LANGUAGE", "en"),
        "max": min(_page_size(page_size), 10),
    }
    async with httpx.AsyncClient(verify=_ssl_context(), timeout=30) as client:
        response = await client.get(GNEWS_URL, params=params)
        response.raise_for_status()

    payload = response.json()
    if "errors" in payload:
        raise NewsFetcherError(str(payload["errors"]))

    return [_gnews_article(article) for article in payload.get("articles", []) if article.get("url") and article.get("title")]


def _newsapi_article(article: dict) -> FetchedArticle:
    source = article.get("source") or {}
    return FetchedArticle(
        source=source.get("name"),
        title=article["title"],
        description=article.get("description"),
        content=article.get("content"),
        published_at=_parse_datetime(article.get("publishedAt")),
        url=article["url"],
    )


def _gnews_article(article: dict) -> FetchedArticle:
    source = article.get("source") or {}
    return FetchedArticle(
        source=source.get("name"),
        title=article["title"],
        description=article.get("description"),
        content=article.get("content"),
        published_at=_parse_datetime(article.get("publishedAt")),
        url=article["url"],
    )


def _parse_datetime(raw_value: str | None) -> datetime | None:
    if not raw_value:
        return None

    try:
        return datetime.fromisoformat(raw_value.replace("Z", "+00:00"))
    except ValueError:
        return None
