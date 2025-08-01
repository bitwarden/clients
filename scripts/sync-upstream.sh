#!/usr/bin/env bash
# Sync changes from the upstream repository while preserving local workflow removals.
set -euo pipefail

REMOTE="${1:-upstream}"
BRANCH="${2:-main}"

# Fetch and merge the upstream branch
git fetch "$REMOTE"
git merge "${REMOTE}/${BRANCH}" --no-edit

# Remove any workflow files added from upstream except those we track
if [ -d ".github/workflows" ]; then
  find .github/workflows -type f ! -name 'e2e.yml' -exec git rm -f {} + 2>/dev/null || true
fi

# Only create a commit if there are staged changes
if ! git diff --cached --quiet; then
  git commit -m "Remove upstream workflows"
fi
