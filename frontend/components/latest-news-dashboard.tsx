"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import {
  Activity,
  Clock,
  ExternalLink,
  Newspaper,
  RefreshCw,
  Search,
  Signal,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import {
  analyzeNewsArticle,
  getNewsPreviews,
  type LatestNewsArticle,
  type NewsPreviewArticle,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LatestNewsDashboardProps = {
  initialArticles: DisplayNewsArticle[];
  initialError: string | null;
};

type DisplayNewsArticle = NewsPreviewArticle | LatestNewsArticle;
const NEWS_CATEGORIES = ["Sports", "Business", "Technology", "Science", "Health", "Entertainment", "World", "Finance"];
const DEFAULT_NEWS_IMAGE_URL = "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1080&q=80";
const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  business: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1080&q=80",
  finance: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1080&q=80",
  sports: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1080&q=80",
  technology: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1080&q=80",
  science: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1080&q=80",
  health: "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1080&q=80",
  entertainment: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1080&q=80",
  world: "https://images.unsplash.com/photo-1521295121783-8a321d551ad2?auto=format&fit=crop&w=1080&q=80",
};

function hasScore(article: DisplayNewsArticle): article is LatestNewsArticle {
  return "relevance_score" in article;
}

export function LatestNewsDashboard({
  initialArticles,
  initialError,
}: LatestNewsDashboardProps) {
  const [articles, setArticles] = useState(initialArticles);
  const [error, setError] = useState(initialError);
  const [activeCategory, setActiveCategory] = useState("Business");
  const [customCategory, setCustomCategory] = useState("");
  const [loadingCategory, setLoadingCategory] = useState<string | null>(null);

  const summary = useMemo(() => {
    const scoredArticles = articles.filter(hasScore);
    const averageRelevance =
      scoredArticles.length > 0
        ? Math.round(scoredArticles.reduce((total, article) => total + article.relevance_score, 0) / scoredArticles.length)
        : 0;
    const highRelevance = scoredArticles.filter((article) => article.relevance_score >= 76).length;
    const latestPublishedAt = articles[0]?.published_at
      ? new Date(articles[0].published_at).toLocaleString()
      : "No articles";

    return { averageRelevance, highRelevance, latestPublishedAt };
  }, [articles]);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f6faf8_0%,#ffffff_40%,#f8fafc_100%)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Live News Ingestion</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground sm:text-3xl">
              Latest News
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Fresh articles fetched on demand, scored with Groq only when you choose, and enriched with topic images.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline">
              <Link href="/score">
                <Activity className="h-4 w-4" />
                Score Article
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/history">
                <Clock className="h-4 w-4" />
                History
              </Link>
            </Button>
            <Button asChild>
              <Link href="/">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Link>
            </Button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryTile icon={Newspaper} label="Articles" value={articles.length.toString()} />
          <SummaryTile icon={Activity} label="Avg relevance" value={summary.averageRelevance ? `${summary.averageRelevance}` : "-"} />
          <SummaryTile icon={Signal} label="Scored high" value={summary.highRelevance.toString()} />
          <SummaryTile icon={Clock} label="Latest published" value={summary.latestPublishedAt} compact />
        </section>

        <section className="rounded-lg border border-border bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {NEWS_CATEGORIES.map((category) => (
                <Button
                  key={category}
                  type="button"
                  variant={activeCategory === category ? "default" : "outline"}
                  size="sm"
                  disabled={loadingCategory !== null}
                  onClick={() => loadCategory(category)}
                >
                  {category}
                </Button>
              ))}
            </div>
            <form onSubmit={handleCustomCategory} className="flex min-w-0 gap-2 lg:w-80">
              <Input
                value={customCategory}
                onChange={(event) => setCustomCategory(event.target.value)}
                placeholder="Enter news topic"
                disabled={loadingCategory !== null}
              />
              <Button type="submit" disabled={loadingCategory !== null || customCategory.trim().length === 0}>
                <Search className="h-4 w-4" />
                Enter
              </Button>
            </form>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {loadingCategory ? `Fetching 9 recent ${loadingCategory} articles...` : `Previewing 9 recent ${activeCategory} articles. Save happens only after Show relevance.`}
          </p>
        </section>

        {error ? (
          <div className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive shadow-sm">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        ) : null}

        <section className="grid gap-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {articles.length > 0 ? (
              articles.map((article) => (
                <ArticleCard
                  key={article.url}
                  article={article}
                  topic={activeCategory}
                  onAnalyzed={(analyzedArticle) =>
                    setArticles((currentArticles) =>
                      currentArticles.map((currentArticle) =>
                        currentArticle.url === analyzedArticle.url ? analyzedArticle : currentArticle,
                      ),
                    )
                  }
                />
              ))
            ) : (
              <div className="rounded-lg border border-border bg-white p-10 text-center shadow-sm md:col-span-2 xl:col-span-3">
                <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-muted-foreground">
                  <div className="rounded-md bg-muted p-3">
                    <Newspaper className="h-5 w-5" />
                  </div>
                  <p className="font-medium text-foreground">No live news articles found</p>
                  <p className="text-sm">Choose a category or enter a topic to fetch recent articles.</p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );

  async function handleCustomCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextCategory = customCategory.trim();
    if (!nextCategory) return;

    await loadCategory(nextCategory);
  }

  async function loadCategory(category: string) {
    setActiveCategory(category);
    setLoadingCategory(category);
    setError(null);

    try {
      setArticles(sortArticlesByImage(await getNewsPreviews(category, 9)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to fetch recent news.");
    } finally {
      setLoadingCategory(null);
    }
  }
}

function sortArticlesByImage<T extends DisplayNewsArticle>(articles: T[]): T[] {
  return [...articles].sort((left, right) => Number(Boolean(right.image_url)) - Number(Boolean(left.image_url)));
}

function ArticleCard({
  article,
  topic,
  onAnalyzed,
}: {
  article: DisplayNewsArticle;
  topic: string;
  onAnalyzed: (article: LatestNewsArticle) => void;
}) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleShowRelevance() {
    setIsAnalyzing(true);
    setError(null);

    try {
      onAnalyzed(await analyzeNewsArticle(`${topic} news`, article));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to analyze this article.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
      <img
        src={article.image_url || fallbackImageForCategory(hasScore(article) ? article.topic : topic)}
        alt=""
        className="h-48 w-full bg-muted object-cover sm:h-56"
        loading="lazy"
      />
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-md bg-muted px-2 py-1 font-medium text-foreground">
              {article.source ?? "Unknown source"}
            </span>
            <span>{article.published_at ? new Date(article.published_at).toLocaleString() : "No published date"}</span>
          </div>
          <h2 className="text-lg font-semibold leading-7 text-foreground">{article.title}</h2>
        </div>

        {hasScore(article) ? (
          <div className="grid grid-cols-2 gap-3">
            <ScoreBox label="Relevance" value={article.relevance_score} />
            <ScoreBox label="Confidence" value={article.confidence_score} muted />
          </div>
        ) : (
          <Button type="button" onClick={handleShowRelevance} disabled={isAnalyzing}>
            {isAnalyzing ? "Analyzing" : "Show relevance"}
          </Button>
        )}

        <div className="space-y-2">
          {hasScore(article) ? <p className="text-sm leading-6 text-muted-foreground">{article.short_reason}</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <p className="line-clamp-3 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
            {article.article}
          </p>
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="inline-flex w-fit rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-sm font-medium text-primary">
            {hasScore(article) ? article.topic : `${topic} news`}
          </span>
          <Button asChild variant="outline" size="sm">
            <a href={article.url} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
              Open
            </a>
          </Button>
        </div>
      </div>
    </article>
  );
}

function fallbackImageForCategory(category: string): string {
  const normalizedCategory = category.toLowerCase();
  for (const [key, imageUrl] of Object.entries(CATEGORY_FALLBACK_IMAGES)) {
    if (normalizedCategory.includes(key)) {
      return imageUrl;
    }
  }

  return DEFAULT_NEWS_IMAGE_URL;
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  compact = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-md bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
      <p className={compact ? "mt-3 text-sm font-semibold text-foreground" : "mt-3 text-2xl font-semibold text-foreground"}>
        {value}
      </p>
    </div>
  );
}

function ScoreBox({ label, value, muted = false }: { label: string; value: number; muted?: boolean }) {
  const style = muted
    ? "border-slate-200 bg-slate-50 text-slate-700"
    : value >= 76
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : value >= 51
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-rose-200 bg-rose-50 text-rose-700";

  return (
    <div className={`rounded-md border p-3 ${style}`}>
      <p className="text-xs font-medium">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
