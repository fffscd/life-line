#!/bin/sh

set -eu

REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$REPO_ROOT"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  printf '%s\n' "Current directory is not a Git repository." >&2
  exit 1
fi

if [ -z "$(git status --porcelain)" ]; then
  printf '%s\n' "No changes detected. Nothing to commit."
  exit 0
fi

COMMIT_MESSAGE=$(date '+%m%d')

git add -A

if git diff --cached --quiet; then
  printf '%s\n' "No staged changes to commit."
  exit 0
fi

git commit -m "$COMMIT_MESSAGE"
