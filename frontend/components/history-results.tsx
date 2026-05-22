"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Clock, Database, FileText, Newspaper, RefreshCw, Trash2, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { deleteAllScores, deleteScore, type ScoreResult } from "@/lib/api";

type HistoryResultsProps = {
  initialScores: ScoreResult[];
  initialError: string | null;
};

export function HistoryResults({ initialScores, initialError }: HistoryResultsProps) {
  const [scores, setScores] = useState(initialScores);
  const [error, setError] = useState(initialError);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);

  const summary = useMemo(() => {
    const averageRelevance =
      scores.length > 0
        ? Math.round(scores.reduce((total, score) => total + score.relevance_score, 0) / scores.length)
        : 0;
    const averageConfidence =
      scores.length > 0
        ? Math.round(scores.reduce((total, score) => total + score.confidence_score, 0) / scores.length)
        : 0;
    const latestCreatedAt = scores[0]?.created_at
      ? new Date(scores[0].created_at).toLocaleString()
      : "No records";

    return { averageRelevance, averageConfidence, latestCreatedAt };
  }, [scores]);

  async function handleDelete(scoreId: number) {
    const confirmed = window.confirm(`Delete score #${scoreId}?`);
    if (!confirmed) return;

    setDeletingId(scoreId);
    setError(null);

    try {
      await deleteScore(scoreId);
      setScores((currentScores) => currentScores.filter((score) => score.id !== scoreId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete score.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDeleteAll() {
    if (scores.length === 0 || deletingAll) return;

    const confirmed = window.confirm(`Delete all ${scores.length} saved scores and ingested news records?`);
    if (!confirmed) return;

    setDeletingAll(true);
    setError(null);

    try {
      await deleteAllScores();
      setScores([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete all scores.");
    } finally {
      setDeletingAll(false);
    }
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#eef8f5_0%,#ffffff_38%,#f8fafc_100%)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">News Article Scoring</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground sm:text-3xl">
              Previous Scores
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Stored article relevance results from the PostgreSQL scoring history.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline">
              <Link href="/score">
                <ArrowLeft className="h-4 w-4" />
                Score
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/">
                <Newspaper className="h-4 w-4" />
                Latest News
              </Link>
            </Button>
            <Button asChild>
              <Link href="/history">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={scores.length === 0 || deletingAll}
              onClick={handleDeleteAll}
              className="border-destructive/30 text-destructive hover:bg-destructive/5"
            >
              <Trash2 className="h-4 w-4" />
              {deletingAll ? "Deleting" : "Delete All"}
            </Button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryTile icon={Database} label="Records" value={scores.length.toString()} />
          <SummaryTile icon={TrendingUp} label="Avg relevance" value={summary.averageRelevance ? `${summary.averageRelevance}` : "-"} />
          <SummaryTile icon={FileText} label="Avg confidence" value={summary.averageConfidence ? `${summary.averageConfidence}` : "-"} />
          <SummaryTile icon={Clock} label="Latest" value={summary.latestCreatedAt} compact />
        </section>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive shadow-sm">
            {error}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Saved Results</h2>
              <p className="text-sm text-muted-foreground">Latest results first</p>
            </div>
            <div className="rounded-md bg-muted px-3 py-1 text-sm text-muted-foreground">
              {scores.length} total
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-semibold">ID</th>
                  <th className="px-5 py-3 font-semibold">Topic</th>
                  <th className="px-5 py-3 font-semibold">Article</th>
                  <th className="px-5 py-3 font-semibold">Relevance</th>
                  <th className="px-5 py-3 font-semibold">Confidence</th>
                  <th className="px-5 py-3 font-semibold">Reason</th>
                  <th className="px-5 py-3 font-semibold">Created</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {scores.length > 0 ? (
                  scores.map((score) => (
                    <tr key={score.id} className="align-top transition-colors hover:bg-slate-50/80">
                      <td className="px-5 py-4 font-medium text-foreground">#{score.id}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex max-w-48 items-center rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-sm font-medium text-primary">
                          {score.topic}
                        </span>
                      </td>
                      <td className="max-w-xs px-5 py-4 text-muted-foreground">
                        <p className="line-clamp-3">{score.article}</p>
                      </td>
                      <td className="px-5 py-4">
                        <ScorePill value={score.relevance_score} />
                      </td>
                      <td className="px-5 py-4">
                        <ScorePill value={score.confidence_score} muted />
                      </td>
                      <td className="max-w-sm px-5 py-4 text-muted-foreground">
                        <p className="line-clamp-3">{score.short_reason}</p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">
                        {new Date(score.created_at).toLocaleString()}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={deletingId === score.id || deletingAll}
                          onClick={() => handleDelete(score.id)}
                          className="border-destructive/30 text-destructive hover:bg-destructive/5"
                          title="Delete score"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-5 py-14 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center gap-2 text-muted-foreground">
                        <div className="rounded-full bg-muted p-3">
                          <Database className="h-5 w-5" />
                        </div>
                        <p className="font-medium text-foreground">No saved scores found</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  compact = false,
}: {
  icon: typeof Database;
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

function ScorePill({ value, muted = false }: { value: number; muted?: boolean }) {
  const style = muted
    ? "border-slate-200 bg-slate-50 text-slate-700"
    : value >= 76
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : value >= 51
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-rose-200 bg-rose-50 text-rose-700";

  return (
    <span className={`inline-flex min-w-12 justify-center rounded-md border px-2 py-1 text-sm font-semibold ${style}`}>
      {value}
    </span>
  );
}
