#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

echo "[tests] running security regression tests"
bash scripts/tests/security-regression.sh

echo "[tests] running mark-mapping regression tests"
bash scripts/tests/mark-mapping-regression.sh

echo "[tests] running smoke gates"
bash scripts/tests/smoke-gates.sh

echo "[tests] all checks passed"
