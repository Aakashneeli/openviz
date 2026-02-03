/**
 * OpenViz AI Proxy - Cloudflare Worker
 *
 * This worker proxies AI requests to the Groq API, keeping the API key secure
 * on the server side. Features:
 * - Rate limiting (100 requests/hour per IP by default)
 * - CORS handling
 * - Request validation
 * - Error handling with retry hints
 */

interface Env {
    GROQ_API_KEY: string;
    ALLOWED_ORIGIN: string;
    RATE_LIMIT_REQUESTS: string;
    RATE_LIMIT_WINDOW_HOURS: string;
    RATE_LIMIT?: KVNamespace;
}

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface ChatRequest {
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
}

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

// In-memory rate limit store (for development without KV)
const inMemoryRateLimit = new Map<string, RateLimitEntry>();

/**
 * Get client IP address from request headers
 */
function getClientIP(request: Request): string {
    return request.headers.get('CF-Connecting-IP') ||
           request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
           'unknown';
}

/**
 * Check and update rate limit for a client
 */
async function checkRateLimit(
    clientIP: string,
    env: Env
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const maxRequests = parseInt(env.RATE_LIMIT_REQUESTS || '100', 10);
    const windowHours = parseInt(env.RATE_LIMIT_WINDOW_HOURS || '1', 10);
    const windowMs = windowHours * 60 * 60 * 1000;
    const now = Date.now();

    // Try KV storage first, fall back to in-memory
    let entry: RateLimitEntry | null = null;

    if (env.RATE_LIMIT) {
        const stored = await env.RATE_LIMIT.get(clientIP);
        if (stored) {
            entry = JSON.parse(stored);
        }
    } else {
        entry = inMemoryRateLimit.get(clientIP) || null;
    }

    // Check if window expired
    if (!entry || now > entry.resetAt) {
        entry = { count: 0, resetAt: now + windowMs };
    }

    // Check if rate limited
    if (entry.count >= maxRequests) {
        return {
            allowed: false,
            remaining: 0,
            resetAt: entry.resetAt
        };
    }

    // Increment count
    entry.count++;

    // Store updated entry
    if (env.RATE_LIMIT) {
        await env.RATE_LIMIT.put(clientIP, JSON.stringify(entry), {
            expirationTtl: Math.ceil(windowMs / 1000)
        });
    } else {
        inMemoryRateLimit.set(clientIP, entry);
    }

    return {
        allowed: true,
        remaining: maxRequests - entry.count,
        resetAt: entry.resetAt
    };
}

/**
 * Add CORS headers to response
 */
function corsHeaders(env: Env): HeadersInit {
    return {
        'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
    };
}

/**
 * Create an error response with CORS headers
 */
function errorResponse(
    message: string,
    status: number,
    env: Env,
    retryAfter?: number
): Response {
    const headers: HeadersInit = {
        ...corsHeaders(env),
        'Content-Type': 'application/json',
    };

    if (retryAfter) {
        headers['Retry-After'] = String(retryAfter);
    }

    return new Response(
        JSON.stringify({ error: message, retryAfter }),
        { status, headers }
    );
}

/**
 * Validate the incoming chat request
 */
function validateRequest(body: unknown): body is ChatRequest {
    if (!body || typeof body !== 'object') return false;
    const req = body as Record<string, unknown>;

    if (typeof req.model !== 'string') return false;
    if (!Array.isArray(req.messages)) return false;
    if (req.messages.length === 0) return false;

    for (const msg of req.messages) {
        if (!msg || typeof msg !== 'object') return false;
        if (!['system', 'user', 'assistant'].includes((msg as ChatMessage).role)) return false;
        if (typeof (msg as ChatMessage).content !== 'string') return false;
    }

    return true;
}

/**
 * Proxy the chat completion request to Groq API
 */
async function proxyChatCompletion(
    request: ChatRequest,
    env: Env
): Promise<Response> {
    const groqUrl = 'https://api.groq.com/openai/v1/chat/completions';

    const response = await fetch(groqUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
    });

    // Clone the response to add CORS headers
    const responseData = await response.json();

    return new Response(JSON.stringify(responseData), {
        status: response.status,
        headers: {
            ...corsHeaders(env),
            'Content-Type': 'application/json',
        },
    });
}

/**
 * Handle streaming chat completion (SSE)
 */
async function proxyStreamingChat(
    request: ChatRequest,
    env: Env
): Promise<Response> {
    const groqUrl = 'https://api.groq.com/openai/v1/chat/completions';

    const response = await fetch(groqUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...request, stream: true }),
    });

    if (!response.ok || !response.body) {
        const error = await response.text();
        return errorResponse(error, response.status, env);
    }

    // Forward the streaming response
    return new Response(response.body, {
        status: response.status,
        headers: {
            ...corsHeaders(env),
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}

/**
 * Main request handler
 */
export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: corsHeaders(env),
            });
        }

        // Only allow POST requests
        if (request.method !== 'POST') {
            return errorResponse('Method not allowed', 405, env);
        }

        // Check API key is configured
        if (!env.GROQ_API_KEY) {
            console.error('GROQ_API_KEY not configured');
            return errorResponse('Server configuration error', 500, env);
        }

        // Check rate limit
        const clientIP = getClientIP(request);
        const rateLimit = await checkRateLimit(clientIP, env);

        if (!rateLimit.allowed) {
            const retryAfter = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
            return errorResponse(
                'Rate limit exceeded. Please try again later.',
                429,
                env,
                retryAfter
            );
        }

        // Parse and validate request body
        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return errorResponse('Invalid JSON body', 400, env);
        }

        if (!validateRequest(body)) {
            return errorResponse('Invalid request format', 400, env);
        }

        // Check URL path for different endpoints
        const url = new URL(request.url);
        const path = url.pathname;

        try {
            // Handle streaming vs non-streaming
            if (body.stream) {
                return await proxyStreamingChat(body, env);
            }

            // Default to regular chat completion
            const response = await proxyChatCompletion(body, env);

            // Add rate limit headers
            response.headers.set('X-RateLimit-Remaining', String(rateLimit.remaining));
            response.headers.set('X-RateLimit-Reset', String(rateLimit.resetAt));

            return response;
        } catch (error) {
            console.error('Proxy error:', error);
            return errorResponse(
                'AI service temporarily unavailable. Please retry.',
                503,
                env,
                5 // Suggest retry after 5 seconds
            );
        }
    },
};
