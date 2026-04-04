#!/usr/bin/env bash
# Generates per-client release notes by filtering merged PRs by client label.
# Usage: ./generate-release-notes.sh <client> <release_config>
# Example: ./generate-release-notes.sh web ../release.yml
#
# Requirements: gh (authenticated), jq, yq, git (with tags fetched)

set -euo pipefail

CLIENT="${1:?Usage: $0 <client> (web, browser, desktop, cli)}"

# Internal variables that can be overridden for testing
GH_REPO="bitwarden/clients"
RELEASE_CONFIG_PATH=".github/release.yml"
TARGET_TAG="HEAD"

# Override for testing - comment out for normal use
# PREV_TAG="${CLIENT}-v2026.2.0"
# TARGET_TAG="${CLIENT}-v2026.3.0"

# Parse .github/release.yml into JSON for use by jq
RELEASE_CONFIG=$(yq -o=json '.changelog' "$RELEASE_CONFIG_PATH") || {
  echo "Error: Failed to parse release config from $RELEASE_CONFIG_PATH" >&2
  exit 1
}

# Find the most recent tag for this client
if [ -z "${PREV_TAG:-}" ]; then
  PREV_TAG=$(git tag -l --sort=-authordate | grep "^${CLIENT}-v" | head -n 1)
fi

if [ -z "$PREV_TAG" ]; then
  echo "No previous tag found for client '${CLIENT}'" >&2
  exit 1
fi

echo "Previous tag: $PREV_TAG" >&2

# Extract PR numbers from commit messages between the previous tag and HEAD.
# This ensures we only capture PRs whose commits are actually on this branch,
# rather than all PRs merged after a date (which could include other branches).
PR_NUMBERS=$(git log "${PREV_TAG}..${TARGET_TAG}" --oneline | grep -oE '\(#[0-9]+\)' | grep -oE '[0-9]+' | sort -u)

if [ -z "$PR_NUMBERS" ]; then
  echo "No PRs found in commit history since $PREV_TAG" >&2
  echo "No changes for this release."
  exit 0
fi

PR_COUNT=$(echo "$PR_NUMBERS" | wc -l | tr -d ' ')
echo "Found $PR_COUNT PRs in commit history since $PREV_TAG" >&2

# Fetch PR details via GitHub GraphQL API in batches
# (GitHub GraphQL queries have a complexity limit, so we batch by 100)
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

  # Normalize GraphQL response to match the previous JSON structure:
  # [ { number, title, labels: [{name}], author: {login} } ]
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

echo "Fetched details for $(echo "$PRS" | jq 'length') PRs" >&2

# Filter and categorize PRs using the release.yml config
MARKDOWN=$(jq -r -n \
  --arg client "$CLIENT" \
  --argjson config "$RELEASE_CONFIG" \
  --argjson prs "$PRS" '

  ($config.exclude.labels // []) as $exclude_labels |
  ($config.categories // []) as $categories |

  # Filter out PRs with excluded labels
  [ $prs[] | select(.labels | map(.name) | any(. as $l | $exclude_labels | index($l)) | not) ] |

  # Filter by client label: if a PR has any client label, it must match the current client
  ["web", "browser", "desktop", "cli"] as $client_labels |
  [ .[] | select(
    (.labels | map(.name)) as $pr_labels |
    ($pr_labels | any(. as $l | $client_labels | index($l))) as $has_client_label |
    if $has_client_label then ($pr_labels | index($client) != null)
    else true
    end
  ) ] |

  # Iterate categories in order, assign each PR to first matching category
  . as $filtered_prs |
  reduce ($categories | to_entries[]) as $entry (
    { used: [], sections: [] };
    .used as $used_numbers |
    $entry.value as $cat |
    [
      $filtered_prs[] |
      select(.number as $n | $used_numbers | index($n) | not) |
      select(
        ($cat.labels | index("*")) or
        (.labels | map(.name) | any(. as $l | $cat.labels | index($l)))
      )
    ] as $matched |
    .sections += [{ title: $cat.title, prs: $matched }] |
    .used += [ $matched[].number ]
  ) |

  # Render markdown, skip empty sections
  [ .sections[] | select(.prs | length > 0) |
    "### \(.title)\n" + (
      [ .prs[] | "- \(.title) by @\(.author.login) in [#\(.number)](https://github.com/bitwarden/clients/pull/\(.number))" ] | join("\n")
    )
  ] | join("\n\n")
')

OUTPUT_FILE="${CLIENT}-release-notes.md"

if [ -z "$MARKDOWN" ]; then
  echo "No changes for this release."
else
  echo "$MARKDOWN" | tee "$OUTPUT_FILE"
fi

echo "Release notes written to $OUTPUT_FILE" >&2
