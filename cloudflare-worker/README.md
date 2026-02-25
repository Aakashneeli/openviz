# OpenViz AI Proxy (Cloudflare Worker)

This Cloudflare Worker securely proxies AI requests to the Groq API, keeping API keys secure on the server side.

## Features

- **API Key Security**: API key stored as a Worker secret (never exposed to browser)
- **App Token Auth**: Requires an app-level bearer token for every proxy request
- **Rate Limiting**: 100 requests/hour per IP (configurable)
- **CORS Support**: Configured for your frontend domain
- **Retry Hints**: Returns `Retry-After` header on rate limits
- **Streaming Support**: Supports SSE streaming responses

## Setup

### 1. Install Dependencies

```bash
cd cloudflare-worker
npm install
```

### 2. Configure Wrangler

Edit `wrangler.toml` to set your production domain:

```toml
[env.production]
vars = { ALLOWED_ORIGIN = "https://your-production-domain.com" }
```

### 3. Set Required Secrets

```bash
# Set the Groq API key as a secret (it will prompt for the value)
npx wrangler secret put GROQ_API_KEY

# Set the app-level auth token used by frontend requests
npx wrangler secret put APP_AUTH_TOKEN
```

### 4. (Optional) Set Up KV for Rate Limiting

For production rate limiting with persistence:

```bash
# Create KV namespace
npx wrangler kv:namespace create RATE_LIMIT

# Add the namespace ID to wrangler.toml
# [[kv_namespaces]]
# binding = "RATE_LIMIT"
# id = "your-namespace-id-here"
```

### 5. Deploy

```bash
# Deploy to production
npm run deploy

# Or test locally first
npm run dev
```

## Usage

After deploying, update your frontend `.env`:

```env
VITE_AI_PROXY_URL=https://openviz-ai-proxy.your-subdomain.workers.dev
VITE_AI_PROXY_AUTH_TOKEN=your_openviz_proxy_auth_token_here
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `GROQ_API_KEY` | (required) | Your Groq API key (set via `wrangler secret`) |
| `APP_AUTH_TOKEN` | (required) | Shared app auth token sent as `Authorization: Bearer <token>` |
| `ALLOWED_ORIGIN` | `http://localhost:5173` | CORS allowed origin |
| `RATE_LIMIT_REQUESTS` | `100` | Max requests per window |
| `RATE_LIMIT_WINDOW_HOURS` | `1` | Rate limit window in hours |

## API

### POST /

Proxies chat completion requests to Groq API.

**Required Header:**
```http
Authorization: Bearer <APP_AUTH_TOKEN>
```

**Request Body:**
```json
{
  "model": "meta-llama/llama-4-maverick-17b-128e-instruct",
  "messages": [
    { "role": "user", "content": "Hello!" }
  ],
  "temperature": 0.7,
  "max_tokens": 1000,
  "stream": false
}
```

**Response:** Same format as Groq API response.

**Rate Limit Headers:**
- `X-RateLimit-Remaining`: Requests remaining in window
- `X-RateLimit-Reset`: Unix timestamp when limit resets

## Local Development

For local frontend development without deploying the worker:

1. Comment out `VITE_AI_PROXY_URL` in your `.env`
2. Set `VITE_GROQ_API_KEY` directly (insecure, development only)

The frontend will automatically fall back to direct Groq API calls.

## Troubleshooting

**429 Too Many Requests**: Wait for rate limit to reset or increase `RATE_LIMIT_REQUESTS`.

**500 Server Configuration Error**: Ensure `GROQ_API_KEY` secret is set.
Also ensure `APP_AUTH_TOKEN` is set.

**CORS Error**: Check `ALLOWED_ORIGIN` matches your frontend URL exactly.
