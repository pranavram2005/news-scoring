export type AnalyzeRequest = {
  topic: string;
  article: string;
};

export type ScoreResult = {
  id: number;
  topic: string;
  article: string;
  source?: string | null;
  title?: string | null;
  published_at?: string | null;
  url?: string | null;
  image_url?: string | null;
  relevance_score: number;
  confidence_score: number;
  short_reason: string;
  created_at: string;
};

export type LatestNewsArticle = {
  id: number;
  source: string | null;
  title: string;
  article: string;
  published_at: string | null;
  url: string;
  image_url: string | null;
  topic: string;
  relevance_score: number;
  confidence_score: number;
  short_reason: string;
  created_at: string;
};

export type NewsPreviewArticle = {
  source: string | null;
  title: string;
  article: string;
  published_at: string | null;
  url: string;
  image_url: string | null;
};

export type LatestNewsEvent =
  | {
      event: "article_analyzed";
      article: LatestNewsArticle;
    }
  | {
      event: "error";
      error: string;
    };

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/fastapi";
const SERVER_API_BASE_URL =
  process.env.FASTAPI_BASE_URL ??
  (process.env.FASTAPI_HOSTPORT ? `http://${process.env.FASTAPI_HOSTPORT}` : "http://127.0.0.1:8000");

function httpBaseUrl(): string {
  return typeof window === "undefined" ? SERVER_API_BASE_URL : API_BASE_URL;
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload.detail === "string"
        ? payload.detail
        : "Request failed. Check that the FastAPI backend is running.";
    throw new Error(message);
  }

  return payload as T;
}

export async function analyzeArticle(request: AnalyzeRequest): Promise<ScoreResult> {
  const response = await fetch(`${API_BASE_URL}/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  const result = await parseApiResponse<Omit<ScoreResult, "id" | "article" | "created_at">>(response);
  return {
    id: 0,
    topic: result.topic,
    article: request.article,
    relevance_score: result.relevance_score,
    confidence_score: result.confidence_score,
    short_reason: result.short_reason,
    created_at: new Date().toISOString(),
  };
}

export async function getScores(): Promise<ScoreResult[]> {
  const response = await fetch(`${httpBaseUrl()}/scores`, {
    cache: "no-store",
  });

  return parseApiResponse<ScoreResult[]>(response);
}

export async function getLatestNews(category?: string, limit = 9): Promise<LatestNewsArticle[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (category?.trim()) {
    params.set("category", category.trim());
  }

  const response = await fetch(`${httpBaseUrl()}/latest-news?${params.toString()}`, {
    cache: "no-store",
  });

  return parseApiResponse<LatestNewsArticle[]>(response);
}

export async function getNewsPreviews(category: string, limit = 9): Promise<NewsPreviewArticle[]> {
  const params = new URLSearchParams({ category, limit: String(limit) });
  const response = await fetch(`${httpBaseUrl()}/news?${params.toString()}`, {
    cache: "no-store",
  });

  return parseApiResponse<NewsPreviewArticle[]>(response);
}

export async function analyzeNewsArticle(
  topic: string,
  article: NewsPreviewArticle,
): Promise<LatestNewsArticle> {
  const response = await fetch(`${API_BASE_URL}/analyze-news`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...article, topic }),
  });

  return parseApiResponse<LatestNewsArticle>(response);
}

export async function deleteScore(scoreId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/scores/${scoreId}`, {
    method: "DELETE",
  });

  await parseApiResponse<{ deleted: boolean }>(response);
}

export async function deleteAllScores(): Promise<number> {
  const response = await fetch(`${API_BASE_URL}/scores`, {
    method: "DELETE",
  });

  const result = await parseApiResponse<{ deleted: number }>(response);
  return result.deleted;
}
