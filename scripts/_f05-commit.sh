#!/usr/bin/env bash
# One-time helper: clears the stale git lock, switches to the F-05 branch,
# commits the new files, and pushes. Run from the repo root:
#   bash scripts/_f05-commit.sh
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

LOCK="$REPO/.git/index.lock"
if [ -f "$LOCK" ]; then
  echo "Removing stale lock: $LOCK"
  rm -f "$LOCK"
fi

echo "Switching to feature/f05-snapshot-cron…"
git checkout feature/f05-snapshot-cron

echo "Staging files…"
git add .github/workflows/refresh-snapshots.yml
git add scripts/generate-all-snapshots.ts
git add package.json package-lock.json

echo "Committing…"
git commit -m "F-05: Nightly snapshot refresh GitHub Action + generate-all-snapshots script"

echo "Pushing…"
git push -u origin feature/f05-snapshot-cron

echo ""
echo "Done. Branch pushed: feature/f05-snapshot-cron"
echo "Commit: $(git rev-parse HEAD)"
