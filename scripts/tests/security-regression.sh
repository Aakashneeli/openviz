#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

echo "[security] secret audit"
bash scripts/security/audit-secrets.sh

echo "[security] worker auth/origin enforcement regression checks"
rg -q "const originResult = validateOrigin\(request, env\);" cloudflare-worker/src/index.ts
rg -q "const authResult = validateAppAuth\(request, env\);" cloudflare-worker/src/index.ts
rg -q "return errorResponse\(authResult.message, authResult.status, env\);" cloudflare-worker/src/index.ts

# CORS must fail closed when ALLOWED_ORIGIN is missing.
rg -q "ALLOWED_ORIGIN not configured" cloudflare-worker/src/index.ts

echo "[security] passed"
