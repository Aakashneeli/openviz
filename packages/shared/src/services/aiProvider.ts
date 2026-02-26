// ============================================
// AI Provider Abstraction Layer
// Supports Groq, OpenAI, and Anthropic with
// automatic fallback when a provider fails
// ============================================

import Groq from 'groq-sdk';

// ============================================
// Types
// ============================================

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface ChatCompletionRequest {
    messages: ChatMessage[];
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: 'json_object' | 'text' };
    stream?: boolean;
}

export interface ChatCompletionResponse {
    choices: Array<{
        message: {
            content: string;
            role: string;
        };
        finish_reason: string;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    provider: string;
}

export type AIProviderName = 'groq' | 'openai' | 'anthropic';

// ============================================
// Provider Interface
// ============================================

export interface AIProvider {
    name: AIProviderName;
    displayName: string;
    model: string;
    isAvailable(): boolean;
    chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
    streamChat(request: ChatCompletionRequest): AsyncGenerator<string, void, unknown>;
}

// ============================================
// Groq Provider
// ============================================

class GroqProvider implements AIProvider {
    name: AIProviderName = 'groq';
    displayName = 'Groq';
    model: string;
    private client: Groq | null = null;
    private apiKey: string;

    constructor() {
        this.apiKey = import.meta.env.VITE_GROQ_API_KEY || '';
        this.model = import.meta.env.VITE_AI_MODEL || 'meta-llama/llama-4-maverick-17b-128e-instruct';
    }

    isAvailable(): boolean {
        return Boolean(this.apiKey);
    }

    private getClient(): Groq {
        if (!this.client) {
            this.client = new Groq({
                apiKey: this.apiKey,
                dangerouslyAllowBrowser: true,
            });
        }
        return this.client;
    }

    async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
        const groq = this.getClient();
        const response = await groq.chat.completions.create({
            model: this.model,
            messages: request.messages,
            temperature: request.temperature,
            max_tokens: request.max_tokens,
            response_format: request.response_format,
        });

        return {
            choices: response.choices.map(choice => ({
                message: {
                    content: choice.message.content || '',
                    role: choice.message.role,
                },
                finish_reason: choice.finish_reason || 'stop',
            })),
            usage: response.usage ? {
                prompt_tokens: response.usage.prompt_tokens,
                completion_tokens: response.usage.completion_tokens,
                total_tokens: response.usage.total_tokens,
            } : undefined,
            provider: this.name,
        };
    }

    async *streamChat(request: ChatCompletionRequest): AsyncGenerator<string, void, unknown> {
        const groq = this.getClient();
        const stream = await groq.chat.completions.create({
            model: this.model,
            messages: request.messages,
            temperature: request.temperature,
            max_tokens: request.max_tokens,
            stream: true,
        });

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
                yield content;
            }
        }
    }
}

// ============================================
// OpenAI-Compatible Provider (OpenAI, etc.)
// ============================================

class OpenAICompatibleProvider implements AIProvider {
    name: AIProviderName;
    displayName: string;
    model: string;
    private apiKey: string;
    private baseURL: string;

    constructor(config: {
        name: AIProviderName;
        displayName: string;
        model: string;
        apiKey: string;
        baseURL: string;
    }) {
        this.name = config.name;
        this.displayName = config.displayName;
        this.model = config.model;
        this.apiKey = config.apiKey;
        this.baseURL = config.baseURL;
    }

    isAvailable(): boolean {
        return Boolean(this.apiKey);
    }

    async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
        const response = await fetch(`${this.baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.model,
                messages: request.messages,
                temperature: request.temperature,
                max_tokens: request.max_tokens,
                ...(request.response_format ? { response_format: request.response_format } : {}),
            }),
        });

        if (!response.ok) {
            const error = await response.text().catch(() => '');
            throw new Error(`${this.displayName} API error (${response.status}): ${error}`);
        }

        const data = await response.json();
        return {
            choices: data.choices.map((choice: { message: { content: string; role: string }; finish_reason: string }) => ({
                message: {
                    content: choice.message.content || '',
                    role: choice.message.role,
                },
                finish_reason: choice.finish_reason || 'stop',
            })),
            usage: data.usage,
            provider: this.name,
        };
    }

    async *streamChat(request: ChatCompletionRequest): AsyncGenerator<string, void, unknown> {
        const response = await fetch(`${this.baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.model,
                messages: request.messages,
                temperature: request.temperature,
                max_tokens: request.max_tokens,
                stream: true,
            }),
        });

        if (!response.ok) {
            throw new Error(`${this.displayName} streaming error: HTTP ${response.status}`);
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
                const data = trimmed.slice(6);
                if (data === '[DONE]') return;

                try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content;
                    if (content) yield content;
                } catch {
                    // Skip unparseable chunks
                }
            }
        }
    }
}

// ============================================
// Anthropic Provider (Messages API)
// ============================================

class AnthropicProvider implements AIProvider {
    name: AIProviderName = 'anthropic';
    displayName = 'Claude';
    model: string;
    private apiKey: string;

    constructor() {
        this.apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY || '';
        this.model = import.meta.env.VITE_ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929';
    }

    isAvailable(): boolean {
        return Boolean(this.apiKey);
    }

    async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
        // Extract system message and user/assistant messages
        const systemMsg = request.messages.find(m => m.role === 'system');
        const messages = request.messages.filter(m => m.role !== 'system');

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true',
            },
            body: JSON.stringify({
                model: this.model,
                max_tokens: request.max_tokens || 1024,
                temperature: request.temperature,
                ...(systemMsg ? { system: systemMsg.content } : {}),
                messages: messages.map(m => ({
                    role: m.role,
                    content: m.content,
                })),
            }),
        });

        if (!response.ok) {
            const error = await response.text().catch(() => '');
            throw new Error(`Anthropic API error (${response.status}): ${error}`);
        }

        const data = await response.json();
        const textContent = data.content?.find((c: { type: string }) => c.type === 'text');

        return {
            choices: [{
                message: {
                    content: textContent?.text || '',
                    role: 'assistant',
                },
                finish_reason: data.stop_reason || 'end_turn',
            }],
            usage: data.usage ? {
                prompt_tokens: data.usage.input_tokens,
                completion_tokens: data.usage.output_tokens,
                total_tokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
            } : undefined,
            provider: this.name,
        };
    }

    async *streamChat(request: ChatCompletionRequest): AsyncGenerator<string, void, unknown> {
        const systemMsg = request.messages.find(m => m.role === 'system');
        const messages = request.messages.filter(m => m.role !== 'system');

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true',
            },
            body: JSON.stringify({
                model: this.model,
                max_tokens: request.max_tokens || 1024,
                temperature: request.temperature,
                stream: true,
                ...(systemMsg ? { system: systemMsg.content } : {}),
                messages: messages.map(m => ({
                    role: m.role,
                    content: m.content,
                })),
            }),
        });

        if (!response.ok) {
            throw new Error(`Anthropic streaming error: HTTP ${response.status}`);
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
                const data = trimmed.slice(6);
                if (data === '[DONE]') return;

                try {
                    const parsed = JSON.parse(data);
                    // Anthropic SSE format: content_block_delta with delta.text
                    if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                        yield parsed.delta.text;
                    }
                } catch {
                    // Skip unparseable chunks
                }
            }
        }
    }
}

// ============================================
// Provider Manager (Fallback Chain)
// ============================================

/** Configuration for which providers to try and in what order */
export interface ProviderConfig {
    /** Ordered list of providers to try (first = primary) */
    order: AIProviderName[];
}

class AIProviderManager {
    private providers: Map<AIProviderName, AIProvider> = new Map();
    private providerOrder: AIProviderName[] = ['groq', 'openai', 'anthropic'];
    private lastUsedProvider: AIProviderName | null = null;

    constructor() {
        // Initialize all providers
        const groq = new GroqProvider();
        if (groq.isAvailable()) this.providers.set('groq', groq);

        const openai = new OpenAICompatibleProvider({
            name: 'openai',
            displayName: 'OpenAI',
            model: import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini',
            apiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
            baseURL: 'https://api.openai.com/v1',
        });
        if (openai.isAvailable()) this.providers.set('openai', openai);

        const anthropic = new AnthropicProvider();
        if (anthropic.isAvailable()) this.providers.set('anthropic', anthropic);

        // Allow custom provider order via env
        const customOrder = import.meta.env.VITE_AI_PROVIDER_ORDER;
        if (customOrder) {
            this.providerOrder = customOrder.split(',').map((s: string) => s.trim()) as AIProviderName[];
        }
    }

    /** Get list of available providers in fallback order */
    getAvailableProviders(): AIProvider[] {
        return this.providerOrder
            .map(name => this.providers.get(name))
            .filter((p): p is AIProvider => p !== undefined);
    }

    /** Check if any provider is available */
    isAnyAvailable(): boolean {
        return this.getAvailableProviders().length > 0;
    }

    /** Get the last successfully used provider name */
    getLastUsedProvider(): string | null {
        if (!this.lastUsedProvider) return null;
        return this.providers.get(this.lastUsedProvider)?.displayName || this.lastUsedProvider;
    }

    /** Get display names of available providers */
    getAvailableProviderNames(): string[] {
        return this.getAvailableProviders().map(p => p.displayName);
    }

    /**
     * Call AI with automatic fallback through available providers
     * Tries each provider in order; if one fails, tries the next
     */
    async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
        const providers = this.getAvailableProviders();
        if (providers.length === 0) {
            throw new Error('No AI providers configured. Please add at least one API key (VITE_GROQ_API_KEY, VITE_OPENAI_API_KEY, or VITE_ANTHROPIC_API_KEY).');
        }

        let lastError: Error | null = null;

        for (const provider of providers) {
            try {
                console.log(`[AI] Trying provider: ${provider.displayName} (${provider.model})`);
                const response = await provider.chat(request);
                this.lastUsedProvider = provider.name;
                console.log(`[AI] Success with ${provider.displayName}`);
                return response;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                console.warn(`[AI] ${provider.displayName} failed: ${lastError.message}`);

                // Don't fallback on client errors (bad request, auth)
                if (lastError.message.includes('401') || lastError.message.includes('403')) {
                    console.warn(`[AI] Auth error for ${provider.displayName}, skipping to next provider`);
                    continue;
                }
            }
        }

        throw lastError || new Error('All AI providers failed');
    }

    /**
     * Stream AI response with fallback
     * Returns an async generator that yields text chunks
     * Falls back to next provider only before streaming starts
     */
    async *streamChat(request: ChatCompletionRequest): AsyncGenerator<string, void, unknown> {
        const providers = this.getAvailableProviders();
        if (providers.length === 0) {
            throw new Error('No AI providers configured.');
        }

        let lastError: Error | null = null;

        for (const provider of providers) {
            try {
                console.log(`[AI Stream] Trying provider: ${provider.displayName}`);
                const generator = provider.streamChat(request);

                // Try to get at least the first chunk to verify the stream works
                const first = await generator.next();
                if (!first.done) {
                    this.lastUsedProvider = provider.name;
                    console.log(`[AI Stream] Streaming with ${provider.displayName}`);
                    yield first.value;
                    yield* generator;
                    return;
                }
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                console.warn(`[AI Stream] ${provider.displayName} failed: ${lastError.message}`);
            }
        }

        throw lastError || new Error('All AI providers failed for streaming');
    }
}

// ============================================
// Singleton Instance
// ============================================

let _manager: AIProviderManager | null = null;

export function getProviderManager(): AIProviderManager {
    if (!_manager) {
        _manager = new AIProviderManager();
    }
    return _manager;
}

/** Check if any AI provider is available */
export function isAnyProviderAvailable(): boolean {
    return getProviderManager().isAnyAvailable();
}

/** Get the name of the last provider used */
export function getLastProviderName(): string | null {
    return getProviderManager().getLastUsedProvider();
}

/** Get display names of all available providers */
export function getAvailableProviderNames(): string[] {
    return getProviderManager().getAvailableProviderNames();
}
