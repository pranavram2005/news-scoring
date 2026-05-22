# News Article Scoring API

FastAPI + PostgreSQL app for fetching recent news previews, scoring selected articles with Groq, and saving only the articles you choose.

## Features

- `GET /news?category=Business&limit=9` fetches recent unsaved news previews.
- `POST /analyze-news` scores and saves one selected news article.
- `POST /analyze` scores manually pasted article text and saves it.
- `GET /scores` and `GET /latest-news` read saved results.
- `DELETE /scores/{score_id}` deletes one result.
- `DELETE /scores` deletes all saved results.
- Unsplash images are fetched by title, then category, with category-specific fallback images.
- No Redis or Celery required.

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

Configure `.env`:

```text
DATABASE_URL=postgresql+psycopg://postgres:admin@localhost:5433/news_scoring
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile

NEWS_API_PROVIDER=gnews
GNEWS_API_KEY=your_gnews_key_here
# Or:
# NEWS_API_PROVIDER=newsapi
# NEWSAPI_API_KEY=your_newsapi_key_here

UNSPLASH_ACCESS_KEY=your_unsplash_access_key_here
NEWS_LANGUAGE=en
```

Run migrations:

```bash
python -m alembic upgrade head
```

Run the backend:

```bash
python -m uvicorn app.main:app --reload
```

API docs:

```text
http://127.0.0.1:8000/docs
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend URL:

```text
http://127.0.0.1:3000
```

Pages:

- `/` latest news category picker
- `/score` manual article scoring
- `/history` saved scores

Optional frontend env:

```text
NEXT_PUBLIC_API_BASE_URL=/fastapi
FASTAPI_BASE_URL=http://127.0.0.1:8000
```

## Deploy

Deploy as two services plus PostgreSQL:

1. PostgreSQL database
2. FastAPI backend service
3. Next.js frontend service

Backend build command:

```bash
pip install -r requirements.txt && python -m alembic upgrade head
```

Backend start command:

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Backend environment variables:

```text
DATABASE_URL=postgresql+psycopg://...
GROQ_API_KEY=...
GROQ_MODEL=llama-3.3-70b-versatile
NEWS_API_PROVIDER=gnews
GNEWS_API_KEY=...
UNSPLASH_ACCESS_KEY=...
```

Frontend root directory:

```text
frontend
```

Frontend build command:

```bash
npm ci && npm run build
```

Frontend start command:

```bash
npm start
```

Frontend environment variables:

```text
NEXT_PUBLIC_API_BASE_URL=/fastapi
FASTAPI_BASE_URL=https://your-backend-service.onrender.com
```
