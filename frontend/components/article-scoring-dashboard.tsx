"use client";

import { FormEvent, useMemo, useState } from "react";
import { Loader2, Newspaper, Send, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { analyzeArticle, type ScoreResult } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type SubmissionState = "idle" | "processing" | "complete" | "failed";

export function ArticleScoringDashboard() {
  const [topic, setTopic] = useState("");
  const [article, setArticle] = useState("");
  const [status, setStatus] = useState<SubmissionState>("idle");
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isBusy = status === "processing";
  const canSubmit = topic.trim().length > 0 && article.trim().length > 0 && !isBusy;

  const statusText = useMemo(() => {
    if (status === "processing") return "Scoring article";
    if (status === "complete") return "Analysis complete";
    if (status === "failed") return "Analysis failed";
    return "Ready";
  }, [status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setResult(null);
    setStatus("processing");

    try {
      const nextResult = await analyzeArticle({ topic: topic.trim(), article: article.trim() });
      setResult(nextResult);
      setStatus("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit analysis.");
      setStatus("failed");
    }
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7faf9_0%,#ffffff_42%,#f8fafc_100%)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">News Article Scoring</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground sm:text-3xl">
              Article Relevance Dashboard
            </h1>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Link
              href="/"
              className="rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
            >
              <span className="inline-flex items-center gap-2">
                <Newspaper className="h-4 w-4" />
                Latest News
              </span>
            </Link>
            <Link
              href="/history"
              className="rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
            >
              History
            </Link>
            <div className="rounded-md border border-border bg-white px-3 py-2 text-sm text-muted-foreground shadow-sm">
              {statusText}
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-white p-5 shadow-sm">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="topic">Topic</Label>
                <Input
                  id="topic"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="climate change"
                  disabled={isBusy}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="article">Article</Label>
                <Textarea
                  id="article"
                  value={article}
                  onChange={(event) => setArticle(event.target.value)}
                  placeholder="Article text"
                  disabled={isBusy}
                />
              </div>

              <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">Direct analysis runs through FastAPI.</p>
                <Button type="submit" disabled={!canSubmit} className="sm:w-auto">
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Analyze
                </Button>
              </div>
            </div>
          </form>

          <aside className="rounded-lg border border-border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <h2 className="text-lg font-semibold">Result</h2>
                <p className="text-sm text-muted-foreground">{statusText}</p>
              </div>
              {isBusy ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : null}
            </div>

            {error ? (
              <div className="mt-5 flex gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
            ) : null}

            {result ? (
              <div className="mt-5 space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <Metric label="Relevance" value={result.relevance_score} />
                  <Metric label="Confidence" value={result.confidence_score} />
                </div>
                <div className="rounded-md bg-muted p-4">
                  <p className="text-sm font-medium">Short Reason</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{result.short_reason}</p>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-md bg-muted p-4 text-sm leading-6 text-muted-foreground">
                Awaiting analysis result.
              </div>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
