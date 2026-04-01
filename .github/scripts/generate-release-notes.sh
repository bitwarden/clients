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

# Parse .github/release.yml into JSON for use by jq
RELEASE_CONFIG=$(yq -o=json '.changelog' "$RELEASE_CONFIG_PATH") || {
  echo "Error: Failed to parse release config from $RELEASE_CONFIG_PATH" >&2
  exit 1
}

# Find the most recent tag for this client
PREV_TAG=$(git tag -l --sort=-authordate | grep "^${CLIENT}-v" | head -n 1)

if [ -z "$PREV_TAG" ]; then
  echo "No previous tag found for client '${CLIENT}'" >&2
  exit 1
fi

echo "Previous tag: $PREV_TAG" >&2

# Get the author date of the previous tag
PREV_DATE=$(git tag -l --format='%(authordate:iso-strict)' "$PREV_TAG")
echo "Previous tag date: $PREV_DATE" >&2

# Query merged PRs with the client label since the previous tag date
PRS=$(gh pr list \
  --repo "$GH_REPO" \
  --state merged \
  --label "$CLIENT" \
  --search "merged:>=${PREV_DATE}" \
  --json number,title,labels,author \
  --limit 500 2>&1) || {
  echo "Error: Failed to fetch PRs from GitHub: $PRS" >&2
  exit 1
}

# Filter and categorize PRs using the release.yml config
MARKDOWN=$(jq -r -n \
  --argjson config "$RELEASE_CONFIG" \
  --argjson prs "$PRS" '

  ($config.exclude.labels // []) as $exclude_labels |
  ($config.categories // []) as $categories |

  # Filter out PRs with excluded labels
  [ $prs[] | select(.labels | map(.name) | any(. as $l | $exclude_labels | index($l)) | not) ] |

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
    "## \(.title)\n" + (
      [ .prs[] | "- \(.title) by @\(.author.login) (#\(.number))" ] | join("\n")
    )
  ] | join("\n\n")
')

if [ -z "$MARKDOWN" ]; then
  echo "No changes for this release."
else
  echo "$MARKDOWN"
fi
