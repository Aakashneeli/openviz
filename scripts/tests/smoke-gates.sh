#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

echo "[smoke] frontend lint"
npm run lint --prefix frontend

echo "[smoke] frontend build"
npm run build --prefix frontend

echo "[smoke] backend typecheck"
npm run typecheck --prefix backend

echo "[smoke] shared typecheck"
./backend/node_modules/.bin/tsc --noEmit -p packages/shared/tsconfig.json

echo "[smoke] passed"
