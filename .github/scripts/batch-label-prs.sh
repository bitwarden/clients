#!/usr/bin/env bash
# Runs label-pr.py in dry-run/add mode for each PR found in a JSON inpit file.
# #Usage: ./batch-label-prs.sh <input-file> [output-file]
# #Example: ./batch-label-prs.sh prs-web.json label-results.txt
#
# The input file should be a JSON array of objects with "number" and "labels" fields,
# e.g. [{"number": 123, "title": "...", "labels": [{"name": "web"}], ...}, ...]
# Requirements: python3, jq, gh (authenticated)

set -euo pipefail

INPUT_FILE="${1:?Usage: $0 <input-json> [output-file]}"
OUTPUT_FILE="${2:-label-results.txt}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ ! -f "$INPUT_FILE" ]; then
  echo "Error: Input file '$INPUT_FILE' not found" >&2
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo "Error: jq is required but not installed" >&2
  exit 1
fi

> "$OUTPUT_FILE"

TOTAL=$(jq 'length' "$INPUT_FILE")
COUNT=0

jq -c '.[]' "$INPUT_FILE" | while IFS= read -r PR_JSON; do
  PR_NUMBER=$(echo "$PR_JSON" | jq -r '.number')
  LABELS=$(echo "$PR_JSON" | jq -c '[.labels[].name]')

  COUNT=$((COUNT + 1))
  echo "[$COUNT/$TOTAL] Processing PR #${PR_NUMBER} (existing labels: $LABELS)..." >&2

  {
    echo "======================================"
    echo "PR #${PR_NUMBER}"
    echo "======================================"
    # python3 "$SCRIPT_DIR/label-pr.py" "$PR_NUMBER" "$LABELS" -d 2>&1 || echo "ERROR: Failed to process PR #${PR_NUMBER}"
    python3 "$SCRIPT_DIR/label-pr.py" "$PR_NUMBER" "$LABELS" 2>&1 || echo "ERROR: Failed to process PR #${PR_NUMBER}"
    echo ""
  } >> "$OUTPUT_FILE"

done

echo "Done. Results written to $OUTPUT_FILE" >&2
