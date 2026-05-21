# News Article Scoring API

A minimal FastAPI backend for scoring how relevant a news article is to a given topic using Groq and storing results in local PostgreSQL.

## Features

- `POST /analyze` endpoint
- `GET /task/{task_id}` endpoint
- `GET /scores` endpoint
- Pydantic request and response schemas
- Groq LLM relevance scoring with `llama-3.3-70b-versatile`
- Local PostgreSQL persistence with SQLAlchemy ORM
- Redis message broker
- Celery background task processing
- Alembic migrations for database schema changes
- Uvicorn development server

## Project Structure

```text
app/
  celery_app.py
  database.py
  db/
    database.py
    models/
      article_score.py
    repositories/
      article_scores.py
  main.py
  schemas.py
  services/
    scoring_service.py
  tasks/
    article_scoring.py
  redis_client.py
alembic/
  env.py
  versions/
alembic.ini
.env.example
requirements.txt
README.md
verify.sh
frontend/
  app/
  components/
  lib/
  package.json
```

## Setup

Create and activate a virtual environment:

```bash
python -m venv .venv
.venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create a local PostgreSQL database:

```bash
createdb news_scoring
```

Create a `.env` file:

```bash
cp .env.example .env
```

Configure `.env`:

```text
DATABASE_URL=postgresql+psycopg://postgres:admin@localhost:5433/news_scoring
REDIS_URL=redis://localhost:6379/0
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
```

Update the username, password, host, port, or database name if your local PostgreSQL setup differs.
Start Redis locally and update `REDIS_URL` if it is not running on `localhost:6379`.
`GROQ_MODEL` is optional. The app defaults to `llama-3.3-70b-versatile`.

Run database migrations:

```bash
python -m alembic upgrade head
```

Run the server:

```bash
uvicorn app.main:app --reload
```

Run the Celery worker in a separate terminal:

```bash
python -m celery -A app.celery_app.celery_app worker --loglevel=info
```

On Windows, use the solo pool:

```bash
python -m celery -A app.celery_app.celery_app worker --loglevel=info --pool=solo
```

The API will be available at:

```text
http://127.0.0.1:8000
```

Interactive API docs:

```text
http://127.0.0.1:8000/docs
```

## Frontend Dashboard

The Next.js dashboard lives in `frontend/` and uses App Router, TailwindCSS, and shadcn/ui-style components.

Install dependencies:

```bash
cd frontend
npm install
```

Create an optional frontend env file:

```bash
cp .env.example .env.local
```

By default, the frontend proxies `/fastapi/*` to `http://127.0.0.1:8000/*`.
To point the proxy at a different backend, set:

```text
NEXT_PUBLIC_API_BASE_URL=/fastapi
FASTAPI_BASE_URL=http://127.0.0.1:8000
```

Run the dashboard:

```bash
npm run dev
```

The dashboard will be available at:

```text
http://127.0.0.1:3000
```

Previous saved scores are available at:

```text
http://127.0.0.1:3000/history
```

## Analyze Endpoint

`POST /analyze`

Example request:

```json
{
  "topic": "climate change",
  "article": "Climate change policy was discussed at the summit. Climate action remains a major priority."
}
```

Example response:

```json
{
  "task_id": "2d6db24e-681f-41d7-bf31-2c28abda3f31",
  "status": "PENDING"
}
```

The endpoint enqueues a Celery task and returns immediately. The worker scores the article with Groq and saves the result to the local PostgreSQL `article_scores` table.

## Task Endpoint

`GET /task/{task_id}`

Returns the current task status and the result once complete.

Example completed response:

```json
{
  "task_id": "2d6db24e-681f-41d7-bf31-2c28abda3f31",
  "status": "SUCCESS",
  "result": {
    "id": 1,
    "topic": "climate change",
    "article": "Climate change policy was discussed at the summit.",
    "relevance_score": 82,
    "confidence_score": 91,
    "short_reason": "The article directly discusses climate policy.",
    "created_at": "2026-05-20T12:00:00+05:30"
  }
}
```

## Scores Endpoint

`GET /scores`

Returns all saved scores, latest first.

Example response:

```json
[
  {
    "id": 1,
    "topic": "climate change",
    "article": "Climate change policy was discussed at the summit.",
    "relevance_score": 82,
    "confidence_score": 91,
    "short_reason": "The article directly discusses climate policy.",
    "created_at": "2026-05-20T12:00:00Z"
  }
]
```

## Database

The backend stores each analysis in one local PostgreSQL table:

- `article_scores`: `id`, `topic`, `article`, `relevance_score`, `confidence_score`, `short_reason`, `created_at`

Database connection/session setup lives in `app/database.py`, ORM models live in
`app/db/models/`, and SQLAlchemy query logic lives in `app/db/repositories/` so database
logic stays separated from FastAPI routes and the Groq scoring service.

## Verify

With the server running, execute:

```bash
./verify.sh
```

The script calls `POST /analyze`, polls `GET /task/{task_id}`, checks that the completed task result contains `relevance_score`, and prints `OK` on success.
On Windows, run it from Git Bash or WSL; plain PowerShell cannot execute `.sh` scripts directly.

## Free Render Deployment

For a free Render deployment, run scoring directly in FastAPI instead of using Celery. This avoids a paid background worker and Redis service.

Backend web service:

```text
Runtime: Python
Build command: pip install -r requirements.txt
Start command: python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT
Health check path: /health
```

Backend environment variables:

```text
DATABASE_URL=postgresql+psycopg://...
GROQ_API_KEY=...
GROQ_MODEL=llama-3.3-70b-versatile
USE_CELERY=false
```

Frontend web service:

```text
Root directory: frontend
Runtime: Node
Build command: npm ci && npm run build
Start command: npm start
```

Frontend environment variables:

```text
NEXT_PUBLIC_API_BASE_URL=/fastapi
FASTAPI_BASE_URL=https://your-backend-service.onrender.com
```

Run migrations against Supabase before testing the deployed app:

```bash
python -m alembic upgrade head
```
