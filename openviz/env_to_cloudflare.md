# Securing Your API Key with Cloudflare Workers

## ⚠️ The Problem

When you use `VITE_GROQ_API_KEY` in the frontend `.env` file:

```env
VITE_GROQ_API_KEY=gsk_abc123...
```

**This key gets bundled into your JavaScript code.** Anyone can:
1. Open browser DevTools → Network tab → See API requests with your key
2. View page source → Find your key in the bundled JS

**Result**: Your API key can be stolen and abused, costing you money or exhausting your quota.

---

## ✅ The Solution: Cloudflare Worker Proxy

Instead of calling Groq directly from the browser, route requests through a Cloudflare Worker:

```
Browser → Cloudflare Worker (holds API key) → Groq API
```

**Benefits:**
- API key is **never exposed** to the client
- Free tier handles millions of requests
- Edge deployment = fast globally
- Rate limiting and security built-in

---

## 🚀 Setup Steps

### 1. Install Wrangler CLI

```bash
npm install -g wrangler
wrangler login
```

### 2. Configure the Worker

Your project already has `cloudflare-worker/`. Navigate there:

```bash
cd cloudflare-worker
npm install
```

### 3. Add Your Secret API Key

```bash
wrangler secret put GROQ_API_KEY
# Paste your key when prompted
```

This stores the key securely in Cloudflare's environment (NOT in code).

### 4. Deploy the Worker

```bash
wrangler deploy
```

You'll get a URL like: `https://openviz-api.<your-subdomain>.workers.dev`

### 5. Update Frontend Environment

In `frontend/.env`, replace the API key with the proxy URL:

```env
# Remove or comment out:
# VITE_GROQ_API_KEY=your_key_here

# Add proxy URL instead:
VITE_AI_PROXY_URL=https://openviz-api.<your-subdomain>.workers.dev
```

---

## 🔧 How the Worker Works

The worker in `cloudflare-worker/src/index.ts`:

1. Receives requests from your frontend
2. Adds the secret `GROQ_API_KEY` header
3. Forwards the request to Groq
4. Returns the response to the frontend

```
┌─────────────┐    No API Key    ┌───────────────────┐    With API Key    ┌──────────┐
│   Browser   │ ───────────────→ │ Cloudflare Worker │ ─────────────────→ │ Groq API │
│  (OpenViz)  │ ←─────────────── │  (Holds Secret)   │ ←───────────────── │          │
└─────────────┘    Response      └───────────────────┘     Response       └──────────┘
```

---

## 📋 Deployment Checklist

- [ ] Deploy Cloudflare Worker with `wrangler deploy`
- [ ] Set `GROQ_API_KEY` secret via `wrangler secret put`
- [ ] Update `frontend/.env` to use `VITE_AI_PROXY_URL`
- [ ] Remove `VITE_GROQ_API_KEY` from frontend `.env`
- [ ] Verify `.gitignore` excludes `.env` files
- [ ] Test the deployed app

---

## 🔒 Additional Security Tips

1. **CORS**: The worker should only accept requests from your domain
2. **Rate Limiting**: Add rate limiting to prevent abuse
3. **Logging**: Monitor worker logs for suspicious activity
4. **Rotation**: Rotate your Groq API key periodically

---

## 📚 Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [Groq API Documentation](https://console.groq.com/docs)
