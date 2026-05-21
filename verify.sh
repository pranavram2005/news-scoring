#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8000}"

response="$(
  curl -fsS -X POST "$BASE_URL/analyze" \
    -H "Content-Type: application/json" \
    -d '{
      "topic": "climate change",
      "article": "Climate change policy was discussed at a global summit. Leaders debated emissions targets, renewable energy investment, and the impact of rising temperatures on coastal cities."
    }'
)"

task_id="$(python -c "import json,sys; print(json.load(sys.stdin).get('task_id', ''))" <<<"$response")"

if [[ -z "$task_id" ]]; then
  echo "FAILED: response did not contain task_id" >&2
  echo "$response" >&2
  exit 1
fi

for _ in {1..30}; do
  task_response="$(curl -fsS "$BASE_URL/task/$task_id")"

  if echo "$task_response" | grep -q '"relevance_score"'; then
    echo "OK"
    exit 0
  fi

  if echo "$task_response" | grep -q '"status":"FAILURE"'; then
    echo "FAILED: task failed" >&2
    echo "$task_response" >&2
    exit 1
  fi

  sleep 2
done

echo "FAILED: task did not complete with relevance_score" >&2
echo "$task_response" >&2
exit 1
