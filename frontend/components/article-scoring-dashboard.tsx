"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Send, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { analyzeArticle, getTaskStatus, ScoreResult } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type SubmissionState = "idle" | "queued" | "processing" | "complete" | "failed";

const POLL_INTERVAL_MS = 2000;
const INITIAL_POLL_DELAY_MS = 1000;
const MAX_POLL_DURATION_MS = 120000;

export function ArticleScoringDashboard() {
  const [topic, setTopic] = useState("");
  const [article, setArticle] = useState("");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<SubmissionState>("idle");
  const [taskStatus, setTaskStatus] = useState<string | null>(null);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<number | null>(null);
  const pollStartedAt = useRef<number | null>(null);

  const isBusy = status === "queued" || status === "processing";
  const canSubmit = topic.trim().length > 0 && article.trim().length > 0 && !isBusy;

  const statusText = useMemo(() => {
    if (status === "queued") return "Queued for analysis";
    if (status === "processing") return taskStatus === "STARTED" ? "Scoring article" : "Waiting for worker";
    if (status === "complete") return "Analysis complete";
    if (status === "failed") return "Analysis failed";
    return "Ready";
  }, [status, taskStatus]);

  useEffect(() => {
    return () => {
      clearPollTimer();
    };
  }, []);

  function clearPollTimer() {
    if (pollTimer.current) {
      window.clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }

  function failTask(message: string) {
    clearPollTimer();
    setError(message);
    setStatus("failed");
  }

  function schedulePoll(nextTaskId: string) {
    pollTimer.current = window.setTimeout(() => pollTask(nextTaskId), POLL_INTERVAL_MS);
  }

  async function pollTask(nextTaskId: string) {
    pollTimer.current = null;

    const startedAt = pollStartedAt.current ?? Date.now();
    pollStartedAt.current = startedAt;

    if (Date.now() - startedAt >= MAX_POLL_DURATION_MS) {
      failTask("Analysis timed out while waiting for the task to finish.");
      return;
    }

    try {
      const task = await getTaskStatus(nextTaskId);
      setTaskStatus(task.status);

      switch (task.status) {
        case "PENDING":
          setStatus("queued");
          schedulePoll(nextTaskId);
          return;
        case "STARTED":
          setStatus("processing");
          schedulePoll(nextTaskId);
          return;
        case "SUCCESS":
          if (task.result && "relevance_score" in task.result) {
            setResult(task.result);
            setStatus("complete");
            return;
          }
          failTask("The scoring task completed without a valid result.");
          return;
        case "FAILURE": {
          const message =
            task.result && "error" in task.result ? task.result.error : "The scoring task failed.";
          failTask(message);
          return;
        }
        default:
          failTask(`Unexpected task status: ${task.status}`);
          return;
      }
    } catch (err) {
      failTask(err instanceof Error ? err.message : "Unable to fetch task status.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    clearPollTimer();

    setError(null);
    setResult(null);
    setTaskId(null);
    setTaskStatus(null);
    pollStartedAt.current = null;
    setStatus("queued");

    try {
      const task = await analyzeArticle({ topic: topic.trim(), article: article.trim() });
      setTaskId(task.task_id);
      setTaskStatus(task.status);
      setStatus(task.status === "PENDING" ? "queued" : "processing");
      pollStartedAt.current = Date.now();
      pollTimer.current = window.setTimeout(() => pollTask(task.task_id), INITIAL_POLL_DELAY_MS);
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
          <form
            onSubmit={handleSubmit}
            className="rounded-lg border border-border bg-white p-5 shadow-sm"
          >
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
                <p className="text-sm text-muted-foreground">
                  {taskId ? `Task ${taskId}` : "No task queued"}
                </p>
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
                <p className="text-sm text-muted-foreground">{taskStatus ?? statusText}</p>
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
