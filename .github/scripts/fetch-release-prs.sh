#!/usr/bin/env bash
# Fetches PR details for commits between the last release tag and HEAD, writes to JSON.
# Usage: ./fetch-release-prs.sh <client> [output-file]
# Example: ./fetch-release-prs.sh web prs-web.json
#
# Requirements: gh (authenticated), jq, git (with tags fetched)

set -euo pipefail

CLIENT="${1:?Usage: $0 <client> (web, browser, desktop, cli)}"
OUTPUT_FILE="${2:-prs-${CLIENT}.json}"
GH_REPO="${GH_REPO:-bitwarden/clients}"
TARGET_TAG="HEAD"

# Override for testing - comment out for normal use
PREV_TAG="${CLIENT}-v2026.4.2"
TARGET_TAG="${CLIENT}-v2026.5.0"

# Find the most recent tag for this client (skip if already set)
if [ -z "${PREV_TAG:-}" ]; then
  PREV_TAG=$(git tag -l --sort=-authordate | grep "^${CLIENT}-v" | head -n 1)
fi

if [ -z "$PREV_TAG" ]; then
  echo "Error: No previous tag found for client '${CLIENT}'" >&2
  exit 1
fi

echo "Previous tag: $PREV_TAG" >&2

# Extract PR numbers from commit messages between the previous tag and HEAD.
# This ensures we only capture PRs whose commits are actually on this branch,
# rather than all PRs merged after a date (which could include other branches).
PR_NUMBERS=$(git log "${PREV_TAG}..${TARGET_TAG}" --oneline | grep -oE '\(#[0-9]+\)' | grep -oE '[0-9]+' | sort -u)

if [ -z "$PR_NUMBERS" ]; then
  echo "No PRs found in commit history since $PREV_TAG" >&2
  echo "[]" > "$OUTPUT_FILE"
  echo "Wrote 0 PRs to $OUTPUT_FILE" >&2
  exit 0
fi

PR_COUNT=$(echo "$PR_NUMBERS" | wc -l | tr -d ' ')
echo "Found $PR_COUNT PRs in commit history since $PREV_TAG" >&2

# Fetch PR details via GitHub GraphQL API in batches of 100
fetch_prs_batch() {
  local numbers=("$@")
  local query="query {"
  for n in "${numbers[@]}"; do
    query+=" pr_${n}: repository(owner: \"bitwarden\", name: \"clients\") { pullRequest(number: ${n}) { number title labels(first: 20) { nodes { name } } author { login } } }"
  done
  query+=" }"

  local result
  result=$(gh api graphql -f query="$query" 2>&1) || {
    echo "Error: Failed to fetch PR details from GitHub: $result" >&2
    exit 1
  }

  echo "$result" | jq '[.data | to_entries[].value.pullRequest | { number, title, labels: [.labels.nodes[] | {name}], author }]'
}

PRS="[]"
BATCH=()
while IFS= read -r num; do
  BATCH+=("$num")
  if [ "${#BATCH[@]}" -ge 100 ]; then
    BATCH_RESULT=$(fetch_prs_batch "${BATCH[@]}")
    PRS=$(jq -s '.[0] + .[1]' <(echo "$PRS") <(echo "$BATCH_RESULT"))
    BATCH=()
  fi
done <<< "$PR_NUMBERS"

# Flush remaining batch
if [ "${#BATCH[@]}" -gt 0 ]; then
  BATCH_RESULT=$(fetch_prs_batch "${BATCH[@]}")
  PRS=$(jq -s '.[0] + .[1]' <(echo "$PRS") <(echo "$BATCH_RESULT"))
fi

echo "$PRS" > "$OUTPUT_FILE"
echo "Wrote $(echo "$PRS" | jq 'length') PRs to $OUTPUT_FILE" >&2
