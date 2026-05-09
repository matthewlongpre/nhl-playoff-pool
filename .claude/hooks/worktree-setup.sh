#!/usr/bin/env bash
# WorktreeCreate hook — creates the git worktree (replacing Claude's default),
# then copies .env from the project root into the new worktree if one exists.
#
# Input (stdin): JSON with { worktree_path, base_branch }
# Output (stdout): worktree_path (required by Claude Code)
# Exit non-zero to abort worktree creation.

set -euo pipefail

INPUT=$(cat)
WORKTREE_PATH=$(printf '%s' "$INPUT" | jq -r '.worktree_path')
BASE_BRANCH=$(printf '%s' "$INPUT" | jq -r '.base_branch')

# Derive a branch name from the worktree directory name (e.g. "kind-dirac-7dc78d").
BRANCH=$(basename "$WORKTREE_PATH")

# Create a new branch off base_branch and add the worktree.
# Fall back to checking out base_branch directly if the branch already exists.
git -C "$CLAUDE_PROJECT_DIR" worktree add -b "$BRANCH" "$WORKTREE_PATH" "$BASE_BRANCH" 2>/dev/null \
  || git -C "$CLAUDE_PROJECT_DIR" worktree add "$WORKTREE_PATH" "$BASE_BRANCH"

# Copy .env from project root into the new worktree (silent no-op if absent).
if [ -f "$CLAUDE_PROJECT_DIR/.env" ]; then
  cp "$CLAUDE_PROJECT_DIR/.env" "$WORKTREE_PATH/.env"
fi

printf '%s\n' "$WORKTREE_PATH"
