import {
    getProviderManager,
    isAnyProviderAvailable,
    getLastProviderName as getLastProviderNameFromManager,
    getAvailableProviderNames as getAvailableProviderNamesFromManager,
} from './aiProvider';
import type { ChatCompletionRequest, ChatCompletionResponse } from './aiProvider';

export type AITransportMode = 'proxy' | 'direct-dev';

export interface AIClient {
    mode: AITransportMode;
    request(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
    stream(request: ChatCompletionRequest): AsyncGenerator<string, void, unknown>;
}

const AI_PROXY_URL = import.meta.env.VITE_AI_PROXY_URL;
const AI_PROXY_AUTH_TOKEN = import.meta.env.VITE_AI_PROXY_AUTH_TOKEN;
const AI_MODEL = import.meta.env.VITE_AI_MODEL || 'meta-llama/llama-4-maverick-17b-128e-instruct';
const ALLOW_INSECURE_DIRECT_AI = import.meta.env.VITE_ALLOW_INSECURE_DIRECT_AI === 'true';

let lastTransportName: string | null = null;

export class AIConfigurationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AIConfigurationError';
    }
}

function isLocalDevHost(): boolean {
    if (!import.meta.env.DEV || typeof window === 'undefined') {
        return false;
    }

    const hostname = window.location.hostname;
    return hostname === 'localhost'
        || hostname === '127.0.0.1'
        || hostname === '[::1]'
        || hostname.endsWith('.local');
}

function canUseInsecureDirectAI(): boolean {
    return ALLOW_INSECURE_DIRECT_AI && isLocalDevHost();
}

function getDirectModeDisabledError(): Error {
    return new AIConfigurationError(
        'Direct browser AI mode is disabled. Configure VITE_AI_PROXY_URL (recommended) or set VITE_ALLOW_INSECURE_DIRECT_AI=true for localhost development only.'
    );
}

function getMissingDirectProviderError(): Error {
    return new AIConfigurationError(
        'Direct AI mode is enabled but no provider keys are configured. Set VITE_GROQ_API_KEY/VITE_OPENAI_API_KEY/VITE_ANTHROPIC_API_KEY or configure VITE_AI_PROXY_URL.'
    );
}

function getMissingProxyAuthTokenError(): Error {
    return new AIConfigurationError(
        'Proxy AI mode requires VITE_AI_PROXY_AUTH_TOKEN. Set it to the same app token configured on the worker (APP_AUTH_TOKEN).'
    );
}

function buildProxyHeaders(): Record<string, string> {
    if (!AI_PROXY_AUTH_TOKEN) {
        throw getMissingProxyAuthTokenError();
    }

    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_PROXY_AUTH_TOKEN}`,
    };
}

async function requestWithProxy(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!AI_PROXY_URL) {
        throw getDirectModeDisabledError();
    }

    const response = await fetch(AI_PROXY_URL, {
        method: 'POST',
        headers: buildProxyHeaders(),
        body: JSON.stringify({ ...request, model: AI_MODEL }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = (errorData as { error?: string }).error || `HTTP ${response.status}`;
        const error = new Error(`AI proxy error: ${errorMessage}`);
        (error as { retryAfter?: number }).retryAfter = (errorData as { retryAfter?: number }).retryAfter;
        throw error;
    }

    const data = await response.json();
    lastTransportName = 'Proxy';
    return { ...data, provider: 'proxy' };
}

async function* streamWithProxy(request: ChatCompletionRequest): AsyncGenerator<string, void, unknown> {
    if (!AI_PROXY_URL) {
        throw getDirectModeDisabledError();
    }

    const response = await fetch(AI_PROXY_URL, {
        method: 'POST',
        headers: buildProxyHeaders(),
        body: JSON.stringify({ ...request, stream: true }),
    });

    if (!response.ok) {
        throw new Error(`AI proxy streaming error: HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body for streaming');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const payload = trimmed.slice(6);
            if (payload === '[DONE]') return;

            try {
                const parsed = JSON.parse(payload);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) yield content;
            } catch {
                // Skip malformed stream chunks.
            }
        }
    }
}

async function requestDirect(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!canUseInsecureDirectAI()) {
        throw getDirectModeDisabledError();
    }

    if (!isAnyProviderAvailable()) {
        throw getMissingDirectProviderError();
    }

    const manager = getProviderManager();
    const response = await manager.chat(request);
    lastTransportName = response.provider || getLastProviderNameFromManager();
    return response;
}

function streamDirect(request: ChatCompletionRequest): AsyncGenerator<string, void, unknown> {
    if (!canUseInsecureDirectAI()) {
        throw getDirectModeDisabledError();
    }

    if (!isAnyProviderAvailable()) {
        throw getMissingDirectProviderError();
    }

    const manager = getProviderManager();
    return manager.streamChat(request);
}

const proxyClient: AIClient = {
    mode: 'proxy',
    request: requestWithProxy,
    stream: streamWithProxy,
};

const directClient: AIClient = {
    mode: 'direct-dev',
    request: requestDirect,
    stream: streamDirect,
};

export function getAIClient(): AIClient {
    if (AI_PROXY_URL) {
        return proxyClient;
    }

    if (canUseInsecureDirectAI()) {
        if (!isAnyProviderAvailable()) {
            throw getMissingDirectProviderError();
        }
        return directClient;
    }

    throw getDirectModeDisabledError();
}

export function isAIClientAvailable(): boolean {
    if (Boolean(AI_PROXY_URL)) {
        return Boolean(AI_PROXY_AUTH_TOKEN);
    }

    return canUseInsecureDirectAI() && isAnyProviderAvailable();
}

export function getLastAIProviderName(): string | null {
    if (lastTransportName) {
        return lastTransportName;
    }

    if (!canUseInsecureDirectAI()) {
        return null;
    }

    return getLastProviderNameFromManager();
}

export function getAvailableAIProviderNames(): string[] {
    if (Boolean(AI_PROXY_URL) && Boolean(AI_PROXY_AUTH_TOKEN)) {
        return ['Proxy'];
    }

    if (!canUseInsecureDirectAI()) {
        return [];
    }

    return getAvailableProviderNamesFromManager();
}
