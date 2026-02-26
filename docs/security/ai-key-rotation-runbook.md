# AI Key Rotation Runbook

This runbook covers rotating OpenViz AI credentials for local development and deployed services.

## Scope

- Browser/app environment variables (`VITE_*`)
- Cloudflare Worker secrets (`GROQ_API_KEY`, `APP_AUTH_TOKEN`)

## Step 1: Revoke and regenerate provider keys

1. Revoke old keys in each provider console (Groq/OpenAI/Anthropic).
2. Generate new keys with least-privilege access.
3. Record rotation timestamp in your internal ops log.

## Step 2: Update local environment

1. Update `.env` values locally.
2. Keep `VITE_ALLOW_INSECURE_DIRECT_AI=false` unless you are explicitly testing localhost direct mode.
3. Run:

```bash
bash scripts/security/audit-secrets.sh --check-local-env
```

## Step 3: Update deployed Cloudflare secrets

From `cloudflare-worker/`:

```bash
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put APP_AUTH_TOKEN
```

Deploy after updating secrets:

```bash
npm run deploy
```

## Step 4: Verify runtime behavior

1. Confirm frontend uses proxy mode (`VITE_AI_PROXY_URL` + `VITE_AI_PROXY_AUTH_TOKEN`).
2. Confirm worker rejects missing/invalid app token with `401`.
3. Confirm CORS allows only configured `ALLOWED_ORIGIN`.

## Step 5: Post-rotation validation

1. Run `bash scripts/security/audit-secrets.sh` to validate tracked files are clean.
2. Confirm no sensitive values appear in commit diffs or logs.
3. Update the project plan/log with the rotation completion date.
