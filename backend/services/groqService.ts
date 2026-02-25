// ============================================
// Groq AI Service v2.0
// Enhanced with Intent Detection, Q&A, and
// Contextual Memory for OpenViz
// ============================================

import type {
    FieldInfo,
    ChartConfig,
    DataInsight,
    AIQueryResult,
    DataRecord,
    ShelfPlacement,
    EncodingChannel,
    MarkType,
    DataProfile,
    AIIntent,
    AIMessage,
    DashboardConfig,
    DashboardLayout,
    AggregateFunction,
    FilterSpec,
    ComparisonSpec,
} from '../types';
import { generateId } from '../utils/id';
import { executeDataQuery, formatProfileForLLM } from './dataContextService';
import type { DataQuery } from './dataContextService';
import { generateAnnotations } from './annotationService';

// ============================================
// Configuration
// ============================================

import {
    getProviderManager,
    isAnyProviderAvailable,
    getLastProviderName as getLastProviderNameFromManager,
    getAvailableProviderNames as getAvailableProviderNamesFromManager,
} from './aiProvider';
import type { ChatMessage, ChatCompletionRequest, ChatCompletionResponse } from './aiProvider';

// AI Proxy URL - In production, this should point to your Cloudflare Worker
const AI_PROXY_URL = import.meta.env.VITE_AI_PROXY_URL;
const AI_PROXY_AUTH_TOKEN = import.meta.env.VITE_AI_PROXY_AUTH_TOKEN;
const AI_MODEL = import.meta.env.VITE_AI_MODEL || 'meta-llama/llama-4-maverick-17b-128e-instruct';
const ALLOW_INSECURE_DIRECT_AI = import.meta.env.VITE_ALLOW_INSECURE_DIRECT_AI === 'true';

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

let lastTransportName: string | null = null;

class AIConfigurationError extends Error {
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

// ============================================
// AI Call with Retry Logic & Provider Fallback
// ============================================

/**
 * Sleep for a specified duration (for retry delays)
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Call AI service with automatic retry and provider fallback
 * Priority: Proxy (if configured) > Provider Manager (multi-provider with fallback)
 */
async function callAI(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            if (AI_PROXY_URL) {
                // Use proxy in production (handles its own provider logic)
                return await callAIProxy(request);
            }

            if (canUseInsecureDirectAI()) {
                if (!isAnyProviderAvailable()) {
                    throw getMissingDirectProviderError();
                }

                // Use provider manager with automatic fallback across providers
                const manager = getProviderManager();
                return await manager.chat(request);
            }

            throw getDirectModeDisabledError();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            if (lastError instanceof AIConfigurationError) {
                throw lastError;
            }

            // Don't retry on client errors (4xx) - except 429 which is rate limit
            if ((lastError.message.includes('400') ||
                lastError.message.includes('401') ||
                lastError.message.includes('403')) &&
                !lastError.message.includes('429')) {
                throw lastError;
            }

            // Calculate exponential backoff delay
            const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
            const retryAfter = (error as { retryAfter?: number })?.retryAfter;
            const actualDelay = retryAfter ? retryAfter * 1000 : delay;

            console.warn(`AI request failed (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${actualDelay}ms...`, lastError.message);

            if (attempt < MAX_RETRIES - 1) {
                await sleep(actualDelay);
            }
        }
    }

    throw lastError || new Error('AI request failed after all retries');
}

/**
 * Call AI via secure proxy (production)
 */
async function callAIProxy(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
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

// ============================================
// Streaming AI Calls
// ============================================

/**
 * Call AI with streaming via proxy (SSE)
 * Returns an async generator that yields text chunks
 */
async function* callAIStreamingProxy(request: ChatCompletionRequest): AsyncGenerator<string, void, unknown> {
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

/**
 * Get a streaming generator - uses proxy or provider manager with fallback
 */
function getStreamingGenerator(request: ChatCompletionRequest): AsyncGenerator<string, void, unknown> {
    if (AI_PROXY_URL) {
        lastTransportName = 'Proxy';
        return callAIStreamingProxy(request);
    }

    if (!canUseInsecureDirectAI()) {
        throw getDirectModeDisabledError();
    }

    if (!isAnyProviderAvailable()) {
        throw getMissingDirectProviderError();
    }

    // Use provider manager with automatic fallback
    const manager = getProviderManager();
    return manager.streamChat(request);
}

/**
 * Stream a text response from the AI given a prompt
 * onChunk is called with each text fragment as it arrives
 * Returns the complete text when done
 */
export async function streamAITextResponse(
    prompt: string,
    onChunk: (chunk: string, accumulated: string) => void,
    options: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
    const request: ChatCompletionRequest = {
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature ?? 0.5,
        max_tokens: options.maxTokens ?? 1024,
        stream: true,
    };

    let accumulated = '';
    const generator = getStreamingGenerator(request);

    for await (const chunk of generator) {
        accumulated += chunk;
        onChunk(chunk, accumulated);
    }

    return accumulated;
}

/**
 * Stream an AI chat completion with full message array support
 * Used for streaming text responses (questions, explanations, etc.)
 * Uses provider manager with automatic fallback across providers
 * onChunk is called with each text fragment as it arrives
 * Returns the complete text when done
 */
export async function streamAIChatResponse(
    messages: ChatMessage[],
    onChunk: (chunk: string, accumulated: string) => void,
    options: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
    const request: ChatCompletionRequest = {
        messages,
        temperature: options.temperature ?? 0.5,
        max_tokens: options.maxTokens ?? 1024,
        stream: true,
    };

    let accumulated = '';
    const generator = getStreamingGenerator(request);

    for await (const chunk of generator) {
        accumulated += chunk;
        onChunk(chunk, accumulated);
    }

    return accumulated;
}

/**
 * Robustly extract JSON from LLM response that may contain extra text
 * Handles: markdown code blocks, single quotes, trailing commas, unquoted keys
 */
function extractJSON(content: string): unknown {
    // Step 1: Pre-clean the content
    let cleaned = content.trim();

    // Remove markdown code blocks (```json ... ``` or ``` ... ```)
    cleaned = cleaned.replace(/```json\s*/gi, '');
    cleaned = cleaned.replace(/```\s*/g, '');

    // Remove any leading text before the first {
    const firstBrace = cleaned.indexOf('{');
    if (firstBrace > 0) {
        cleaned = cleaned.substring(firstBrace);
    }

    // Remove any trailing text after the last }
    const lastBrace = cleaned.lastIndexOf('}');
    if (lastBrace !== -1 && lastBrace < cleaned.length - 1) {
        cleaned = cleaned.substring(0, lastBrace + 1);
    }

    // Step 2: Try to find JSON object - handle nested braces properly
    let braceCount = 0;
    let startIndex = -1;
    let endIndex = -1;

    for (let i = 0; i < cleaned.length; i++) {
        if (cleaned[i] === '{') {
            if (braceCount === 0) startIndex = i;
            braceCount++;
        } else if (cleaned[i] === '}') {
            braceCount--;
            if (braceCount === 0 && startIndex !== -1) {
                endIndex = i + 1;
                break;
            }
        }
    }

    if (startIndex !== -1 && endIndex !== -1) {
        let jsonStr = cleaned.substring(startIndex, endIndex);

        // Try multiple parsing strategies
        const attempts = [
            () => JSON.parse(jsonStr),
            () => JSON.parse(fixMalformedJSON(jsonStr)),
            () => JSON.parse(aggressiveJSONFix(jsonStr)),
        ];

        for (const attempt of attempts) {
            try {
                return attempt();
            } catch {
                continue;
            }
        }
    }

    // Fallback: try simple regex match
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
        const attempts = [
            () => JSON.parse(match[0]),
            () => JSON.parse(fixMalformedJSON(match[0])),
            () => JSON.parse(aggressiveJSONFix(match[0])),
        ];

        for (const attempt of attempts) {
            try {
                return attempt();
            } catch {
                continue;
            }
        }
    }

    console.error('Failed to parse JSON. Raw content:', content.substring(0, 500));
    throw new Error('No valid JSON found in response');
}

/**
 * Fix common JSON formatting issues from LLMs
 */
function fixMalformedJSON(jsonStr: string): string {
    let fixed = jsonStr;

    // 1. Remove any BOM or invisible characters at the start
    fixed = fixed.replace(/^\uFEFF/, '');

    // 2. Fix newlines inside string values (replace with \n escape)
    // This handles multi-line strings that LLMs sometimes produce
    fixed = fixed.replace(/"([^"]*(?:\\.[^"]*)*)"/g, (match) => {
        return match
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');
    });

    // 3. Replace single-quoted strings with double-quoted
    fixed = fixed.replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, '"$1"');

    // 4. Remove trailing commas before } or ]
    fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

    // 5. Handle unquoted property names
    fixed = fixed.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

    // 6. Remove any JavaScript-style comments
    fixed = fixed.replace(/\/\/[^\n]*/g, '');
    fixed = fixed.replace(/\/\*[\s\S]*?\*\//g, '');

    // 7. Fix double colons (sometimes LLM outputs field:: value)
    fixed = fixed.replace(/::/g, ':');

    return fixed;
}

/**
 * Aggressive JSON fix for severely malformed responses
 * Used as last resort when other methods fail
 */
function aggressiveJSONFix(jsonStr: string): string {
    let fixed = fixMalformedJSON(jsonStr);

    // Remove any remaining non-JSON content
    // Strip everything before the first { and after the last }
    const start = fixed.indexOf('{');
    const end = fixed.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
        fixed = fixed.substring(start, end + 1);
    }

    // Replace problematic Unicode quotes with standard quotes
    fixed = fixed.replace(/[""]/g, '"');
    fixed = fixed.replace(/['']/g, "'");

    // Remove control characters except newline and tab
    fixed = fixed.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Fix cases where LLM uses = instead of :
    fixed = fixed.replace(/"([^"]+)"\s*=\s*/g, '"$1": ');

    // Remove any text that looks like a sentence within values (common hallucination)
    // This removes patterns like "value Page Page Page text"
    fixed = fixed.replace(/Page\s+Page\s+Page[^"]*"/g, '"');

    return fixed;
}

/**
 * Sanitize text output from LLM to remove common hallucinations
 * Use this on titles, summaries, and other text outputs
 */
function sanitizeOutput(text: string): string {
    let sanitized = text;

    // Remove "Page" hallucinations (common LLM artifact)
    sanitized = sanitized.replace(/\bPage\s+Page\b/gi, '');
    sanitized = sanitized.replace(/\bPage\b(?=\s+Page)/gi, '');
    sanitized = sanitized.replace(/(?<=\s)Page(?=\s|$|\.|\,)/gi, '');

    // Remove repeated "Page" patterns more aggressively
    sanitized = sanitized.replace(/(\s*Page\s*){2,}/gi, ' ');

    // Clean up extra whitespace
    sanitized = sanitized.replace(/\s{2,}/g, ' ').trim();

    // Remove trailing/leading punctuation artifacts
    sanitized = sanitized.replace(/^\s*[,.\-:]\s*/, '');
    sanitized = sanitized.replace(/\s*[,.\-:]\s*$/, '.');

    // Fix double spaces around punctuation
    sanitized = sanitized.replace(/\s+([.,!?])/g, '$1');

    return sanitized;
}

/**
 * Format current chart context for AI prompts
 * Provides detailed description of what the current chart shows
 */
function formatChartContext(
    chartTitle: string | undefined,
    mark: MarkType,
    encodings: ShelfPlacement[]
): string {
    if (encodings.length === 0) {
        return 'No chart currently configured. The user has not created any chart yet.';
    }

    const xEnc = encodings.find(e => e.channel === 'x');
    const yEnc = encodings.find(e => e.channel === 'y');
    const colorEnc = encodings.find(e => e.channel === 'color');
    const sizeEnc = encodings.find(e => e.channel === 'size');
    const thetaEnc = encodings.find(e => e.channel === 'theta');

    const parts: string[] = [];
    parts.push(`Current Chart Type: ${mark}`);
    if (chartTitle) parts.push(`Chart Title: "${chartTitle}"`);

    if (xEnc) {
        let xDesc = `X-Axis: ${xEnc.field.name} (${xEnc.field.type})`;
        if (xEnc.aggregate) xDesc += ` - aggregated by ${xEnc.aggregate}`;
        parts.push(xDesc);
    }

    if (yEnc) {
        let yDesc = `Y-Axis: ${yEnc.field.name} (${yEnc.field.type})`;
        if (yEnc.aggregate) yDesc += ` - aggregated by ${yEnc.aggregate}`;
        parts.push(yDesc);
    }

    if (thetaEnc) {
        parts.push(`Slice Values: ${thetaEnc.field.name} (for pie/donut chart)`);
    }

    if (colorEnc) {
        parts.push(`Color Grouping: ${colorEnc.field.name} (${colorEnc.field.type})`);
    }

    if (sizeEnc) {
        parts.push(`Size Mapping: ${sizeEnc.field.name} (${sizeEnc.field.type})`);
    }

    // Add a human-readable description
    if (xEnc && yEnc) {
        const aggText = yEnc.aggregate ? `${yEnc.aggregate} of ` : '';
        parts.push(`\nThis chart shows: ${aggText}${yEnc.field.name} by ${xEnc.field.name}`);
    }

    return parts.join('\n');
}

/**
 * Format dashboard context for AI prompts
 * Provides overview of all charts in the dashboard
 */
function formatDashboardContext(dashboard: DashboardConfig | null): string {
    if (!dashboard) {
        return 'No dashboard currently active. The user is working in single chart mode.';
    }

    const lines: string[] = [];
    lines.push(`Dashboard: "${dashboard.title || 'Untitled Dashboard'}"`);
    lines.push(`Total Charts: ${dashboard.charts.length}`);
    lines.push('');

    if (dashboard.charts.length === 0) {
        lines.push('The dashboard is empty - no charts have been added yet.');
    } else {
        lines.push('Charts in Dashboard:');
        dashboard.charts.forEach((chart, i) => {
            const xEnc = chart.encodings.find(e => e.channel === 'x');
            const yEnc = chart.encodings.find(e => e.channel === 'y');
            const title = chart.title || `${chart.mark} Chart`;

            let description = `  ${i + 1}. "${title}" (${chart.mark})`;
            if (xEnc && yEnc) {
                const aggText = yEnc.aggregate ? `${yEnc.aggregate} of ` : '';
                description += `\n     Shows: ${aggText}${yEnc.field.name} by ${xEnc.field.name}`;
            } else if (chart.encodings.length > 0) {
                const fields = chart.encodings.map(e => e.field.name).join(', ');
                description += `\n     Uses fields: ${fields}`;
            }
            lines.push(description);
        });
    }

    return lines.join('\n');
}

/**
 * Format context for a specific focused chart within a dashboard
 * Used when AI chat is opened for a specific chart
 */
function formatFocusedChartContext(chartId: string, dashboard: DashboardConfig): string {
    const chart = dashboard.charts.find(c => c.id === chartId);
    if (!chart) return '';

    const parts: string[] = [];
    parts.push(`⚡ FOCUSED CHART (user is asking about THIS specific chart):`);
    parts.push(`Chart Title: "${chart.title || 'Untitled Chart'}"`);
    parts.push(`Chart Type: ${chart.mark}`);
    parts.push(`Dashboard: "${dashboard.title || 'Untitled Dashboard'}"`);

    const xEnc = chart.encodings.find(e => e.channel === 'x');
    const yEnc = chart.encodings.find(e => e.channel === 'y');
    const colorEnc = chart.encodings.find(e => e.channel === 'color');
    const sizeEnc = chart.encodings.find(e => e.channel === 'size');

    if (xEnc) {
        let desc = `X-Axis: ${xEnc.field.name} (${xEnc.field.type})`;
        if (xEnc.aggregate) desc += ` - aggregated by ${xEnc.aggregate}`;
        parts.push(desc);
    }
    if (yEnc) {
        let desc = `Y-Axis: ${yEnc.field.name} (${yEnc.field.type})`;
        if (yEnc.aggregate) desc += ` - aggregated by ${yEnc.aggregate}`;
        parts.push(desc);
    }
    if (colorEnc) parts.push(`Color: ${colorEnc.field.name}`);
    if (sizeEnc) parts.push(`Size: ${sizeEnc.field.name}`);

    if (xEnc && yEnc) {
        const aggText = yEnc.aggregate ? `${yEnc.aggregate} of ` : '';
        parts.push(`\nThis chart shows: ${aggText}${yEnc.field.name} by ${xEnc.field.name}`);
    }

    const allFields = chart.encodings.map(e => e.field.name);
    parts.push(`All mapped fields: ${allFields.join(', ')}`);

    return parts.join('\n');
}


/**
 * Enhanced intent detection with reasoning
 * Returns both intent and explanation of why
 */
export async function detectIntent(
    query: string,
    hasCurrentChart: boolean,
    hasDashboard: boolean = false,
    dataContext?: string,
    chatHistory?: AIMessage[]
): Promise<{ intent: AIIntent; reasoning: string }> {
    try {
        // Build context from recent chat history (expanded from 3 to 5 for better context)
        const recentHistory = chatHistory?.slice(-5) || [];
        const conversationContext = recentHistory.length > 0
            ? `\n\nRecent conversation:\n${recentHistory.map(m => `${m.role}: ${m.content}`).join('\n')}`
            : '';

        // Extract previous intent hint from last assistant message
        const lastAssistantMsg = [...(chatHistory || [])].reverse().find(m => m.role === 'assistant');
        const previousIntentHint = lastAssistantMsg?.resultType
            ? `\n- Previous action type: ${lastAssistantMsg.resultType}`
            : '';

        const prompt = `You are an intent classifier for a data visualization tool. Analyze the user's query and determine their intent.

**AVAILABLE INTENTS:**

1. **question** - User wants to KNOW something about the data
   - Keywords: what, how many, average, sum, count, tell me, explain the data
   - Examples: "What's the average sales?", "How many records?", "Summarize this data"

2. **chart** - User wants to CREATE a NEW SINGLE chart (any specific visualization type)
   - Chart types: bar, line, scatter, pie, area, histogram, radar, heatmap, treemap, sunburst, funnel, gauge, sankey, boxplot, candlestick, waterfall, parallel, calendar, tree, network
   - Keywords: show, create, make, plot, visualize, chart, graph, histogram, distribution
   - Examples: "Show sales over time", "Create a bar chart", "Create a histogram for this data", "Make a pie chart"
   - **IMPORTANT**: If user mentions ANY specific chart type (like histogram, pie, bar), this is ALWAYS "chart", not "dashboard"

3. **modify** - User wants to CHANGE the CURRENT chart (only when a chart exists)
   - Keywords: make it, change, switch, use different, bigger, smaller, color
   - Examples: "Make it bigger", "Change to line chart", "Use blue colors", "Sort by value"
   - **IMPORTANT**: Only valid when hasCurrentChart=true

4. **dashboard** - User wants to CREATE a NEW multi-chart dashboard (MULTIPLE visualizations together)
   - Keywords: dashboard, overview, variety, multiple charts, several charts, collection, summary view, different types
   - Examples: "Create a dashboard", "Show me an overview", "Build a multi-chart view", "Create a dashboard with variety of charts"
   - **IMPORTANT**: Use this when user asks for "variety", "multiple", "several", "different types" of charts
   - **IMPORTANT**: Even if a dashboard exists, if user asks for "variety" or "multiple" charts, use "dashboard" NOT "modify_dashboard"

5. **modify_dashboard** - User wants to ADD/REMOVE specific charts from EXISTING dashboard
   - Keywords: add, remove, delete, another, one more, get rid of, include another
   - Examples: "Add a pie chart", "Remove the first chart", "Delete this", "Add one more visualization"
   - **IMPORTANT**: Only valid when hasDashboard=true AND user is asking to add/remove SPECIFIC charts (not asking for variety)

6. **explain** - User wants to know WHY something is happening in the data
   - Keywords: why, explain trend, what caused, reason for
   - Examples: "Why is this spike here?", "Explain the trend", "What caused this?"

7. **filter** - User wants to FILTER the data (show subset)
   - Keywords: filter, only show, where, greater than, less than, exclude, between, remove rows, top N
   - Examples: "Only show sales > 1000", "Filter to USA", "Exclude returns", "Show where region is East"

8. **compare** - User wants to COMPARE two groups or periods
   - Keywords: compare, vs, versus, difference between, year over year, A vs B
   - Examples: "Compare Q1 vs Q2", "East vs West sales", "2023 versus 2024"

9. **forecast** - User wants PREDICTIONS or future projections
   - Keywords: forecast, predict, project, next N months, future, trend forward, extrapolate
   - Examples: "Forecast next 6 months", "Predict future sales", "Project revenue"

**DISAMBIGUATION RULES (apply these in order):**
- "delete"/"remove"/"get rid of" a chart + hasDashboard=true → always **modify_dashboard** (NOT modify)
- If user mentions a specific chart type name (bar, line, pie, histogram, etc.) WITHOUT "make it"/"change"/"switch" → always **chart**
- "show me"/"visualize"/"display" + field references → **chart** (not question)
- "What is"/"how much"/"what's the average"/"how many" → **question** (not chart)
- If hasCurrentChart=false → NEVER return **modify** (use chart instead)
- If hasDashboard=false → NEVER return **modify_dashboard** (use dashboard instead)
- "compare" or "vs" or "versus" → prefer **compare** over chart
- "filter"/"only show"/"where" → prefer **filter** over chart
- "show me something interesting"/"explore the data" → **chart** (create a default chart)

**CONTEXT:**
- Current chart exists: ${hasCurrentChart ? 'YES' : 'NO'}
- Dashboard exists: ${hasDashboard ? 'YES' : 'NO'}
${dataContext ? `- Data available: ${dataContext}` : ''}${previousIntentHint}${conversationContext}

**USER QUERY:** "${query}"

**INSTRUCTIONS:**
1. Analyze the query carefully considering context and disambiguation rules
2. Choose the MOST APPROPRIATE intent
3. If the query mentions "modify/change" but there's no current chart, classify as "chart"
4. If the query mentions "add to dashboard" but there's no dashboard, classify as "dashboard"

Respond with JSON:
{
  "intent": "question|chart|modify|dashboard|modify_dashboard|explain|filter|compare|forecast",
  "reasoning": "Brief explanation of why you chose this intent (1-2 sentences)"
}`;


        const response = await callAI({
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            max_tokens: 200,
            response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            return { intent: 'chart', reasoning: 'No response from AI, defaulting to chart creation' };
        }

        try {
            const parsed = extractJSON(content) as { intent: string; reasoning: string };

            // Validate and map the intent
            const intentStr = parsed.intent.toLowerCase().trim();
            let finalIntent: AIIntent = 'chart';

            if (intentStr.includes('filter')) finalIntent = 'filter';
            else if (intentStr.includes('compare')) finalIntent = 'compare';
            else if (intentStr.includes('forecast')) finalIntent = 'forecast';
            else if (intentStr.includes('question')) finalIntent = 'question';
            else if (intentStr.includes('modify_dashboard')) finalIntent = hasDashboard ? 'modify_dashboard' : 'dashboard';
            else if (intentStr.includes('modify')) {
                // Override: if query is a delete/remove request and dashboard exists, route to modify_dashboard
                const isDeleteOnDashboard = hasDashboard && /\b(delete|remove|get rid of|take away|discard)\b/i.test(query);
                if (isDeleteOnDashboard) {
                    finalIntent = 'modify_dashboard';
                } else {
                    finalIntent = hasCurrentChart ? 'modify' : 'chart';
                }
            }
            else if (intentStr.includes('dashboard')) {
                // Check if user is trying to add/remove from existing dashboard
                // vs create a fresh dashboard with multiple charts
                const isModifyRequest = hasDashboard && /add|another|more|include|delete|remove|take away|get rid/i.test(query);
                const isFreshDashboardRequest = /variety|multiple|several|different types|collection of|new dashboard|create.*dashboard|build.*dashboard/i.test(query);

                if (isModifyRequest && !isFreshDashboardRequest) {
                    finalIntent = 'modify_dashboard';
                } else {
                    finalIntent = 'dashboard';  // Create fresh dashboard with multiple charts
                }
            }
            else if (intentStr.includes('chart')) finalIntent = 'chart';
            else if (intentStr.includes('explain')) finalIntent = 'explain';

            return {
                intent: finalIntent,
                reasoning: parsed.reasoning || 'No reasoning provided'
            };
        } catch {
            // If JSON parsing fails, return fallback
            const fallback = fallbackIntentDetection(query, hasCurrentChart, hasDashboard);
            return { intent: fallback, reasoning: 'Using fallback pattern matching' };
        }

    } catch (error) {
        console.error('Intent detection error, using fallback:', error);
        // Fallback to simple pattern matching if LLM fails
        const fallback = fallbackIntentDetection(query, hasCurrentChart, hasDashboard);
        return { intent: fallback, reasoning: 'Error occurred, using fallback pattern matching' };
    }
}

/**
 * Fallback pattern-based intent detection (used if LLM fails)
 */
function fallbackIntentDetection(query: string, hasCurrentChart: boolean, hasDashboard: boolean = false): AIIntent {
    const lowerQuery = query.toLowerCase();

    // Delete/remove chart from dashboard (must check BEFORE filter to avoid "remove rows" clash)
    if (hasDashboard && /\b(delete|remove|get rid of|take away|discard)\b/i.test(lowerQuery) && /\b(chart|this|it|the)\b/i.test(lowerQuery)) {
        return 'modify_dashboard';
    }

    // Filter patterns
    if (/\b(filter|only show|where|exclude|between|greater than|less than|remove rows)\b/i.test(lowerQuery)) {
        return 'filter';
    }

    // Compare patterns
    if (/\b(compare|vs\.?|versus|difference between|year over year)\b/i.test(lowerQuery)) {
        return 'compare';
    }

    // Forecast patterns
    if (/\b(forecast|predict|project|next \d+|future|extrapolate)\b/i.test(lowerQuery)) {
        return 'forecast';
    }

    // Dashboard patterns - be more specific to avoid false positives
    if (/\b(dashboard|overview)\b/i.test(lowerQuery) && !/\b(histogram|bar|line|scatter|pie|chart|plot|graph|show|create)\b/i.test(lowerQuery.replace(/dashboard|overview/gi, ''))) {
        return 'dashboard';
    }

    // Chart type keywords - comprehensive list
    const chartTypes = /\b(chart|plot|graph|bar|line|scatter|pie|area|radar|heatmap|treemap|sunburst|funnel|gauge|sankey|boxplot|candlestick|histogram|waterfall|parallel|calendar|tree|network|distribution|frequency)\b/i;
    if (chartTypes.test(lowerQuery) || /\b(show|visualize|display|create)\s+(a|the|me)?\s*\w*\s*(of|by|for)/i.test(lowerQuery)) {
        return 'chart';
    }

    if (/\b(make it|change (the|it|this)|switch to|bigger|smaller|resize|recolor|sort by)\b/i.test(lowerQuery) && hasCurrentChart) return 'modify';
    if (/^(why|explain)/i.test(lowerQuery)) return 'explain';
    if (/\?$|^what|^how|^which|average|sum|count/i.test(lowerQuery)) return 'question';

    return 'chart';
}

/**
 * Process any natural language query with intent detection
 */
export async function processAIQuery(
    query: string,
    dataProfile: DataProfile,
    fields: FieldInfo[],
    data: DataRecord[],
    currentEncodings: ShelfPlacement[],
    chatHistory: AIMessage[] = [],
    currentDashboard: DashboardConfig | null = null,
    currentMark: MarkType = 'bar',
    currentChartTitle?: string,
    focusedChartId?: string | null
): Promise<AIQueryResult> {
    const hasCurrentChart = currentEncodings.length > 0;
    const hasDashboard = currentDashboard !== null;

    // Get intent with reasoning
    const dataContext = `${fields.length} fields, ${dataProfile.rowCount} rows`;
    let { intent, reasoning } = await detectIntent(query, hasCurrentChart, hasDashboard, dataContext, chatHistory);

    console.log(`[AI] Intent: ${intent} | Reasoning: ${reasoning}`);

    // Detect delete/remove requests
    const isDeleteRequest = /\b(delete|remove|drop|get rid of|take away|discard|clear)\b/i.test(query)
        && /\b(chart|this|it|the|current|visualization|viz|graph)\b/i.test(query);

    // Dashboard mode: route delete to modify_dashboard
    if (focusedChartId && currentDashboard && isDeleteRequest) {
        console.log(`[AI] Overriding intent from "${intent}" to "modify_dashboard" — delete request on focused chart`);
        intent = 'modify_dashboard';
        reasoning = 'User wants to delete a specific chart from the dashboard';
    }

    // Single chart mode: handle delete directly — clear the chart
    if (!hasDashboard && hasCurrentChart && isDeleteRequest) {
        console.log(`[AI] Delete request in single chart mode — clearing chart`);
        return {
            query,
            intent: 'modify',
            deleteChart: true,
            textAnswer: 'Chart has been removed.',
        };
    }

    // Build visualization context for question answering
    const chartContext = formatChartContext(currentChartTitle, currentMark, currentEncodings);
    const dashboardContext = formatDashboardContext(currentDashboard);

    // Add focused chart context when operating on a specific dashboard chart
    const focusedChartContext = focusedChartId && currentDashboard
        ? formatFocusedChartContext(focusedChartId, currentDashboard)
        : '';

    switch (intent) {
        case 'question':
            return processDataQuestion(query, dataProfile, fields, data, chatHistory, focusedChartContext || chartContext, dashboardContext);
        case 'chart':
            return processChartRequest(query, dataProfile, fields, data, chatHistory);
        case 'modify':
            return processModifyRequest(query, fields, currentEncodings, currentMark, chatHistory);
        case 'dashboard':
            return processDashboardRequest(query, dataProfile, fields);
        case 'modify_dashboard':
            return processModifyDashboardRequest(query, dataProfile, fields, currentDashboard!, chatHistory, focusedChartId);
        case 'explain':
            return processExplainRequest(query, dataProfile, fields, data);
        case 'filter':
            return processFilterRequest(query, dataProfile, fields);
        case 'compare':
            return processCompareRequest(query, dataProfile, fields, data);
        case 'forecast':
            return processForecastRequest(query, dataProfile, fields, data);
        default:
            return processChartRequest(query, dataProfile, fields, data, chatHistory);
    }
}

/**
 * Streaming version of processAIQuery
 * For text-based intents (question, explain), streams the answer in real-time
 * For other intents, falls back to non-streaming processAIQuery
 * Returns { isStreaming: true, intent } for streaming intents so the store knows a stream is active
 */
export async function processAIQueryStreaming(
    query: string,
    dataProfile: DataProfile,
    fields: FieldInfo[],
    data: DataRecord[],
    currentEncodings: ShelfPlacement[],
    chatHistory: AIMessage[] = [],
    currentDashboard: DashboardConfig | null = null,
    currentMark: MarkType = 'bar',
    currentChartTitle?: string,
    focusedChartId?: string | null,
    onChunk?: (chunk: string, accumulated: string) => void,
): Promise<AIQueryResult & { streamed?: boolean }> {
    const hasCurrentChart = currentEncodings.length > 0;
    const hasDashboard = currentDashboard !== null;

    // Get intent with reasoning
    const dataContext = `${fields.length} fields, ${dataProfile.rowCount} rows`;
    let { intent, reasoning } = await detectIntent(query, hasCurrentChart, hasDashboard, dataContext, chatHistory);

    console.log(`[AI Streaming] Intent: ${intent} | Reasoning: ${reasoning}`);

    // Detect delete/remove requests
    const isDeleteRequest = /\b(delete|remove|drop|get rid of|take away|discard|clear)\b/i.test(query)
        && /\b(chart|this|it|the|current|visualization|viz|graph)\b/i.test(query);

    // Dashboard mode: route delete to modify_dashboard
    if (focusedChartId && currentDashboard && isDeleteRequest) {
        console.log(`[AI Streaming] Overriding intent from "${intent}" to "modify_dashboard" — delete request on focused chart`);
        intent = 'modify_dashboard';
        reasoning = 'User wants to delete a specific chart from the dashboard';
    }

    // Single chart mode: handle delete directly — clear the chart
    if (!hasDashboard && hasCurrentChart && isDeleteRequest) {
        console.log(`[AI Streaming] Delete request in single chart mode — clearing chart`);
        return {
            query,
            intent: 'modify',
            deleteChart: true,
            textAnswer: 'Chart has been removed.',
        };
    }

    // Build visualization context for question answering
    const chartContext = formatChartContext(currentChartTitle, currentMark, currentEncodings);
    const dashboardContext = formatDashboardContext(currentDashboard);
    const focusedChartContext = focusedChartId && currentDashboard
        ? formatFocusedChartContext(focusedChartId, currentDashboard)
        : '';

    // Helper to get the provider display name after a call
    const providerName = () => getLastProviderName() || undefined;

    // For text-based intents, use streaming
    if (onChunk && (intent === 'question' || intent === 'explain')) {
        if (intent === 'question') {
            const result = await processDataQuestionStreaming(
                query, dataProfile, fields, data, chatHistory,
                focusedChartContext || chartContext, dashboardContext, onChunk
            );
            return { ...result, streamed: true, provider: providerName() };
        }
        if (intent === 'explain') {
            const result = await processExplainRequestStreaming(
                query, dataProfile, fields, data, onChunk
            );
            return { ...result, streamed: true, provider: providerName() };
        }
    }

    // For non-text intents, fall back to regular processing
    let nonStreamResult: AIQueryResult;
    switch (intent) {
        case 'question':
            nonStreamResult = await processDataQuestion(query, dataProfile, fields, data, chatHistory, focusedChartContext || chartContext, dashboardContext);
            return { ...nonStreamResult, provider: providerName() };
        case 'chart':
            nonStreamResult = await processChartRequest(query, dataProfile, fields, data, chatHistory);
            return { ...nonStreamResult, provider: providerName() };
        case 'modify':
            nonStreamResult = await processModifyRequest(query, fields, currentEncodings, currentMark, chatHistory);
            return { ...nonStreamResult, provider: providerName() };
        case 'dashboard':
            nonStreamResult = await processDashboardRequest(query, dataProfile, fields);
            return { ...nonStreamResult, provider: providerName() };
        case 'modify_dashboard':
            nonStreamResult = await processModifyDashboardRequest(query, dataProfile, fields, currentDashboard!, chatHistory, focusedChartId);
            return { ...nonStreamResult, provider: providerName() };
        case 'explain':
            nonStreamResult = await processExplainRequest(query, dataProfile, fields, data);
            return { ...nonStreamResult, provider: providerName() };
        case 'filter':
            nonStreamResult = await processFilterRequest(query, dataProfile, fields);
            return { ...nonStreamResult, provider: providerName() };
        case 'compare':
            nonStreamResult = await processCompareRequest(query, dataProfile, fields, data);
            return { ...nonStreamResult, provider: providerName() };
        case 'forecast':
            nonStreamResult = await processForecastRequest(query, dataProfile, fields, data);
            return { ...nonStreamResult, provider: providerName() };
        default:
            nonStreamResult = await processChartRequest(query, dataProfile, fields, data, chatHistory);
            return { ...nonStreamResult, provider: providerName() };
    }
}

// ============================================
// Data Question Answering
// ============================================

/**
 * Answer a data question using computed statistics with conversation context
 * Now includes chart and dashboard awareness for better Q&A
 */
async function processDataQuestion(
    query: string,
    dataProfile: DataProfile,
    fields: FieldInfo[],
    data: DataRecord[],
    chatHistory: AIMessage[] = [],
    chartContext: string = '',
    dashboardContext: string = ''
): Promise<AIQueryResult> {
    try {
        const context = formatProfileForLLM(dataProfile);

        // Build conversation context from recent messages
        const recentHistory = chatHistory.slice(-6).map(m =>
            `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
        ).join('\n');

        // Build concise field list for query generation
        const fieldList = fields.map(f => `"${f.name}" (${f.type})`).join(', ');

        const prompt = `You are a helpful data analyst assistant for a data visualization tool called OpenViz. Answer the user's question about the data, charts, or dashboard.

**DATASET OVERVIEW:**
${context}

**AVAILABLE FIELDS:** ${fieldList}

**CURRENT CHART:**
${chartContext || 'No chart currently configured.'}

**DASHBOARD STATUS:**
${dashboardContext || 'No dashboard active.'}

${recentHistory ? `**RECENT CONVERSATION:**
${recentHistory}

` : ''}**USER QUESTION:** "${query}"

**INSTRUCTIONS:**
You can answer questions about:
1. **Data Questions** - statistics, values, patterns in the data
2. **Chart Questions** - "What does this chart show?", "What is the X-axis?", "What fields are being visualized?"
3. **Dashboard Questions** - "What charts are in my dashboard?", "How many charts do I have?", "What does each chart show?"

- If asking about the chart (e.g., "what does this chart show?"), describe the current visualization based on the chart context above
- If asking about the dashboard (e.g., "what's in my dashboard?"), describe the charts using the dashboard status above
- For follow-up questions (like "elaborate", "tell me more"), provide more details based on the previous conversation
- For statistical questions about the data, provide accurate numbers
- IMPORTANT: When generating queries, field names MUST be copied EXACTLY from the AVAILABLE FIELDS list above

If the question requires calculating specific values (sum, average, max, min, count), respond with JSON:
{
    "needsQuery": true,
    "query": {
        "operation": "sum" | "mean" | "min" | "max" | "count" | "distinct",
        "field": "exact field name from available fields",
        "groupBy": "exact field name or null",
        "orderBy": { "field": "exact field name", "direction": "asc" | "desc" },
        "limit": optional number
    }
}

Otherwise, respond with JSON:
{
    "needsQuery": false,
    "answer": "Your detailed, helpful answer here. Be specific and informative."
}

**EXAMPLES:**

Example 1 - "What's the average revenue?"
Fields: "Revenue" (quantitative), "Region" (nominal)
{"needsQuery":true,"query":{"operation":"mean","field":"Revenue"}}

Example 2 - "Which region has the most sales?"
Fields: "Sales" (quantitative), "Region" (nominal)
{"needsQuery":true,"query":{"operation":"sum","field":"Sales","groupBy":"Region","orderBy":{"field":"Sales","direction":"desc"},"limit":1}}

Example 3 - "What does this chart show?"
{"needsQuery":false,"answer":"This chart shows a bar chart of Revenue by Region, using sum aggregation..."}

Respond with ONLY the JSON.`;

        const response = await callAI({
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 1024,
            response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response from AI');
        }

        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Invalid AI response format');
        }

        const aiResponse = JSON.parse(jsonMatch[0]) as {
            needsQuery: boolean;
            query?: DataQuery;
            answer?: string;
        };

        let textAnswer: string;

        if (aiResponse.needsQuery && aiResponse.query) {
            // Execute the data query for accurate results
            const queryResult = executeDataQuery(data, aiResponse.query);

            // Format the result as a natural language answer
            textAnswer = await formatQueryResult(query, queryResult, aiResponse.query);
        } else {
            textAnswer = aiResponse.answer || 'Unable to answer the question.';
        }

        return {
            query,
            intent: 'question',
            textAnswer,
        };

    } catch (error) {
        console.error('Data Question Error:', error);
        return {
            query,
            intent: 'question',
            error: error instanceof Error ? error.message : 'Failed to process question',
        };
    }
}

/**
 * Streaming version of processDataQuestion
 * Phase 1: Non-streamed JSON call to determine if data query is needed
 * Phase 2: Stream the final answer using real SSE/streaming
 */
async function processDataQuestionStreaming(
    query: string,
    dataProfile: DataProfile,
    fields: FieldInfo[],
    data: DataRecord[],
    chatHistory: AIMessage[] = [],
    chartContext: string = '',
    dashboardContext: string = '',
    onChunk: (chunk: string, accumulated: string) => void,
): Promise<AIQueryResult> {
    try {
        const context = formatProfileForLLM(dataProfile);

        // Build conversation context from recent messages
        const recentHistory = chatHistory.slice(-6).map(m =>
            `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
        ).join('\n');

        // Build concise field list for query generation
        const fieldList = fields.map(f => `"${f.name}" (${f.type})`).join(', ');

        const prompt = `You are a helpful data analyst assistant for a data visualization tool called OpenViz. Answer the user's question about the data, charts, or dashboard.

**DATASET OVERVIEW:**
${context}

**AVAILABLE FIELDS:** ${fieldList}

**CURRENT CHART:**
${chartContext || 'No chart currently configured.'}

**DASHBOARD STATUS:**
${dashboardContext || 'No dashboard active.'}

${recentHistory ? `**RECENT CONVERSATION:**
${recentHistory}

` : ''}**USER QUESTION:** "${query}"

**INSTRUCTIONS:**
You can answer questions about:
1. **Data Questions** - statistics, values, patterns in the data
2. **Chart Questions** - "What does this chart show?", "What is the X-axis?", "What fields are being visualized?"
3. **Dashboard Questions** - "What charts are in my dashboard?", "How many charts do I have?", "What does each chart show?"

- If asking about the chart (e.g., "what does this chart show?"), describe the current visualization based on the chart context above
- If asking about the dashboard (e.g., "what's in my dashboard?"), describe the charts using the dashboard status above
- For follow-up questions (like "elaborate", "tell me more"), provide more details based on the previous conversation
- For statistical questions about the data, provide accurate numbers
- IMPORTANT: When generating queries, field names MUST be copied EXACTLY from the AVAILABLE FIELDS list above

If the question requires calculating specific values (sum, average, max, min, count), respond with JSON:
{
    "needsQuery": true,
    "query": {
        "operation": "sum" | "mean" | "min" | "max" | "count" | "distinct",
        "field": "exact field name from available fields",
        "groupBy": "exact field name or null",
        "orderBy": { "field": "exact field name", "direction": "asc" | "desc" },
        "limit": optional number
    }
}

Otherwise, respond with JSON:
{
    "needsQuery": false,
    "answer": "Your detailed, helpful answer here. Be specific and informative."
}

Respond with ONLY the JSON.`;

        // Phase 1: Non-streamed call to get query plan or direct answer
        const response = await callAI({
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 1024,
            response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response from AI');
        }

        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Invalid AI response format');
        }

        const aiResponse = JSON.parse(jsonMatch[0]) as {
            needsQuery: boolean;
            query?: DataQuery;
            answer?: string;
        };

        // Phase 2: Stream the final answer
        let dataContext = '';
        if (aiResponse.needsQuery && aiResponse.query) {
            const queryResult = executeDataQuery(data, aiResponse.query);
            dataContext = `\nData query result for "${aiResponse.query.operation} of ${aiResponse.query.field}${aiResponse.query.groupBy ? ' grouped by ' + aiResponse.query.groupBy : ''}":\n${JSON.stringify(queryResult)}\n`;
        } else if (aiResponse.answer) {
            // Direct answer - no need to stream a second call, just stream the existing text
            // Use simulated streaming for consistency
            let accumulated = '';
            const chars = aiResponse.answer;
            const chunkSize = 4;
            for (let i = 0; i < chars.length; i += chunkSize) {
                const chunk = chars.slice(i, i + chunkSize);
                accumulated += chunk;
                onChunk(chunk, accumulated);
                await new Promise(r => setTimeout(r, 8));
            }
            return { query, intent: 'question', textAnswer: aiResponse.answer };
        }

        // Stream a natural-language answer based on the query result
        const answerPrompt = `You are a helpful data analyst. The user asked: "${query}"

${dataContext}

Provide a clear, concise, and helpful answer based on the data above. Use markdown formatting (bold for numbers, bullet points for lists). Be specific with numbers and data values. Do not wrap in JSON, just write the answer directly.`;

        const textAnswer = await streamAIChatResponse(
            [{ role: 'user', content: answerPrompt }],
            onChunk,
            { temperature: 0.3, maxTokens: 1024 }
        );

        return { query, intent: 'question', textAnswer };

    } catch (error) {
        console.error('Data Question Streaming Error:', error);
        return {
            query,
            intent: 'question',
            error: error instanceof Error ? error.message : 'Failed to process question',
        };
    }
}

/**
 * Streaming version of processExplainRequest
 * Streams the explanation text as it arrives from the LLM
 */
async function processExplainRequestStreaming(
    query: string,
    dataProfile: DataProfile,
    _fields: FieldInfo[],
    _data: DataRecord[],
    onChunk: (chunk: string, accumulated: string) => void,
): Promise<AIQueryResult> {
    try {
        const context = formatProfileForLLM(dataProfile);

        const answerPrompt = `You are a data analyst explaining patterns in data for OpenViz.

Dataset:
${context}

User question: "${query}"

Analyze the data context and provide a clear, detailed explanation. Consider:
- Correlations between fields
- Time-based patterns
- Category distributions
- Potential causes

Write your explanation directly using markdown formatting. Do not wrap in JSON.`;

        const textAnswer = await streamAIChatResponse(
            [{ role: 'user', content: answerPrompt }],
            onChunk,
            { temperature: 0.5, maxTokens: 1024 }
        );

        return { query, intent: 'explain', textAnswer };

    } catch (error) {
        console.error('Explain Streaming Error:', error);
        return {
            query,
            intent: 'explain',
            error: error instanceof Error ? error.message : 'Failed to generate explanation',
        };
    }
}

/**
 * Format query result as natural language
 */
async function formatQueryResult(
    _originalQuery: string,
    result: unknown,
    dataQuery: DataQuery
): Promise<string> {
    // Format based on result type
    if (typeof result === 'number') {
        const formatted = Number.isInteger(result)
            ? result.toLocaleString()
            : result.toLocaleString(undefined, { maximumFractionDigits: 2 });

        const opLabels: Record<string, string> = {
            sum: 'total',
            mean: 'average',
            min: 'minimum',
            max: 'maximum',
            count: 'count',
            distinct: 'distinct count',
        };

        return `The ${opLabels[dataQuery.operation] || dataQuery.operation} of ${dataQuery.field} is **${formatted}**.`;
    }

    if (Array.isArray(result)) {
        // Format grouped results
        const items = result.slice(0, 5).map((row: Record<string, unknown>) => {
            const groupValue = row[dataQuery.groupBy!];
            const aggValue = row[`${dataQuery.operation}_${dataQuery.field}`];
            const formattedAgg = typeof aggValue === 'number'
                ? aggValue.toLocaleString(undefined, { maximumFractionDigits: 2 })
                : aggValue;
            return `• ${groupValue}: ${formattedAgg}`;
        }).join('\n');

        const header = dataQuery.orderBy?.direction === 'desc' ? 'Top' : 'Bottom';
        return `${header} ${dataQuery.limit || result.length} by ${dataQuery.field}:\n${items}`;
    }

    return `Result: ${JSON.stringify(result)}`;
}

// ============================================
// Chart Request Processing
// ============================================

/**
 * Process a chart creation request
 */
async function processChartRequest(
    query: string,
    dataProfile: DataProfile,
    fields: FieldInfo[],
    data: DataRecord[],
    chatHistory: AIMessage[]
): Promise<AIQueryResult> {
    try {
        // Build conversation context
        const recentHistory = chatHistory.slice(-4).map(m =>
            `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
        ).join('\n');

        // Generate detailed field info with sample values for better understanding
        const fieldDetails = fields.map(f => {
            const fieldProfile = dataProfile.fields.find((fp: { name: string }) => fp.name === f.name);
            const samples = fieldProfile?.exampleValues?.slice(0, 3).join(', ') || '';
            const statsInfo = f.type === 'quantitative'
                ? ` [numeric: can be summed/averaged]`
                : f.type === 'temporal'
                    ? ` [date/time field]`
                    : ` [categorical: ${fieldProfile?.uniqueCount || '?'} unique values]`;
            return `- "${f.name}" (${f.type})${statsInfo}${samples ? ` e.g.: ${samples}` : ''}`;
        }).join('\n');

        const prompt = `You are an expert data visualization assistant. Create a meaningful chart configuration.

**DATASET:** ${dataProfile.rowCount} rows, ${fields.length} fields

**AVAILABLE FIELDS (use these names EXACTLY):**
${fieldDetails}

${recentHistory ? `**RECENT CONVERSATION:**\n${recentHistory}\n\n` : ''}**USER REQUEST:** "${query}"

**YOUR TASK:**
1. **Understand the Intent**: What is the user trying to visualize or discover?
2. **Infer Fields**: Match natural language (e.g., "sales", "revenue") to actual field names
3. **Choose Chart Type**: Select the most appropriate visualization
4. **Add Reasoning**: Explain your choices briefly

**CHART TYPE SELECTION GUIDE:**
- **bar**: Categorical comparison (e.g., "sales by region", "revenue by product")
- **line**: Temporal trends (e.g., "sales over time", "growth by month")
- **point** (scatter): Correlation between two quantitative variables
- **area**: Trends with emphasis on magnitude
- **arc** (pie): Part-to-whole relationships (use sparingly)
- **histogram**: Distribution of a single quantitative variable (frequency bins)
- **boxplot**: Statistical distribution showing quartiles
- **candlestick**: Financial OHLC data (open, high, low, close)
- **radar**: Multi-dimensional comparison (multiple metrics per item)
- **heatmap**: Intensity matrix between two categorical variables
- **treemap**: Hierarchical data as nested rectangles
- **sunburst**: Hierarchical data as concentric rings
- **funnel**: Stage-based conversion flow
- **gauge**: Single KPI/metric display
- **sankey**: Flow/relationship diagram
- **waterfall**: Cumulative changes (gains/losses)
- **parallel**: Multi-dimensional data with parallel axes
- **calendar**: Time-based heatmap over calendar
- **tree**: Hierarchical tree structure

**FIELD MATCHING TIPS:**
- "sales", "revenue", "amount" → Look for fields containing these words
- "time", "date", "month", "year" → Look for temporal fields
- "region", "country", "category", "type" → Look for categorical fields
- If exact match not found, use the CLOSEST semantic match

**AGGREGATION RULES:**
- Categorical X + Quantitative Y → Use aggregation (sum, mean, count)
- Temporal X + Quantitative Y → Use aggregation
- For "count" or "number of", use aggregate: "count"
- For "average" or "mean", use aggregate: "mean"
- For "total" or "sum", use aggregate: "sum"
- For histogram → bin: true on the quantitative field

**OUTPUT FORMAT (JSON only):**
{
  "mark": "bar|line|point|area|arc|histogram|boxplot|candlestick|radar|heatmap|treemap|sunburst|funnel|gauge|sankey|waterfall|parallel|calendar|tree",
  "encodings": [
    {
      "channel": "x|y|theta|color|size",
      "fieldName": "exact field name from available fields",
      "aggregate": "sum|mean|count|null",
      "bin": true|false
    }
  ],
  "title": "Descriptive chart title",
  "reasoning": "Brief explanation: why this chart type and these fields (2-3 sentences)"
}

**CRITICAL RULES:**
- COPY field names EXACTLY as listed in AVAILABLE FIELDS — do NOT rephrase, abbreviate, or invent field names
- Include reasoning in your response
- Make smart inferences if user's language is vague
- Default to the most common/obvious visualization for the request
- If you cannot match a field from the user's request, use the CLOSEST available field rather than inventing one

**IF REQUEST IS VAGUE** (e.g., "show me something interesting", "explore the data", "make a chart"):
- Pick the first nominal/categorical field for X-axis
- Pick the first quantitative field for Y-axis with aggregate "sum"
- Use mark "bar" as default
- Give it a descriptive title based on the fields chosen

**FEW-SHOT EXAMPLES:**

Example 1 - User: "Show sales by region"
Fields: "Region" (nominal), "Sales_Amount" (quantitative), "Date" (temporal)
Output:
{"mark":"bar","encodings":[{"channel":"x","fieldName":"Region","aggregate":null,"bin":false},{"channel":"y","fieldName":"Sales_Amount","aggregate":"sum","bin":false}],"title":"Total Sales by Region","reasoning":"Bar chart comparing sales across regions using sum aggregation."}

Example 2 - User: "Revenue trend over time"
Fields: "Month" (temporal), "Revenue" (quantitative), "Category" (nominal)
Output:
{"mark":"line","encodings":[{"channel":"x","fieldName":"Month","aggregate":null,"bin":false},{"channel":"y","fieldName":"Revenue","aggregate":"sum","bin":false}],"title":"Revenue Trend Over Time","reasoning":"Line chart to show temporal revenue trend."}

Example 3 - User: "Distribution of prices"
Fields: "Price" (quantitative), "Product" (nominal)
Output:
{"mark":"bar","encodings":[{"channel":"x","fieldName":"Price","aggregate":null,"bin":true},{"channel":"y","fieldName":"Price","aggregate":"count","bin":false}],"title":"Price Distribution","reasoning":"Histogram showing frequency distribution of prices using binning."}

Respond with ONLY valid JSON.`;

        const response = await callAI({
            messages: [
                { role: 'system', content: 'You are an expert data visualization assistant that responds with JSON. Respond with ONLY valid JSON, no markdown, no explanation.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.1,
            max_tokens: 1024,
            response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response from AI');
        }

        const aiResponse = extractJSON(content) as {
            mark: MarkType;
            encodings: Array<{
                channel: EncodingChannel;
                fieldName: string;
                aggregate?: string;
                bin?: boolean;
            }>;
            title?: string;
            reasoning?: string;
        };

        // Log the AI's reasoning
        if (aiResponse.reasoning) {
            console.log(`[AI Chart Creation] Reasoning: ${aiResponse.reasoning}`);
        }

        const chartConfig = buildChartConfig(aiResponse, fields);

        // Generate smart annotations for quantitative data
        const yEncoding = chartConfig.encodings.find(e => e.channel === 'y');
        const xEncoding = chartConfig.encodings.find(e => e.channel === 'x');

        if (yEncoding && yEncoding.field.type === 'quantitative' && data.length > 0) {
            try {
                // Extract Y-axis values for annotation analysis
                const yFieldName = yEncoding.field.name;
                const yValues = data
                    .map(row => Number(row[yFieldName]))
                    .filter(v => !isNaN(v));

                // Get X-axis data for positioning (if available)
                const xAxisData = xEncoding
                    ? data.map(row => row[xEncoding.field.name] as string | number)
                    : undefined;

                // Generate annotations (outliers + extremes)
                const annotations = generateAnnotations(yValues, yFieldName, {
                    includeOutliers: true,
                    includeExtremes: true,
                    maxAnnotations: 5,
                    outlierThreshold: 2,
                    xAxisData,
                });

                if (annotations.length > 0) {
                    chartConfig.annotations = annotations;
                    console.log(`[Annotations] Added ${annotations.length} annotations to chart`);
                }
            } catch (error) {
                console.error('[Annotations] Failed to generate annotations:', error);
                // Don't fail the entire chart creation if annotations fail
            }
        }

        return {
            query,
            intent: 'chart',
            chartConfig,
            textAnswer: aiResponse.reasoning || `Created ${aiResponse.mark} chart: "${aiResponse.title || 'Untitled'}"`
        };

    } catch (error) {
        console.error('Chart Request Error:', error);
        const msg = error instanceof Error ? error.message : 'Failed to create chart';
        return {
            query,
            intent: 'chart',
            error: `${msg}. Try being more specific about which fields to use (e.g., "bar chart of Sales by Region").`,
        };
    }
}

// ============================================
// Modify Request Processing (Contextual)
// ============================================

/**
 * Process a modification to the current chart
 */
async function processModifyRequest(
    query: string,
    fields: FieldInfo[],
    currentEncodings: ShelfPlacement[],
    currentMark: MarkType,
    _chatHistory: AIMessage[]
): Promise<AIQueryResult> {
    try {
        // Get current chart configuration in detail
        const currentChart = currentEncodings.map(e =>
            `- ${e.channel}: ${e.field.name} (type: ${e.field.type})${e.aggregate ? `, aggregated by ${e.aggregate}` : ''}`
        ).join('\n');

        const fieldList = fields.map(f => `${f.name} (${f.type})`).join(', ');

        const prompt = `You are an expert chart modification assistant. Analyze the user's natural language request and modify the chart accordingly.

**CURRENT CHART:**
- Mark Type: ${currentMark}
- Encodings:
${currentChart}

**AVAILABLE FIELDS:** ${fieldList}

**USER REQUEST:** "${query}"

**MODIFICATION TYPES YOU CAN HANDLE:**

1. **Chart Type Changes**
   - "make it a line chart", "switch to bar chart", "use pie chart"
   - Available marks: bar, line, point, area, arc (for pie charts)

2. **Size/Dimensions**
   - "make it bigger", "increase size", "make it smaller"
   - Set width/height: bigger = 800x600, smaller = 400x300, default = 600x400

3. **Colors**
   - "make it blue", "all bars should be green" → Use fixedColor
   - "add color by [field]" → Add color encoding
   - "remove color", "uniform color" → Remove color encoding, clear fixedColor

4. **Sorting/Ordering**
   - "sort by value", "order descending", "arrange by size"
   - Add sort property to the appropriate encoding

5. **Data Filters**
   - "show top 10", "only first 5", "limit to 20"
   - Add filter property

6. **Aggregations**
   - "show sum instead", "use average", "count instead"
   - Modify aggregate property

7. **Title/Labels**
   - "change title to X", "rename to Y"
   - Modify title property

**PRESERVATION RULE:**
This is a PATCH operation — you MUST preserve ALL existing chart settings unless the user EXPLICITLY asks to change them. Copy the current mark, all encodings, title, etc. Only modify the specific aspect mentioned.

**CRITICAL RULES:**
- PRESERVE everything not mentioned in the user's request
- If user asks for color by field name, find the closest matching field
- For size changes: bigger = width:800/height:600, smaller = width:400/height:300
- For pie charts, use mark:"arc" with theta encoding

**OUTPUT FORMAT (JSON only, no markdown):**
{
  "mark": "bar|line|point|area|arc",
  "encodings": [
    {
      "channel": "x|y|theta|color|size",
      "fieldName": "exact field name",
      "aggregate": "sum|mean|count|null",
      "sort": "ascending|descending|null"
    }
  ],
  "title": "chart title or null",
  "fixedColor": "color name/#hex or null",
  "width": 600,
  "height": 400,
  "reasoning": "Brief explanation of changes made (1 sentence)"
}

**FEW-SHOT EXAMPLES:**

Example 1 - User: "make it bigger"
Current: bar chart, X=Region, Y=Sales (sum)
Output:
{"mark":"bar","encodings":[{"channel":"x","fieldName":"Region","aggregate":null},{"channel":"y","fieldName":"Sales","aggregate":"sum"}],"title":null,"fixedColor":null,"width":800,"height":600,"reasoning":"Increased chart dimensions to 800x600."}

Example 2 - User: "change to line chart"
Current: bar chart, X=Month, Y=Revenue (sum)
Output:
{"mark":"line","encodings":[{"channel":"x","fieldName":"Month","aggregate":null},{"channel":"y","fieldName":"Revenue","aggregate":"sum"}],"title":null,"fixedColor":null,"width":600,"height":400,"reasoning":"Changed chart type from bar to line, preserved all encodings."}

Example 3 - User: "add color by Category"
Current: bar chart, X=Region, Y=Sales (sum)
Output:
{"mark":"bar","encodings":[{"channel":"x","fieldName":"Region","aggregate":null},{"channel":"y","fieldName":"Sales","aggregate":"sum"},{"channel":"color","fieldName":"Category","aggregate":null}],"title":null,"fixedColor":null,"width":600,"height":400,"reasoning":"Added color encoding by Category field."}

Respond ONLY with valid JSON.`;

        const response = await callAI({
            messages: [
                { role: 'system', content: 'You are an expert chart modification assistant. Preserve all existing chart settings unless explicitly asked to change them. Respond with ONLY valid JSON.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.15,
            max_tokens: 1024,
            response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response from AI');
        }

        const aiResponse = extractJSON(content) as {
            mark: MarkType;
            encodings: Array<{
                channel: EncodingChannel;
                fieldName: string;
                aggregate?: string;
                sort?: 'ascending' | 'descending';
            }>;
            title?: string;
            fixedColor?: string;
            width?: number;
            height?: number;
            reasoning?: string;
        };

        // Log the AI's reasoning
        if (aiResponse.reasoning) {
            console.log(`[AI Modification] Reasoning: ${aiResponse.reasoning}`);
        }

        const chartConfig = buildChartConfig(aiResponse, fields);

        // Apply width and height if specified
        if (aiResponse.width) {
            chartConfig.width = aiResponse.width;
        }
        if (aiResponse.height) {
            chartConfig.height = aiResponse.height;
        }

        return {
            query,
            intent: 'modify',
            chartConfig,
            textAnswer: `Updated chart to ${aiResponse.mark} chart`,
        };

    } catch (error) {
        console.error('Modify Request Error:', error);
        const msg = error instanceof Error ? error.message : 'Failed to modify chart';
        return {
            query,
            intent: 'modify',
            error: `${msg}. Try a simpler change like "make it bigger" or "change to line chart".`,
        };
    }
}

// ============================================
// Dashboard Request Processing
// ============================================

/**
 * Process a dashboard creation request with retry logic
 */
async function processDashboardRequest(
    query: string,
    dataProfile: DataProfile,
    fields: FieldInfo[]
): Promise<AIQueryResult> {
    // Create detailed field info grouped by type
    const numericFields = fields.filter(f => f.type === 'quantitative');
    const categoricalFields = fields.filter(f => f.type === 'nominal' || f.type === 'ordinal');
    const temporalFields = fields.filter(f => f.type === 'temporal');

    const fieldList = fields.map(f => {
        const fieldProfile = dataProfile.fields.find((fp: { name: string }) => fp.name === f.name);
        const samples = fieldProfile?.exampleValues?.slice(0, 3).join(', ') || '';
        const statsInfo = f.type === 'quantitative'
            ? ` [numeric: min=${f.stats.min}, max=${f.stats.max}]`
            : f.type === 'temporal'
                ? ` [date/time]`
                : ` [${fieldProfile?.uniqueCount || '?'} unique values]`;
        return `- "${f.name}" (${f.type})${statsInfo}${samples ? ` e.g.: ${samples}` : ''}`;
    }).join('\n');

    const prompt = `You are an expert data visualization assistant creating a multi-chart dashboard.

**DATASET:** ${dataProfile.rowCount} rows, ${fields.length} fields

**FIELD SUMMARY:**
- Numeric fields: ${numericFields.map(f => `"${f.name}"`).join(', ') || 'none'}
- Categorical fields: ${categoricalFields.map(f => `"${f.name}"`).join(', ') || 'none'}
- Temporal fields: ${temporalFields.map(f => `"${f.name}"`).join(', ') || 'none'}

**AVAILABLE FIELDS (COPY names EXACTLY):**
${fieldList}

**USER REQUEST:** "${query}"

**CHART TYPE SELECTION GUIDE:**
- **bar**: Categorical comparison (nominal X + quantitative Y)
- **line**: Temporal trends (temporal X + quantitative Y)
- **point** (scatter): Correlation between two quantitative variables
- **area**: Trends with emphasis on magnitude
- **arc** (pie): Part-to-whole relationships (use sparingly, max 1 per dashboard)

**DASHBOARD DESIGN RULES:**
1. Create 2-4 charts that show DIFFERENT aspects of the data
2. Use VARIETY in chart types — do NOT repeat the same chart type if possible
3. Use DIFFERENT field combinations for each chart (avoid redundancy)
4. COPY field names EXACTLY from the list above — do NOT invent or rephrase names
5. Use categorical/temporal fields for X-axis, quantitative fields for Y-axis

**AGGREGATION RULES:**
- Categorical X + Quantitative Y → aggregate: "sum" (for totals) or "mean" (for averages)
- Temporal X + Quantitative Y → aggregate: "sum" or "mean"
- For "count" or frequency → aggregate: "count"
- For arc/pie charts → use theta channel with aggregate: "sum"

**OUTPUT FORMAT (JSON only):**
{
    "title": "Descriptive dashboard title",
    "charts": [
        {
            "mark": "bar|line|point|area|arc",
            "encodings": [
                {"channel": "x", "fieldName": "EXACT_FIELD_NAME", "aggregate": null},
                {"channel": "y", "fieldName": "EXACT_FIELD_NAME", "aggregate": "sum"}
            ],
            "title": "Descriptive chart title"
        }
    ],
    "layout": {"cols": 2, "rows": 2}
}

Respond with ONLY valid JSON.`;

    // Retry logic - try up to 3 times
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const retryHint = attempt > 1
                ? `\n\nNOTE: Previous attempt failed. Make sure to use EXACT field names from the list and produce valid JSON.`
                : '';

            const response = await callAI({
                    messages: [
                    { role: 'system', content: 'You are an expert data visualization assistant that responds with JSON. Respond with ONLY valid JSON, no markdown, no explanation.' },
                    { role: 'user', content: prompt + retryHint }
                ],
                temperature: attempt === 1 ? 0.2 : 0.1, // Lower temp on retries
                max_tokens: 2048,
                response_format: { type: 'json_object' }, // Request JSON mode
            });

            const content = response.choices[0]?.message?.content;
            if (!content) {
                throw new Error('No response from AI');
            }

            // Try to parse directly first (JSON mode should give clean output)
            let aiResponse: {
                title: string;
                charts: Array<{
                    mark: MarkType;
                    encodings: Array<{
                        channel: EncodingChannel;
                        fieldName: string;
                        aggregate?: string;
                    }>;
                    title?: string;
                }>;
                layout: { cols: number; rows: number };
            };

            try {
                aiResponse = JSON.parse(content);
            } catch {
                // Fallback to extractJSON if direct parse fails
                aiResponse = extractJSON(content) as typeof aiResponse;
            }

            // Build dashboard config
            const charts: ChartConfig[] = aiResponse.charts.map((chart) =>
                buildChartConfig(chart, fields)
            );

            const layout: DashboardLayout = {
                cols: aiResponse.layout?.cols || 2,
                rows: aiResponse.layout?.rows || 2,
                items: charts.map((chart, index) => ({
                    chartId: chart.id,
                    col: index % (aiResponse.layout?.cols || 2),
                    row: Math.floor(index / (aiResponse.layout?.cols || 2)),
                    colSpan: 1,
                    rowSpan: 1,
                })),
            };

            const dashboardConfig: DashboardConfig = {
                id: generateId(),
                title: sanitizeOutput(aiResponse.title || 'Dashboard'),
                charts,
                layout,
                createdAt: new Date(),
            };

            return {
                query,
                intent: 'dashboard',
                dashboardConfig,
                textAnswer: `Created dashboard "${dashboardConfig.title}" with ${charts.length} charts`,
            };

        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.error(`Dashboard Request Attempt ${attempt} failed:`, lastError.message);

            // Wait before retry
            if (attempt < 3) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }

    // All retries failed - create a fallback dashboard with basic charts
    console.error('All dashboard creation attempts failed, creating fallback dashboard');

    // Find suitable fields for a simple dashboard
    const nominalFields = fields.filter(f => f.type === 'nominal').slice(0, 2);
    const quantFields = fields.filter(f => f.type === 'quantitative').slice(0, 2);

    if (nominalFields.length === 0 || quantFields.length === 0) {
        return {
            query,
            intent: 'dashboard',
            error: lastError?.message || 'Failed to create dashboard',
        };
    }

    // Create a simple fallback dashboard
    const fallbackCharts: ChartConfig[] = quantFields.slice(0, 2).map((qField) => {
        const xField = nominalFields[0]!;
        return {
            id: generateId(),
            mark: 'bar' as MarkType,
            encodings: [
                {
                    id: generateId(),
                    field: xField,
                    channel: 'x' as EncodingChannel,
                    aggregate: undefined,
                    bin: undefined
                },
                {
                    id: generateId(),
                    field: qField,
                    channel: 'y' as EncodingChannel,
                    aggregate: 'sum' as AggregateFunction,
                    bin: undefined
                },
            ],
            title: `${qField.name} by ${xField.name}`,
            width: 'container',
            height: 400,
            interactive: true,
        };
    });

    const fallbackDashboard: DashboardConfig = {
        id: generateId(),
        title: 'Data Dashboard',
        charts: fallbackCharts,
        layout: {
            cols: 2,
            rows: 1,
            items: fallbackCharts.map((chart, i) => ({
                chartId: chart.id,
                col: i,
                row: 0,
                colSpan: 1,
                rowSpan: 1,
            })),
        },
        createdAt: new Date(),
    };

    return {
        query,
        intent: 'dashboard',
        dashboardConfig: fallbackDashboard,
        textAnswer: `Created a basic dashboard (AI had issues, showing default view). Try specifying fields, e.g., "Create a dashboard showing Sales by Region and Revenue over Time".`,
    };
}

// ============================================
// Modify Dashboard Request Processing
// ============================================

/**
 * Process a request to modify an existing dashboard (add/remove charts)
 * When focusedChartId is provided and the request is a delete/remove,
 * we can directly remove the focused chart without needing the LLM.
 */
async function processModifyDashboardRequest(
    query: string,
    _dataProfile: DataProfile,
    fields: FieldInfo[],
    currentDashboard: DashboardConfig,
    _chatHistory: AIMessage[],
    focusedChartId?: string | null
): Promise<AIQueryResult> {
    try {
        // SHORTCUT: If the user is focused on a specific chart and asks to delete/remove it,
        // we can handle this directly without calling the LLM — more reliable and faster.
        const isDeleteRequest = /\b(delete|remove|drop|get rid of|take away|discard)\b/i.test(query);
        const isDeleteThis = isDeleteRequest && /\b(this|it|the chart|this chart|current)\b/i.test(query);

        if (focusedChartId && (isDeleteThis || isDeleteRequest)) {
            const chartToRemove = currentDashboard.charts.find(c => c.id === focusedChartId);
            if (chartToRemove) {
                const updatedCharts = currentDashboard.charts.filter(c => c.id !== focusedChartId);
                const cols = updatedCharts.length <= 2 ? 2 : Math.min(3, Math.ceil(Math.sqrt(updatedCharts.length)));
                const rows = Math.ceil(updatedCharts.length / cols) || 1;

                const layout: DashboardLayout = {
                    cols,
                    rows,
                    items: updatedCharts.map((chart, index) => ({
                        chartId: chart.id,
                        col: index % cols,
                        row: Math.floor(index / cols),
                        colSpan: 1,
                        rowSpan: 1,
                    })),
                };

                const dashboardConfig: DashboardConfig = {
                    ...currentDashboard,
                    charts: updatedCharts,
                    layout,
                };

                return {
                    query,
                    intent: 'modify_dashboard',
                    dashboardConfig,
                    textAnswer: `Removed "${chartToRemove.title || chartToRemove.mark + ' chart'}" from dashboard (${updatedCharts.length} charts remaining)`,
                };
            }
        }

        // Describe current dashboard with details
        const currentCharts = currentDashboard.charts.map((c, i) => {
            const xEnc = c.encodings.find(e => e.channel === 'x');
            const yEnc = c.encodings.find(e => e.channel === 'y');
            let desc = `${i + 1}. "${c.title || c.mark + ' chart'}" (${c.mark})`;
            if (xEnc && yEnc) {
                desc += ` - Shows ${yEnc.field.name} by ${xEnc.field.name}`;
            }
            return desc;
        }).join('\n');

        // Get list of already used chart types and field combinations
        const usedChartTypes = currentDashboard.charts.map(c => c.mark);
        const usedFieldCombos = currentDashboard.charts.map(c => {
            const xEnc = c.encodings.find(e => e.channel === 'x');
            const yEnc = c.encodings.find(e => e.channel === 'y');
            return xEnc && yEnc ? `${xEnc.field.name}+${yEnc.field.name}` : '';
        }).filter(Boolean);

        const prompt = `You are modifying an existing dashboard. Analyze the user's request carefully and determine what changes to make.

**CURRENT DASHBOARD:** "${currentDashboard.title}"
**CURRENT CHARTS (${currentDashboard.charts.length} total):**
${currentCharts || 'No charts yet.'}

**ALREADY USED:** 
- Chart types: ${usedChartTypes.length > 0 ? usedChartTypes.join(', ') : 'None'}
- Field combinations: ${usedFieldCombos.length > 0 ? usedFieldCombos.join(', ') : 'None'}

**AVAILABLE FIELDS:** ${fields.map(f => `${f.name} (${f.type})`).join(', ')}

**USER REQUEST:** "${query}"

**SUPPORTED ACTIONS:**

1. **add** - Add ONE new chart to the dashboard
   - Use when: "add a bar chart", "include a pie chart", "add more", "another chart"
   - **CRITICAL**: When adding, create VARIETY!
     - Use a DIFFERENT chart type than already exists (if possible)
     - Use DIFFERENT field combinations for X/Y axes
     - If user doesn't specify a type, pick something NOT already in the dashboard

2. **remove** - Remove ONE specific chart by index
   - Use when: "remove chart 2", "delete the first one"
   - removeIndex: 0-based (chart 1 → index 0)

3. **removeAll** - Remove ALL charts from dashboard
   - Use when: "remove all charts", "delete everything", "clear the dashboard"

4. **replace** - Remove all charts AND add new ones
   - Use when: "replace with X", "change all charts to Y"
   - Include new chart configs in newCharts array

**CHART TYPE GUIDE (pick something NOT already used):**
- bar: Categorical comparison
- line: Trends over time
- point (scatter): Correlation between two numbers
- area: Magnitude over time
- arc (pie): Part-to-whole breakdown

**OUTPUT FORMAT (JSON only):**
{
  "action": "add|remove|removeAll|replace",
  "reasoning": "Brief explanation of what you understood from the request",
  "chart": {
    "mark": "bar|line|point|area|arc",
    "encodings": [
      {"channel": "x", "fieldName": "field name"},
      {"channel": "y", "fieldName": "field name", "aggregate": "sum|mean|count"}
    ],
    "title": "descriptive chart title"
  },
  "removeIndex": 0,
  "newCharts": [...]
}

**CRITICAL RULES FOR ADD ACTION:**
- AVOID using the same chart type as already exists in dashboard
- AVOID using the same field combination (X+Y) as existing charts
- Pick INTERESTING field combinations that show different aspects of data
- Use appropriate aggregations (sum, mean, count) for quantitative Y-axis fields

Respond with ONLY valid JSON.`;


        const response = await callAI({
            messages: [
                { role: 'system', content: 'You are a JSON generator. Respond with ONLY valid JSON, no markdown, no explanation.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.1,
            max_tokens: 2048, // Increased for multiple charts in replace action
            response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response from AI');
        }

        const aiResponse = extractJSON(content) as {
            action: 'add' | 'remove' | 'removeAll' | 'replace';
            reasoning?: string;
            chart?: {
                mark: MarkType;
                encodings: Array<{
                    channel: EncodingChannel;
                    fieldName: string;
                    aggregate?: string;
                }>;
                title?: string;
            };
            removeIndex?: number;
            newCharts?: Array<{
                mark: MarkType;
                encodings: Array<{
                    channel: EncodingChannel;
                    fieldName: string;
                    aggregate?: string;
                }>;
                title?: string;
            }>;
        };

        // Log AI's understanding
        if (aiResponse.reasoning) {
            console.log(`[AI Dashboard Mod] Reasoning: ${aiResponse.reasoning}`);
        }

        let updatedCharts = [...currentDashboard.charts];
        let textAnswer: string;

        switch (aiResponse.action) {
            case 'add':
                if (!aiResponse.chart) {
                    throw new Error('Chart configuration missing for add action');
                }
                const newChart = buildChartConfig(aiResponse.chart, fields);
                updatedCharts.push(newChart);
                textAnswer = `Added "${aiResponse.chart.title || aiResponse.chart.mark + ' chart'}" to dashboard (now ${updatedCharts.length} charts)`;
                break;

            case 'remove':
                if (aiResponse.removeIndex === undefined) {
                    throw new Error('Remove index missing for remove action');
                }
                const removedChart = updatedCharts[aiResponse.removeIndex];
                updatedCharts.splice(aiResponse.removeIndex, 1);
                textAnswer = `Removed "${removedChart?.title || 'chart'}" from dashboard (now ${updatedCharts.length} charts)`;
                break;

            case 'removeAll':
                const count = updatedCharts.length;
                updatedCharts = [];
                textAnswer = `Removed all ${count} charts from dashboard`;
                break;

            case 'replace':
                if (!aiResponse.newCharts || aiResponse.newCharts.length === 0) {
                    throw new Error('New charts missing for replace action');
                }
                const oldCount = updatedCharts.length;
                updatedCharts = aiResponse.newCharts.map(c => buildChartConfig(c, fields));
                textAnswer = `Replaced ${oldCount} charts with ${updatedCharts.length} new ${updatedCharts.length === 1 ? 'chart' : 'charts'}`;
                break;

            default:
                throw new Error(`Unknown action: ${aiResponse.action}`);
        }

        // Recalculate layout
        const cols = updatedCharts.length <= 2 ? 2 : Math.min(3, Math.ceil(Math.sqrt(updatedCharts.length)));
        const rows = Math.ceil(updatedCharts.length / cols);

        const layout: DashboardLayout = {
            cols,
            rows,
            items: updatedCharts.map((chart, index) => ({
                chartId: chart.id,
                col: index % cols,
                row: Math.floor(index / cols),
                colSpan: 1,
                rowSpan: 1,
            })),
        };

        const dashboardConfig: DashboardConfig = {
            ...currentDashboard,
            charts: updatedCharts,
            layout,
        };

        return {
            query,
            intent: 'modify_dashboard',
            dashboardConfig,
            textAnswer,
        };

    } catch (error) {
        console.error('Modify Dashboard Error:', error);
        return {
            query,
            intent: 'modify_dashboard',
            error: error instanceof Error ? error.message : 'Failed to modify dashboard',
        };
    }
}

// ============================================
// Explain Request Processing
// ============================================

/**
 * Process an explanation request (Why questions)
 */
async function processExplainRequest(
    query: string,
    dataProfile: DataProfile,
    fields: FieldInfo[],
    _data: DataRecord[]
): Promise<AIQueryResult> {
    try {
        const context = formatProfileForLLM(dataProfile);

        const prompt = `You are a data analyst explaining patterns in data.

Dataset:
${context}

User question: "${query}"

Analyze the data context and provide an explanation. Consider:
- Correlations between fields
- Time-based patterns
- Category distributions
- Potential causes

Respond with JSON:
{
    "explanation": "Your detailed explanation here",
    "relatedFields": ["field1", "field2"],
    "suggestedChart": {
        "mark": "bar" | "line" | "point",
        "encodings": [
            {"channel": "x", "fieldName": "field", "aggregate": null},
            {"channel": "y", "fieldName": "field", "aggregate": "sum"}
        ],
        "title": "Supporting visualization"
    }
}`;

        const response = await callAI({
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.5,
            max_tokens: 1024,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response from AI');
        }

        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Invalid AI response format');
        }

        const aiResponse = JSON.parse(jsonMatch[0]) as {
            explanation: string;
            relatedFields: string[];
            suggestedChart?: {
                mark: MarkType;
                encodings: Array<{
                    channel: EncodingChannel;
                    fieldName: string;
                    aggregate?: string;
                }>;
                title?: string;
            };
        };

        let chartConfig: ChartConfig | undefined;
        if (aiResponse.suggestedChart) {
            chartConfig = buildChartConfig(aiResponse.suggestedChart, fields);
        }

        const insight: DataInsight = {
            id: generateId(),
            type: 'summary',
            title: 'Analysis',
            description: aiResponse.explanation,
            confidence: 0.8,
            relatedFields: aiResponse.relatedFields,
        };

        return {
            query,
            intent: 'explain',
            textAnswer: aiResponse.explanation,
            chartConfig,
            insights: [insight],
        };

    } catch (error) {
        console.error('Explain Request Error:', error);
        return {
            query,
            intent: 'explain',
            error: error instanceof Error ? error.message : 'Failed to generate explanation',
        };
    }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Build ChartConfig from AI response with defensive checks and fuzzy field matching
 */
/**
 * Scored fuzzy field matching — shared across all request handlers.
 * Returns the best-matching field using a ranked scoring system.
 */
function findFieldFuzzy(name: string, fields: FieldInfo[]): FieldInfo | undefined {
    if (!name) return undefined;
    const input = name.toLowerCase().trim();
    if (!input) return undefined;

    // Normalize: collapse underscores, hyphens, spaces → single space
    const normalize = (s: string) => s.toLowerCase().replace(/[_\-\s]+/g, ' ').trim();
    const normalizedInput = normalize(input);

    let bestField: FieldInfo | undefined;
    let bestScore = 0;

    for (const field of fields) {
        const fieldLower = field.name.toLowerCase();
        const normalizedField = normalize(field.name);
        let score = 0;

        // 100: Exact match (case-insensitive)
        if (fieldLower === input) {
            return field; // immediate return
        }

        // 90: Match ignoring separators (underscores/hyphens/spaces)
        if (normalizedField === normalizedInput) {
            score = Math.max(score, 90);
        }

        // 80: Field starts with input
        if (fieldLower.startsWith(input)) {
            score = Math.max(score, 80);
        }

        // 75: Input starts with field name
        if (input.startsWith(fieldLower)) {
            score = Math.max(score, 75);
        }

        // 70: Input is a whole word within field name (word boundary)
        const fieldWords = normalizedField.split(' ');
        const inputWords = normalizedInput.split(' ');
        if (fieldWords.some(w => w === normalizedInput)) {
            score = Math.max(score, 70);
        }

        // 60: Field contains input as substring
        if (fieldLower.includes(input)) {
            score = Math.max(score, 60);
        }

        // 50: Input contains field name as substring
        if (input.includes(fieldLower)) {
            score = Math.max(score, 50);
        }

        // 30-50: Word-level partial matching (scored by proportion of matching words)
        if (inputWords.length > 0 && fieldWords.length > 0) {
            const matchingWords = inputWords.filter(iw =>
                iw.length >= 2 && fieldWords.some(fw => fw.includes(iw) || iw.includes(fw))
            );
            if (matchingWords.length > 0) {
                const proportion = matchingWords.length / Math.max(inputWords.length, fieldWords.length);
                const wordScore = 30 + Math.round(proportion * 20); // 30-50
                score = Math.max(score, wordScore);
            }
        }

        if (score > bestScore) {
            bestScore = score;
            bestField = field;
        }
    }

    return bestField;
}

function buildChartConfig(
    aiResponse: {
        mark?: MarkType;
        encodings?: Array<{
            channel: EncodingChannel;
            fieldName?: string;
            field?: string; // Alternative key name LLM might use
            aggregate?: string;
            bin?: boolean;
        }>;
        title?: string;
    },
    fields: FieldInfo[]
): ChartConfig {
    const encodings: ShelfPlacement[] = [];

    // Helper: Get recommended default fields based on data types
    const getDefaultXField = (): FieldInfo | undefined => {
        // Prefer nominal/categorical for X
        return fields.find(f => f.type === 'nominal')
            || fields.find(f => f.type === 'ordinal')
            || fields.find(f => f.type === 'temporal')
            || fields[0];
    };

    const getDefaultYField = (): FieldInfo | undefined => {
        // Prefer quantitative for Y
        return fields.find(f => f.type === 'quantitative')
            || fields[1]
            || fields[0];
    };

    // Defensive check for encodings array
    const responseEncodings = Array.isArray(aiResponse?.encodings)
        ? aiResponse.encodings
        : [];

    for (const enc of responseEncodings) {
        // Handle both 'fieldName' and 'field' as possible keys
        const fieldNameFromResponse = enc.fieldName || enc.field || '';
        const field = findFieldFuzzy(fieldNameFromResponse, fields);

        if (field && enc.channel) {
            // Auto-add aggregation for quantitative fields on Y axis if not specified
            let aggregate = enc.aggregate as ShelfPlacement['aggregate'];
            if (!aggregate && field.type === 'quantitative' && (enc.channel === 'y' || enc.channel === 'theta')) {
                aggregate = 'sum';
            }

            encodings.push({
                id: generateId(),
                field,
                channel: enc.channel,
                aggregate,
                bin: enc.bin,
            });
        } else if (enc.channel && !field) {
            console.warn(`[AI] Field not found: "${fieldNameFromResponse}" - skipping`);
        }
    }

    // Validation: ensure we have at least x and y, or theta for pie charts
    const hasX = encodings.some(e => e.channel === 'x');
    const hasY = encodings.some(e => e.channel === 'y');
    const hasTheta = encodings.some(e => e.channel === 'theta');
    const isPieChart = aiResponse?.mark === 'arc';

    // Add default encodings if missing
    if (!isPieChart && (!hasX || !hasY)) {
        console.warn('[AI] Missing X or Y encoding, adding defaults');

        if (!hasX) {
            const defaultX = getDefaultXField();
            if (defaultX && !encodings.some(e => e.field.id === defaultX.id)) {
                encodings.push({
                    id: generateId(),
                    field: defaultX,
                    channel: 'x',
                });
            }
        }

        if (!hasY) {
            const defaultY = getDefaultYField();
            if (defaultY && !encodings.some(e => e.field.id === defaultY.id)) {
                encodings.push({
                    id: generateId(),
                    field: defaultY,
                    channel: 'y',
                    aggregate: defaultY.type === 'quantitative' ? 'sum' : undefined,
                });
            }
        }
    }

    // For pie charts, ensure theta is set
    if (isPieChart && !hasTheta) {
        console.warn('[AI] Pie chart missing theta, adding default');
        const quantField = fields.find(f => f.type === 'quantitative');
        if (quantField) {
            encodings.push({
                id: generateId(),
                field: quantField,
                channel: 'theta' as EncodingChannel,
                aggregate: 'sum',
            });
        }
    }

    return {
        id: generateId(),
        mark: aiResponse?.mark || 'bar',
        encodings,
        title: aiResponse?.title ? sanitizeOutput(aiResponse.title) : undefined,
        width: 'container',
        height: 400,
        interactive: true,
        fixedColor: (aiResponse as { fixedColor?: string })?.fixedColor || undefined,
    };
}

// ============================================
// Filter Request Processing
// ============================================

async function processFilterRequest(
    query: string,
    _dataProfile: DataProfile,
    fields: FieldInfo[]
): Promise<AIQueryResult> {
    try {
        const fieldList = fields.map(f => {
            if (f.type === 'quantitative') return `"${f.name}" (numeric, range: ${f.stats.min}-${f.stats.max})`;
            if (f.type === 'nominal' || f.type === 'ordinal') {
                const vals = f.stats.topValues?.slice(0, 5).map(v => v.value).join(', ') || '';
                return `"${f.name}" (categorical, values: ${vals})`;
            }
            return `"${f.name}" (${f.type})`;
        }).join('\n');

        const prompt = `Parse this natural language filter request into structured filter conditions.

AVAILABLE FIELDS:
${fieldList}

USER REQUEST: "${query}"

Respond with ONLY valid JSON:
{
    "conditions": [
        {
            "field": "exact field name",
            "operator": "eq|neq|gt|gte|lt|lte|contains|notContains|in|notIn|between",
            "value": "value or array for 'in'",
            "valueTo": "only for 'between' operator"
        }
    ],
    "logic": "and|or",
    "summary": "Human-readable description of the filter"
}`;

        const response = await callAI({
            messages: [
                { role: 'system', content: 'You are a JSON generator. Respond with ONLY valid JSON.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.1,
            max_tokens: 512,
            response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error('No response from AI');

        const parsed = extractJSON(content) as {
            conditions: Array<{ field: string; operator: string; value: unknown; valueTo?: unknown }>;
            logic: 'and' | 'or';
            summary?: string;
        };

        const validConditions = parsed.conditions
            .filter(c => findFieldFuzzy(c.field, fields))
            .map(c => ({
                field: findFieldFuzzy(c.field, fields)!.name,
                operator: c.operator as FilterSpec['conditions'][0]['operator'],
                value: c.value,
                valueTo: c.valueTo,
            }));

        if (validConditions.length === 0) {
            return { query, intent: 'filter', error: 'Could not parse filter conditions from your request.' };
        }

        const filterSpec: FilterSpec = {
            conditions: validConditions,
            logic: parsed.logic || 'and',
        };

        return {
            query,
            intent: 'filter',
            filterSpec,
            textAnswer: parsed.summary || `Applied ${validConditions.length} filter condition(s)`,
        };

    } catch (error) {
        console.error('Filter Request Error:', error);
        return { query, intent: 'filter', error: error instanceof Error ? error.message : 'Failed to parse filter' };
    }
}

// ============================================
// Compare Request Processing
// ============================================

async function processCompareRequest(
    query: string,
    _dataProfile: DataProfile,
    fields: FieldInfo[],
    data: DataRecord[]
): Promise<AIQueryResult> {
    try {
        const fieldList = fields.map(f => {
            if (f.type === 'nominal' || f.type === 'ordinal') {
                const vals = f.stats.topValues?.slice(0, 8).map(v => v.value).join(', ') || '';
                return `"${f.name}" (categorical: ${vals})`;
            }
            if (f.type === 'quantitative') return `"${f.name}" (numeric)`;
            return `"${f.name}" (${f.type})`;
        }).join('\n');

        const prompt = `Parse this comparison request. Identify the group field, two values to compare, and the metric.

AVAILABLE FIELDS:
${fieldList}

USER REQUEST: "${query}"

Respond with ONLY valid JSON:
{
    "groupField": "field to split groups by",
    "groupValues": ["value A", "value B"],
    "metricField": "numeric field to compare",
    "aggregate": "sum|mean|count|min|max"
}`;

        const response = await callAI({
            messages: [
                { role: 'system', content: 'You are a JSON generator. Respond with ONLY valid JSON.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.1,
            max_tokens: 512,
            response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error('No response from AI');

        const parsed = extractJSON(content) as {
            groupField: string;
            groupValues: [string, string];
            metricField: string;
            aggregate: string;
        };

        const groupField = findFieldFuzzy(parsed.groupField, fields);
        const metricField = findFieldFuzzy(parsed.metricField, fields);

        if (!groupField || !metricField) {
            return { query, intent: 'compare', error: 'Could not identify fields for comparison.' };
        }

        const { executeComparison } = await import('./comparisonService');

        const comparisonSpec: ComparisonSpec = {
            type: groupField.type === 'temporal' ? 'time_period' : 'category',
            groupField: groupField.name,
            groupValues: parsed.groupValues,
            metricField: metricField.name,
            aggregate: (parsed.aggregate as AggregateFunction) || 'sum',
        };

        const comparisonResult = executeComparison(data, comparisonSpec);

        // Build a grouped bar chart for the comparison
        const chartConfig: ChartConfig = {
            id: generateId(),
            mark: 'bar',
            encodings: [
                { id: generateId(), field: groupField, channel: 'x' as EncodingChannel },
                { id: generateId(), field: metricField, channel: 'y' as EncodingChannel, aggregate: comparisonSpec.aggregate },
            ],
            title: `${metricField.name}: ${parsed.groupValues[0]} vs ${parsed.groupValues[1]}`,
            width: 'container',
            height: 400,
            interactive: true,
        };

        return {
            query,
            intent: 'compare',
            chartConfig,
            comparisonSpec,
            comparisonResult,
            textAnswer: comparisonResult.summary,
        };

    } catch (error) {
        console.error('Compare Request Error:', error);
        return { query, intent: 'compare', error: error instanceof Error ? error.message : 'Failed to process comparison' };
    }
}

// ============================================
// Forecast Request Processing
// ============================================

async function processForecastRequest(
    query: string,
    _dataProfile: DataProfile,
    fields: FieldInfo[],
    data: DataRecord[]
): Promise<AIQueryResult> {
    try {
        const fieldList = fields.map(f => `"${f.name}" (${f.type})`).join(', ');

        const prompt = `Parse this forecast request. Identify the temporal field, metric field, and number of periods to forecast.

AVAILABLE FIELDS: ${fieldList}

USER REQUEST: "${query}"

Respond with ONLY valid JSON:
{
    "temporalField": "date/time field name",
    "metricField": "numeric field to forecast",
    "periods": 6
}`;

        const response = await callAI({
            messages: [
                { role: 'system', content: 'You are a JSON generator. Respond with ONLY valid JSON.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.1,
            max_tokens: 256,
            response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error('No response from AI');

        const parsed = extractJSON(content) as {
            temporalField: string;
            metricField: string;
            periods: number;
        };

        let temporalField = findFieldFuzzy(parsed.temporalField, fields);
        let metricField = findFieldFuzzy(parsed.metricField, fields);

        // Fallback: find first temporal and first quantitative
        if (!temporalField) {
            temporalField = fields.find(f => f.type === 'temporal') || fields.find(f => f.type === 'nominal' || f.type === 'ordinal');
        }
        if (!metricField) {
            metricField = fields.find(f => f.type === 'quantitative');
        }

        if (!temporalField || !metricField) {
            return { query, intent: 'forecast', error: 'Could not identify temporal and metric fields for forecasting.' };
        }

        const { generateForecast } = await import('./forecastService');
        const forecastResult = generateForecast(data, temporalField.name, metricField.name, parsed.periods || 6);

        // Create a line chart config for the base data
        const chartConfig: ChartConfig = {
            id: generateId(),
            mark: 'line',
            encodings: [
                { id: generateId(), field: temporalField, channel: 'x' as EncodingChannel },
                { id: generateId(), field: metricField, channel: 'y' as EncodingChannel, aggregate: 'sum' },
            ],
            title: `${metricField.name} Forecast (${forecastResult.periods} periods)`,
            width: 'container',
            height: 400,
            interactive: true,
        };

        return {
            query,
            intent: 'forecast',
            chartConfig,
            forecastResult,
            textAnswer: `Generated ${forecastResult.periods}-period forecast for ${metricField.name} using ${forecastResult.method.replace(/_/g, ' ')} method.`,
        };

    } catch (error) {
        console.error('Forecast Request Error:', error);
        return { query, intent: 'forecast', error: error instanceof Error ? error.message : 'Failed to generate forecast' };
    }
}

// ============================================
// Narrative Generation Helper (for Reports)
// ============================================

export async function generateNarrative(prompt: string): Promise<string> {
    try {
        const response = await callAI({
            messages: [
                { role: 'system', content: 'You are a concise data analyst. Write clear, specific insights using numbers. No filler words.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 512,
        });

        return response.choices[0]?.message?.content || 'Unable to generate narrative.';
    } catch (error) {
        console.error('Narrative Generation Error:', error);
        return 'Failed to generate narrative.';
    }
}

// ============================================
// Legacy Exports (for backwards compatibility)
// ============================================

export async function processNaturalLanguageQuery(
    query: string,
    fields: FieldInfo[]
): Promise<AIQueryResult> {
    // Simplified version for backward compatibility
    return processChartRequest(query, {
        rowCount: 0,
        columnCount: fields.length,
        fields: fields.map(f => ({
            name: f.name,
            type: f.type,
            uniqueCount: f.stats.uniqueCount ?? 0,
            nullCount: f.stats.nullCount,
            exampleValues: [],
        })),
        generatedAt: new Date(),
    }, fields, [], []);
}

export async function generateDataInsights(
    data: DataRecord[],
    fields: FieldInfo[]
): Promise<DataInsight[]> {
    try {
        const dataSummary = {
            rowCount: data.length,
            fields: fields.map(f => ({
                name: f.name,
                type: f.type,
                stats: f.stats,
            })),
            sampleRows: data.slice(0, 5),
        };

        const prompt = `Analyze this dataset and provide 3-5 key insights.

Dataset Summary:
${JSON.stringify(dataSummary, null, 2)}

Respond with a JSON array (and ONLY the JSON array):
[
    {
        "type": "trend" | "anomaly" | "correlation" | "distribution" | "summary",
        "title": "short title",
        "description": "detailed description",
        "confidence": 0.0 to 1.0,
        "relatedFields": ["field1", "field2"]
    }
]`;

        const response = await callAI({
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.5,
            max_tokens: 2048,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) return [];

        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (!jsonMatch) return [];

        const aiInsights = JSON.parse(jsonMatch[0]);
        return aiInsights.map((insight: Omit<DataInsight, 'id'>) => ({
            ...insight,
            id: generateId(),
        }));

    } catch (error) {
        console.error('Generate Insights Error:', error);
        return [];
    }
}

// ============================================
// Chart & Dashboard Summary Generation
// ============================================

/**
 * Generate an AI summary for a single chart
 */
export async function generateChartSummary(
    chartConfig: ChartConfig,
    dataProfile: DataProfile,
    data: DataRecord[]
): Promise<{ summary: string; keyInsights: string[] }> {
    try {
        // Get field stats for context
        const encodingInfo = chartConfig.encodings.map(e => {
            const profile = dataProfile.fields.find(f => f.name === e.field.name);
            return {
                channel: e.channel,
                field: e.field.name,
                type: e.field.type,
                aggregate: e.aggregate,
                stats: profile?.stats,
                topValues: profile?.topValues?.slice(0, 3)
            };
        });

        // Get diverse sample data (first 5 + last 3 for range)
        const sampleRows = [...data.slice(0, 5), ...data.slice(-3)];

        const prompt = `You are a data analyst writing insights for business users. Analyze this visualization and provide actionable insights.

VISUALIZATION: ${chartConfig.mark.toUpperCase()} chart
${chartConfig.title ? `TITLE: ${chartConfig.title}` : ''}

DATA MAPPINGS:
${encodingInfo.map(e => {
            let info = `- ${e.channel.toUpperCase()}: ${e.field}`;
            if (e.aggregate) info += ` (${e.aggregate})`;
            if (e.stats) info += ` | Range: ${e.stats.min} to ${e.stats.max}, Avg: ${e.stats.mean.toFixed(1)}`;
            if (e.topValues) info += ` | Top values: ${e.topValues.map(v => v.value).join(', ')}`;
            return info;
        }).join('\n')}

SAMPLE DATA:
${JSON.stringify(sampleRows.map(row => {
            const subset: Record<string, unknown> = {};
            encodingInfo.forEach(e => subset[e.field] = row[e.field]);
            return subset;
        }), null, 2)}

WRITE INSIGHTS THAT:
1. Highlight the most interesting patterns or outliers
2. Use specific values and comparisons (e.g., "X is 3x higher than Y")
3. Focus on what matters to business users, not technical details
4. Are concise and actionable

DO NOT:
- Mention "sample data" or "rows" or technical terms
- Make up values not in the data
- Write generic statements

Respond with ONLY JSON:
{
    "summary": "One compelling sentence about the key insight from this chart.",
    "keyInsights": ["Specific finding with numbers", "Another specific finding"]
}`;

        const response = await callAI({
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 1024,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response from AI');
        }

        const result = extractJSON(content) as { summary: string; keyInsights: string[] };

        // Sanitize outputs to remove hallucinations
        return {
            summary: sanitizeOutput(result.summary || 'Unable to generate summary.'),
            keyInsights: (result.keyInsights || []).map(insight => sanitizeOutput(insight)),
        };

    } catch (error) {
        console.error('Chart Summary Error:', error);
        return {
            summary: 'Failed to generate summary. Please try again.',
            keyInsights: [],
        };
    }
}

/**
 * Generate an AI summary for an entire dashboard
 */
export async function generateDashboardSummary(
    dashboardConfig: DashboardConfig,
    dataProfile: DataProfile,
    data: DataRecord[]
): Promise<{ overview: string; chartSummaries: { chartId: string; summary: string }[]; keyTakeaways: string[] }> {
    try {
        // Build chart overview with key stats
        const chartInfo = dashboardConfig.charts.map((chart, i) => {
            const fields = chart.encodings.map(e => {
                const profile = dataProfile.fields.find(f => f.name === e.field.name);
                let info = e.field.name;
                if (profile?.stats) {
                    info += ` (avg: ${profile.stats.mean.toFixed(1)})`;
                }
                return info;
            }).join(' vs ');
            return `${i + 1}. ${chart.mark.toUpperCase()}: ${chart.title || fields}`;
        }).join('\n');

        // Get key statistics for context
        const keyStats = dataProfile.fields
            .filter(f => f.stats)
            .slice(0, 5)
            .map(f => `${f.name}: avg ${f.stats!.mean.toFixed(1)}, range ${f.stats!.min}-${f.stats!.max}`)
            .join('\n');

        // Get diverse sample
        const samples = [...data.slice(0, 3), ...data.slice(-2)];

        const prompt = `You are a business analyst presenting dashboard findings to executives. Write clear, actionable insights.

DASHBOARD: ${dashboardConfig.title || 'Analytics Dashboard'}

CHARTS IN THIS DASHBOARD:
${chartInfo}

KEY STATISTICS:
${keyStats}

SAMPLE RECORDS:
${JSON.stringify(samples, null, 2)}

WRITE INSIGHTS THAT:
1. Tell a story - what's the main takeaway?
2. Highlight surprising findings or important patterns
3. Use specific numbers and comparisons
4. Are actionable for business decisions

DO NOT:
- Mention "sample data", "rows", or "charts analyzed"
- Use technical jargon
- Write generic or obvious statements
- Make up any values

Respond with ONLY JSON:
{
    "overview": "1-2 sentences: the main story this dashboard tells with specific insights.",
    "chartSummaries": [
        {"chartId": "1", "summary": "Key finding from chart 1 with specific values"},
        {"chartId": "2", "summary": "Key finding from chart 2 with specific values"}
    ],
    "keyTakeaways": [
        "Actionable insight with specific numbers",
        "Another actionable finding"
    ]
}`;

        const response = await callAI({
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 2048,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response from AI');
        }

        const result = extractJSON(content) as {
            overview: string;
            chartSummaries: { chartId: string; summary: string }[];
            keyTakeaways: string[];
        };

        // Map chart summaries to actual chart IDs and sanitize
        const chartSummaries = dashboardConfig.charts.map((chart, index) => ({
            chartId: chart.id,
            summary: sanitizeOutput(result.chartSummaries?.[index]?.summary || 'No summary available.'),
        }));

        return {
            overview: sanitizeOutput(result.overview || 'Unable to generate overview.'),
            chartSummaries,
            keyTakeaways: (result.keyTakeaways || []).map(t => sanitizeOutput(t)),
        };

    } catch (error) {
        console.error('Dashboard Summary Error:', error);
        const chartSummaries = dashboardConfig.charts.map(chart => ({
            chartId: chart.id,
            summary: 'Summary unavailable due to error.',
        }));
        return {
            overview: 'Failed to generate dashboard summary. Please try again.',
            chartSummaries,
            keyTakeaways: [],
        };
    }
}

export function isAIAvailable(): boolean {
    if (Boolean(AI_PROXY_URL)) {
        return Boolean(AI_PROXY_AUTH_TOKEN);
    }

    return canUseInsecureDirectAI() && isAnyProviderAvailable();
}

export function getLastProviderName(): string | null {
    if (lastTransportName) {
        return lastTransportName;
    }

    if (!canUseInsecureDirectAI()) {
        return null;
    }

    return getLastProviderNameFromManager();
}

export function getAvailableProviderNames(): string[] {
    if (Boolean(AI_PROXY_URL) && Boolean(AI_PROXY_AUTH_TOKEN)) {
        return ['Proxy'];
    }

    if (!canUseInsecureDirectAI()) {
        return [];
    }

    return getAvailableProviderNamesFromManager();
}

