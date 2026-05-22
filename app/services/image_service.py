import os
import ssl

import httpx
import truststore
from dotenv import load_dotenv

load_dotenv()

UNSPLASH_SEARCH_URL = "https://api.unsplash.com/search/photos"

CATEGORY_FALLBACK_IMAGES = {
    "business": "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1080&q=80",
    "finance": "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1080&q=80",
    "sports": "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1080&q=80",
    "technology": "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1080&q=80",
    "science": "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1080&q=80",
    "health": "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1080&q=80",
    "entertainment": "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1080&q=80",
    "world": "https://images.unsplash.com/photo-1521295121783-8a321d551ad2?auto=format&fit=crop&w=1080&q=80",
}
DEFAULT_NEWS_IMAGE_URL = "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1080&q=80"


class ImageServiceError(RuntimeError):
    pass


def _ssl_context() -> ssl.SSLContext:
    return truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)


async def fetch_unsplash_image_url(query: str) -> str | None:
    access_key = os.getenv("UNSPLASH_ACCESS_KEY")
    if not access_key:
        return None

    clean_query = query.strip()
    if not clean_query:
        return None

    params = {
        "query": clean_query,
        "per_page": 1,
        "orientation": "landscape",
        "content_filter": "high",
        "client_id": access_key,
    }
    try:
        async with httpx.AsyncClient(verify=_ssl_context(), timeout=20) as client:
            response = await client.get(UNSPLASH_SEARCH_URL, params=params)
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise ImageServiceError(f"Unsplash image request failed: {exc}") from exc

    payload = response.json()
    results = payload.get("results") or []
    if not results:
        return None

    urls = results[0].get("urls") or {}
    return urls.get("regular") or urls.get("small") or urls.get("thumb")


async def get_news_image_url(title: str, category: str | None = None) -> str:
    try:
        title_image_url = await fetch_unsplash_image_url(title)
        if title_image_url:
            return title_image_url

        if category:
            category_image_url = await fetch_unsplash_image_url(_image_query_for_category(category))
            if category_image_url:
                return category_image_url
    except ImageServiceError:
        pass

    return fallback_news_image_url(category)


def fallback_news_image_url(category: str | None = None) -> str:
    if not category:
        return DEFAULT_NEWS_IMAGE_URL

    normalized_category = category.lower()
    for key, image_url in CATEGORY_FALLBACK_IMAGES.items():
        if key in normalized_category:
            return image_url

    return DEFAULT_NEWS_IMAGE_URL


def _image_query_for_category(category: str) -> str:
    normalized_category = category.strip().lower()
    if "world" in normalized_category:
        return "world news globe"
    if "finance" in normalized_category:
        return "finance market stocks"
    if "business" in normalized_category:
        return "business news office"
    if "entertainment" in normalized_category:
        return "entertainment cinema"
    if "sports" in normalized_category:
        return "sports stadium"
    if "technology" in normalized_category:
        return "technology circuit"
    if "science" in normalized_category:
        return "science laboratory"
    if "health" in normalized_category:
        return "healthcare medical"

    return f"{category} news"
