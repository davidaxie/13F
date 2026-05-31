#!/usr/bin/env bash
# Double-click this file in Finder (or run: bash scripts/_f05-commit.command)
# to finish the F-05 branch commit and push.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

echo "=== F-05: finishing commit + push ==="
echo "Repo: $REPO"
echo ""

# Remove stale lock if present
LOCK="$REPO/.git/index.lock"
if [ -f "$LOCK" ]; then
  echo "Removing stale git lock..."
  rm -f "$LOCK"
fi

# Switch to the F-05 branch (it already exists locally)
echo "Switching to feature/f05-snapshot-cron..."
git checkout feature/f05-snapshot-cron

# Stage the three new items
echo "Staging files..."
git add .github/workflows/refresh-snapshots.yml
git add scripts/generate-all-snapshots.ts
git add package.json package-lock.json

echo ""
echo "Files staged:"
git diff --cached --name-only

echo ""
echo "Committing..."
git commit -m "F-05: Nightly snapshot refresh GitHub Action + generate-all-snapshots script"

echo ""
echo "Pushing to origin..."
git push -u origin feature/f05-snapshot-cron

echo ""
echo "=== Done ==="
echo "Branch: feature/f05-snapshot-cron"
echo "Commit: $(git rev-parse HEAD)"
echo ""
echo "You can close this window."
read -p "Press Enter to close..."
