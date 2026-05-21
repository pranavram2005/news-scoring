import { HistoryResults } from "@/components/history-results";
import { getScores, type ScoreResult } from "@/lib/api";

export default async function HistoryPage() {
  let scores: ScoreResult[] = [];
  let error: string | null = null;

  try {
    scores = await getScores();
  } catch (err) {
    error = err instanceof Error ? err.message : "Unable to load saved scores.";
  }

  return <HistoryResults initialScores={scores} initialError={error} />;
}
