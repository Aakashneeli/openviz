#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

echo "[mark-mapping] supported mark contract exists"
rg -q "export type SupportedMarkType" packages/shared/src/types/index.ts

echo "[mark-mapping] vega mark fallback remains safe"
rg -q "function toSupportedVegaMark" backend/utils/vegaSpecBuilder.ts
rg -q "return 'bar';" backend/utils/vegaSpecBuilder.ts

echo "[mark-mapping] advanced descriptions remain implemented"
rg -q "const advancedDescriptions" packages/shared/src/utils/autoChart.ts
rg -q "treemap:" packages/shared/src/utils/autoChart.ts

echo "[mark-mapping] passed"
