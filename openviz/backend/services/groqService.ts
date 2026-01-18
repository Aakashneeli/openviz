// ============================================
// Groq AI Service v2.0
// Enhanced with Intent Detection, Q&A, and
// Contextual Memory for OpenViz
// ============================================

import Groq from 'groq-sdk';
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
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import { executeDataQuery, formatProfileForLLM } from './dataContextService';
import type { DataQuery } from './dataContextService';
import { generateAnnotations } from './annotationService';

// ============================================
// Configuration
// ============================================

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const AI_MODEL = import.meta.env.VITE_AI_MODEL || 'meta-llama/llama-4-maverick-17b-128e-instruct';

// Initialize Groq client
let groqClient: Groq | null = null;

function getGroqClient(): Groq {
    if (!groqClient) {
        if (!GROQ_API_KEY) {
            throw new Error('GROQ_API_KEY is not configured. Please add VITE_GROQ_API_KEY to your .env file.');
        }
        groqClient = new Groq({
            apiKey: GROQ_API_KEY,
            dangerouslyAllowBrowser: true,
        });
    }
    return groqClient;
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
        const groq = getGroqClient();

        // Build context from recent chat history
        const recentHistory = chatHistory?.slice(-3) || [];
        const conversationContext = recentHistory.length > 0
            ? `\n\nRecent conversation:\n${recentHistory.map(m => `${m.role}: ${m.content}`).join('\n')}`
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
   - Keywords: dashboard, overview, multiple charts, collection, summary view
   - Examples: "Create a dashboard", "Show me an overview of everything", "Build a multi-chart view"
   - **IMPORTANT**: Only use this if user explicitly asks for dashboard/overview. If they mention a specific chart type, use "chart" instead

5. **modify_dashboard** - User wants to ADD/REMOVE charts from EXISTING dashboard
   - Keywords: add, remove, delete, another, one more, get rid of
   - Examples: "Add a pie chart", "Remove the first chart", "Delete this", "Add another visualization"
   - **IMPORTANT**: Only valid when hasDashboard=true

6. **explain** - User wants to know WHY something is happening in the data
   - Keywords: why, explain trend, what caused, reason for
   - Examples: "Why is this spike here?", "Explain the trend", "What caused this?"

**CONTEXT:**
- Current chart exists: ${hasCurrentChart ? 'YES' : 'NO'}
- Dashboard exists: ${hasDashboard ? 'YES' : 'NO'}
${dataContext ? `- Data available: ${dataContext}` : ''}${conversationContext}

**USER QUERY:** "${query}"

**INSTRUCTIONS:**
1. Analyze the query carefully considering context
2. Choose the MOST APPROPRIATE intent
3. If the query mentions "modify/change" but there's no current chart, classify as "chart"
4. If the query mentions "add to dashboard" but there's no dashboard, classify as "dashboard"

Respond with JSON:
{
  "intent": "question|chart|modify|dashboard|modify_dashboard|explain",
  "reasoning": "Brief explanation of why you chose this intent (1-2 sentences)"
}`;


        const response = await groq.chat.completions.create({
            model: AI_MODEL,
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

            if (intentStr.includes('question')) finalIntent = 'question';
            else if (intentStr.includes('modify_dashboard')) finalIntent = hasDashboard ? 'modify_dashboard' : 'dashboard';
            else if (intentStr.includes('modify')) finalIntent = hasCurrentChart ? 'modify' : 'chart';
            else if (intentStr.includes('dashboard')) {
                // Check if user is trying to add/remove from existing dashboard
                if (hasDashboard && /add|another|more|include|delete|remove|take away|get rid/i.test(query)) {
                    finalIntent = 'modify_dashboard';
                } else {
                    finalIntent = 'dashboard';
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
            const fallback = fallbackIntentDetection(query, hasCurrentChart);
            return { intent: fallback, reasoning: 'Using fallback pattern matching' };
        }

    } catch (error) {
        console.error('Intent detection error, using fallback:', error);
        // Fallback to simple pattern matching if LLM fails
        const fallback = fallbackIntentDetection(query, hasCurrentChart);
        return { intent: fallback, reasoning: 'Error occurred, using fallback pattern matching' };
    }
}

/**
 * Fallback pattern-based intent detection (used if LLM fails)
 */
function fallbackIntentDetection(query: string, hasCurrentChart: boolean): AIIntent {
    const lowerQuery = query.toLowerCase();

    // Dashboard patterns - be more specific to avoid false positives
    if (/\b(dashboard|overview)\b/i.test(lowerQuery) && !/\b(histogram|bar|line|scatter|pie|chart|plot|graph|show|create)\b/i.test(lowerQuery.replace(/dashboard|overview/gi, ''))) {
        return 'dashboard';
    }

    // Chart type keywords - comprehensive list
    const chartTypes = /\b(chart|plot|graph|bar|line|scatter|pie|area|radar|heatmap|treemap|sunburst|funnel|gauge|sankey|boxplot|candlestick|histogram|waterfall|parallel|calendar|tree|network|distribution|frequency)\b/i;
    if (chartTypes.test(lowerQuery) || /\b(show|visualize|display|create)\s+(a|the|me)?\s*\w*\s*(of|by|for)/i.test(lowerQuery)) {
        return 'chart';
    }

    if (/^(make it|change|switch to)/i.test(lowerQuery) && hasCurrentChart) return 'modify';
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
    currentChartTitle?: string
): Promise<AIQueryResult> {
    const hasCurrentChart = currentEncodings.length > 0;
    const hasDashboard = currentDashboard !== null;

    // Get intent with reasoning
    const dataContext = `${fields.length} fields, ${dataProfile.rowCount} rows`;
    const { intent, reasoning } = await detectIntent(query, hasCurrentChart, hasDashboard, dataContext, chatHistory);

    console.log(`[AI] Intent: ${intent} | Reasoning: ${reasoning}`);

    // Build visualization context for question answering
    const chartContext = formatChartContext(currentChartTitle, currentMark, currentEncodings);
    const dashboardContext = formatDashboardContext(currentDashboard);

    switch (intent) {
        case 'question':
            return processDataQuestion(query, dataProfile, fields, data, chatHistory, chartContext, dashboardContext);
        case 'chart':
            return processChartRequest(query, dataProfile, fields, data, chatHistory);
        case 'modify':
            return processModifyRequest(query, fields, currentEncodings, currentMark, chatHistory);
        case 'dashboard':
            return processDashboardRequest(query, dataProfile, fields);
        case 'modify_dashboard':
            return processModifyDashboardRequest(query, dataProfile, fields, currentDashboard!, chatHistory);
        case 'explain':
            return processExplainRequest(query, dataProfile, fields, data);
        default:
            return processChartRequest(query, dataProfile, fields, data, chatHistory);
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
    _fields: FieldInfo[],
    data: DataRecord[],
    chatHistory: AIMessage[] = [],
    chartContext: string = '',
    dashboardContext: string = ''
): Promise<AIQueryResult> {
    try {
        const groq = getGroqClient();
        const context = formatProfileForLLM(dataProfile);

        // Build conversation context from recent messages
        const recentHistory = chatHistory.slice(-6).map(m =>
            `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
        ).join('\n');

        const prompt = `You are a helpful data analyst assistant for a data visualization tool called OpenViz. Answer the user's question about the data, charts, or dashboard.

**DATASET OVERVIEW:**
${context}

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

If the question requires calculating specific values (sum, average, max, min, count), respond with JSON:
{
    "needsQuery": true,
    "query": {
        "operation": "sum" | "mean" | "min" | "max" | "count" | "distinct",
        "field": "field name",
        "groupBy": "optional field for grouping",
        "orderBy": { "field": "field", "direction": "asc" | "desc" },
        "limit": optional number
    }
}

Otherwise, respond with JSON:
{
    "needsQuery": false,
    "answer": "Your detailed, helpful answer here. Be specific and informative."
}

Respond with ONLY the JSON.`;

        const response = await groq.chat.completions.create({
            model: AI_MODEL,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
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
        const groq = getGroqClient();
        const context = formatProfileForLLM(dataProfile);

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
- Use field names EXACTLY as they appear
- Include reasoning in your response
- Make smart inferences if user's language is vague
- Default to the most common/obvious visualization for the request

Respond with ONLY valid JSON.`;

        const response = await groq.chat.completions.create({
            model: AI_MODEL,
            messages: [
                { role: 'system', content: 'You are a JSON generator. Respond with ONLY valid JSON, no markdown, no explanation.' },
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
        return {
            query,
            intent: 'chart',
            error: error instanceof Error ? error.message : 'Failed to create chart',
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
        const groq = getGroqClient();

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

Respond ONLY with valid JSON.`;

        const response = await groq.chat.completions.create({
            model: AI_MODEL,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 1024,
            response_format: { type: 'json_object' }, // Force JSON mode
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
        return {
            query,
            intent: 'modify',
            error: error instanceof Error ? error.message : 'Failed to modify chart',
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
    const groq = getGroqClient();

    // Create explicit field list for LLM
    const fieldList = fields.map(f =>
        `- "${f.name}" (${f.type})${f.stats.min !== undefined ? ` [min: ${f.stats.min}, max: ${f.stats.max}]` : ''}`
    ).join('\n');

    const prompt = `You are creating a multi-chart dashboard. ONLY use the exact field names provided below.

AVAILABLE FIELDS (use EXACT names):
${fieldList}

Dataset has ${dataProfile.rowCount} rows.

User request: "${query}"

Create a dashboard with 2-4 charts. IMPORTANT RULES:
1. ONLY use field names from the list above - copy them EXACTLY
2. Use quantitative fields for Y-axis, nominal fields for X-axis
3. Always include an aggregate (sum, mean, count) for quantitative Y-axis fields

Respond with ONLY valid JSON:
{
    "title": "Dashboard title",
    "charts": [
        {
            "mark": "bar",
            "encodings": [
                {"channel": "x", "fieldName": "EXACT_FIELD_NAME", "aggregate": null},
                {"channel": "y", "fieldName": "EXACT_FIELD_NAME", "aggregate": "sum"}
            ],
            "title": "Chart title"
        }
    ],
    "layout": {"cols": 2, "rows": 2}
}`;

    // Retry logic - try up to 3 times
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const response = await groq.chat.completions.create({
                model: AI_MODEL,
                messages: [
                    { role: 'system', content: 'You are a JSON generator. Respond with ONLY valid JSON, no markdown, no explanation.' },
                    { role: 'user', content: prompt }
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
                id: uuidv4(),
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
            id: uuidv4(),
            mark: 'bar' as MarkType,
            encodings: [
                {
                    id: uuidv4(),
                    field: xField,
                    channel: 'x' as EncodingChannel,
                    aggregate: undefined,
                    bin: undefined
                },
                {
                    id: uuidv4(),
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
        id: uuidv4(),
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
        textAnswer: `Created a basic dashboard (AI had issues, showing default view)`,
    };
}

// ============================================
// Modify Dashboard Request Processing
// ============================================

/**
 * Process a request to modify an existing dashboard (add/remove charts)
 */
async function processModifyDashboardRequest(
    query: string,
    _dataProfile: DataProfile,
    fields: FieldInfo[],
    currentDashboard: DashboardConfig,
    _chatHistory: AIMessage[]
): Promise<AIQueryResult> {
    try {
        const groq = getGroqClient();

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


        const response = await groq.chat.completions.create({
            model: AI_MODEL,
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
        const groq = getGroqClient();
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

        const response = await groq.chat.completions.create({
            model: AI_MODEL,
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
            id: uuidv4(),
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

    // Helper: Find field with fuzzy matching
    const findField = (name: string): FieldInfo | undefined => {
        if (!name) return undefined;
        const lowerName = name.toLowerCase().trim();

        // Exact match (case-insensitive)
        let field = fields.find(f => f.name.toLowerCase() === lowerName);
        if (field) return field;

        // Contains match
        field = fields.find(f => f.name.toLowerCase().includes(lowerName));
        if (field) return field;

        // Reverse contains (field name is in the input)
        field = fields.find(f => lowerName.includes(f.name.toLowerCase()));
        if (field) return field;

        // Word boundary match (any word matches)
        const words = lowerName.split(/\s+|_|-/);
        for (const word of words) {
            if (word.length < 2) continue;
            field = fields.find(f => f.name.toLowerCase().includes(word));
            if (field) return field;
        }

        return undefined;
    };

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
        const field = findField(fieldNameFromResponse);

        if (field && enc.channel) {
            // Auto-add aggregation for quantitative fields on Y axis if not specified
            let aggregate = enc.aggregate as ShelfPlacement['aggregate'];
            if (!aggregate && field.type === 'quantitative' && (enc.channel === 'y' || enc.channel === 'theta')) {
                aggregate = 'sum';
            }

            encodings.push({
                id: uuidv4(),
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
                    id: uuidv4(),
                    field: defaultX,
                    channel: 'x',
                });
            }
        }

        if (!hasY) {
            const defaultY = getDefaultYField();
            if (defaultY && !encodings.some(e => e.field.id === defaultY.id)) {
                encodings.push({
                    id: uuidv4(),
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
                id: uuidv4(),
                field: quantField,
                channel: 'theta' as EncodingChannel,
                aggregate: 'sum',
            });
        }
    }

    return {
        id: uuidv4(),
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
    }, fields, []);
}

export async function generateDataInsights(
    data: DataRecord[],
    fields: FieldInfo[]
): Promise<DataInsight[]> {
    try {
        const groq = getGroqClient();

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

        const response = await groq.chat.completions.create({
            model: AI_MODEL,
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
            id: uuidv4(),
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
        const groq = getGroqClient();

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

        const response = await groq.chat.completions.create({
            model: AI_MODEL,
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
        const groq = getGroqClient();

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

        const response = await groq.chat.completions.create({
            model: AI_MODEL,
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
    return Boolean(GROQ_API_KEY);
}

