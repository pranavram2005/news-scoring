import json
import os
import re
import ssl

import httpx
import truststore
from dotenv import load_dotenv
from groq import APIError, AsyncGroq
from pydantic import ValidationError

from app.schemas import LLMScoringResult

load_dotenv()

MODEL_NAME = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")


class ScoringServiceError(RuntimeError):
    pass


def _ssl_context() -> ssl.SSLContext:
    return truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)


def _get_api_key() -> str:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ScoringServiceError("GROQ_API_KEY is not configured.")

    return api_key


def _build_prompt(topic: str, article: str) -> str:
    return f"""
Analyze how relevant the article is to the topic.

Scoring rules:
- 0-20: unrelated
- 21-50: weak relevance
- 51-75: moderate relevance
- 76-100: highly relevant

Return ONLY valid JSON in this exact format:
{{
  "relevance_score": 0,
  "confidence_score": 0,
  "short_reason": "string"
}}

Topic:
{topic}

Article:
{article}
""".strip()


def _clean_json_markdown(raw_content: str) -> str:
    content = raw_content.strip()
    fenced_match = re.fullmatch(r"```(?:json)?\s*(.*?)\s*```", content, flags=re.DOTALL | re.IGNORECASE)
    if fenced_match:
        return fenced_match.group(1).strip()

    return content


def _parse_llm_response(raw_content: str) -> LLMScoringResult:
    cleaned_content = _clean_json_markdown(raw_content)
    data = json.loads(cleaned_content)
    return LLMScoringResult.model_validate(data)


async def _request_score(topic: str, article: str, retry: bool = False) -> str:
    system_prompt = (
        "You are a strict JSON API. Return only valid JSON. "
        "Do not include markdown fences, prose, comments, or extra keys."
    )
    if retry:
        system_prompt += " The previous response could not be parsed as JSON."

    async with httpx.AsyncClient(verify=_ssl_context(), timeout=30) as http_client:
        client = AsyncGroq(
            api_key=_get_api_key(),
            http_client=http_client,
            max_retries=1,
        )
        completion = await client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": _build_prompt(topic=topic, article=article)},
            ],
            response_format={"type": "json_object"},
            temperature=0,
        )

    return completion.choices[0].message.content or ""


async def analyze_article_relevance(topic: str, article: str) -> LLMScoringResult:
    try:
        raw_content = await _request_score(topic=topic, article=article)
    except APIError as exc:
        raise ScoringServiceError(f"Groq API request failed: {exc}") from exc
    except httpx.HTTPError as exc:
        raise ScoringServiceError(f"Groq HTTP request failed: {exc}") from exc

    try:
        return _parse_llm_response(raw_content)
    except (json.JSONDecodeError, ValidationError):
        try:
            retry_content = await _request_score(topic=topic, article=article, retry=True)
        except APIError as exc:
            raise ScoringServiceError(f"Groq API retry failed: {exc}") from exc
        except httpx.HTTPError as exc:
            raise ScoringServiceError(f"Groq HTTP retry failed: {exc}") from exc

        try:
            return _parse_llm_response(retry_content)
        except (json.JSONDecodeError, ValidationError) as exc:
            raise ScoringServiceError("Groq returned invalid scoring JSON after retry.") from exc
