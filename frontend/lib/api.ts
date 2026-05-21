export type AnalyzeRequest = {
  topic: string;
  article: string;
};

export type AnalyzeTask = {
  task_id: string;
  status: string;
};

export type ScoreResult = {
  id: number;
  topic: string;
  article: string;
  relevance_score: number;
  confidence_score: number;
  short_reason: string;
  created_at: string;
};

export type TaskStatus = {
  task_id: string;
  status: string;
  result: ScoreResult | { error: string } | null;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/fastapi";
const SERVER_API_BASE_URL =
  process.env.FASTAPI_BASE_URL ??
  (process.env.FASTAPI_HOSTPORT ? `http://${process.env.FASTAPI_HOSTPORT}` : "http://127.0.0.1:8000");

async function parseApiResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload.detail === "string"
        ? payload.detail
        : "Request failed. Check that the FastAPI backend, Redis, and Celery worker are running.";
    throw new Error(message);
  }

  return payload as T;
}

export async function analyzeArticle(request: AnalyzeRequest): Promise<AnalyzeTask> {
  const response = await fetch(`${API_BASE_URL}/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  return parseApiResponse<AnalyzeTask>(response);
}

export async function getTaskStatus(taskId: string): Promise<TaskStatus> {
  const response = await fetch(`${API_BASE_URL}/task/${taskId}`, {
    cache: "no-store",
  });

  return parseApiResponse<TaskStatus>(response);
}

export async function getScores(): Promise<ScoreResult[]> {
  const response = await fetch(`${SERVER_API_BASE_URL}/scores`, {
    cache: "no-store",
  });

  return parseApiResponse<ScoreResult[]>(response);
}

export async function deleteScore(scoreId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/scores/${scoreId}`, {
    method: "DELETE",
  });

  await parseApiResponse<{ deleted: boolean }>(response);
}
