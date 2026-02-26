#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

CHECK_LOCAL_ENV=false
if [[ "${1:-}" == "--check-local-env" ]]; then
  CHECK_LOCAL_ENV=true
fi

SECRET_PATTERN='(gsk_[A-Za-z0-9]{20,}|sk-ant-[A-Za-z0-9_\-]{20,}|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})'
failures=0

echo "[security] scanning tracked files for hard-coded secrets..."
tracked_matches="$(git grep -nI -E "$SECRET_PATTERN" -- . || true)"
if [[ -n "$tracked_matches" ]]; then
  echo "[security] found potential secrets in tracked files:"
  echo "$tracked_matches"
  failures=$((failures + 1))
else
  echo "[security] no hard-coded secrets detected in tracked files."
fi

echo "[security] checking that .env is not tracked..."
if git ls-files --error-unmatch .env >/dev/null 2>&1; then
  echo "[security] ERROR: .env is tracked by git. Remove it from version control immediately."
  failures=$((failures + 1))
else
  echo "[security] .env is not tracked."
fi

if [[ "$CHECK_LOCAL_ENV" == true ]]; then
  echo "[security] checking local .env for live-looking credentials..."
  if [[ -f .env ]]; then
    local_matches="$(rg -n -e "$SECRET_PATTERN" .env || true)"
    if [[ -n "$local_matches" ]]; then
      echo "[security] found live-looking credentials in local .env. Rotate/revoke these keys now."
      echo "$local_matches"
      failures=$((failures + 1))
    else
      echo "[security] local .env does not contain known secret patterns."
    fi
  else
    echo "[security] local .env not found; skipping local secret check."
  fi
fi

if [[ "$failures" -gt 0 ]]; then
  echo "[security] audit failed with $failures issue(s)."
  exit 1
fi

echo "[security] audit passed."
