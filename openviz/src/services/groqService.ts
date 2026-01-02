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
} from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { executeDataQuery, formatProfileForLLM } from './dataContextService';
import type { DataQuery } from './dataContextService';

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
 */
function extractJSON(content: string): unknown {
    // Try to find JSON object - handle nested braces properly
    let braceCount = 0;
    let startIndex = -1;
    let endIndex = -1;

    for (let i = 0; i < content.length; i++) {
        if (content[i] === '{') {
            if (braceCount === 0) startIndex = i;
            braceCount++;
        } else if (content[i] === '}') {
            braceCount--;
            if (braceCount === 0 && startIndex !== -1) {
                endIndex = i + 1;
                break;
            }
        }
    }

    if (startIndex !== -1 && endIndex !== -1) {
        const jsonStr = content.substring(startIndex, endIndex);
        return JSON.parse(jsonStr);
    }

    // Fallback: try simple regex match
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
        return JSON.parse(match[0]);
    }

    throw new Error('No valid JSON found in response');
}

// ============================================
// Intent Detection (LLM-based)
// ============================================

/**
 * Use LLM to intelligently detect the intent of a user query
 */
export async function detectIntent(
    query: string,
    hasCurrentChart: boolean,
    hasDashboard: boolean = false,
    dataContext?: string
): Promise<AIIntent> {
    try {
        const groq = getGroqClient();

        const prompt = `You are an intent classifier for a data visualization application. Classify the user's query into one of these intents:

INTENTS:
- "question": User wants to KNOW something about the data (statistics, values, summaries, explanations).
  Examples: "What is the average?", "How many rows?", "Tell me more", "Summarize", "What's the total?"

- "chart": User wants to CREATE a new standalone chart from scratch.
  Examples: "Make a bar chart", "Show sales by region", "Create a scatter plot", "Plot GDP vs population"

- "modify": User wants to CHANGE the current single chart (appearance, type, colors, encodings). Only applies when there's a chart but NO dashboard.
  Examples: "Make it a line chart", "Add color", "Change the title", "Make all bars green", "Remove the legend"

- "dashboard": User wants to CREATE a new multi-chart dashboard from scratch.
  Examples: "Create a dashboard", "Show an overview", "Build me a dashboard", "Give me multiple charts"

- "modify_dashboard": User wants to ADD, REMOVE, or DELETE charts from an EXISTING dashboard. Only applies when there's already a dashboard.
  IMPORTANT: "delete" = "remove" = "take away" = "get rid of"
  Examples: "Add a bar chart", "Delete the first chart", "Remove a chart", "Add another chart", "Delete this chart", "Get rid of the pie chart"

- "explain": User wants an explanation of WHY something is the way it is.
  Examples: "Why is this high?", "Explain the trend", "What caused this spike?"

Current context:
- Has existing chart: ${hasCurrentChart ? 'Yes' : 'No'}
- Has existing dashboard: ${hasDashboard ? 'Yes' : 'No'}
${dataContext ? `- Data: ${dataContext}` : ''}

User query: "${query}"

Respond with ONLY one word: question, chart, modify, dashboard, modify_dashboard, or explain`;

        const response = await groq.chat.completions.create({
            model: AI_MODEL,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            max_tokens: 20,
        });

        const content = response.choices[0]?.message?.content?.toLowerCase().trim();

        // Map response to valid intent
        if (content?.includes('question')) return 'question';
        if (content?.includes('modify_dashboard')) return hasDashboard ? 'modify_dashboard' : 'dashboard';
        if (content?.includes('modify')) return hasCurrentChart ? 'modify' : 'chart';
        if (content?.includes('dashboard')) {
            // Check if user is trying to add/remove from existing dashboard
            if (hasDashboard && /add|another|more|include|delete|remove|take away|get rid/i.test(query)) {
                return 'modify_dashboard';
            }
            return 'dashboard';
        }
        if (content?.includes('chart')) return 'chart';
        if (content?.includes('explain')) return 'explain';

        // Fallback to chart if unrecognized
        return 'chart';

    } catch (error) {
        console.error('Intent detection error, using fallback:', error);
        // Fallback to simple pattern matching if LLM fails
        return fallbackIntentDetection(query, hasCurrentChart);
    }
}

/**
 * Fallback pattern-based intent detection (used if LLM fails)
 */
function fallbackIntentDetection(query: string, hasCurrentChart: boolean): AIIntent {
    const lowerQuery = query.toLowerCase();

    if (/\bdashboard\b|\boverview\b/i.test(lowerQuery)) return 'dashboard';
    if (/\b(chart|plot|graph|bar|line|scatter)\b/i.test(lowerQuery)) return 'chart';
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
    currentMark: MarkType = 'bar'
): Promise<AIQueryResult> {
    const hasCurrentChart = currentEncodings.length > 0;
    const hasDashboard = currentDashboard !== null;
    const intent = await detectIntent(query, hasCurrentChart, hasDashboard);

    switch (intent) {
        case 'question':
            return processDataQuestion(query, dataProfile, fields, data, chatHistory);
        case 'chart':
            return processChartRequest(query, dataProfile, fields, chatHistory);
        case 'modify':
            return processModifyRequest(query, fields, currentEncodings, currentMark, chatHistory);
        case 'dashboard':
            return processDashboardRequest(query, dataProfile, fields);
        case 'modify_dashboard':
            return processModifyDashboardRequest(query, dataProfile, fields, currentDashboard!, chatHistory);
        case 'explain':
            return processExplainRequest(query, dataProfile, fields, data);
        default:
            return processChartRequest(query, dataProfile, fields, chatHistory);
    }
}

// ============================================
// Data Question Answering
// ============================================

/**
 * Answer a data question using computed statistics with conversation context
 */
async function processDataQuestion(
    query: string,
    dataProfile: DataProfile,
    _fields: FieldInfo[],
    data: DataRecord[],
    chatHistory: AIMessage[] = []
): Promise<AIQueryResult> {
    try {
        const groq = getGroqClient();
        const context = formatProfileForLLM(dataProfile);

        // Build conversation context from recent messages
        const recentHistory = chatHistory.slice(-6).map(m =>
            `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
        ).join('\n');

        const prompt = `You are a helpful data analyst assistant. Answer the user's question about the dataset.

Dataset Overview:
${context}

${recentHistory ? `Recent Conversation:
${recentHistory}

` : ''}Current Question: "${query}"

IMPORTANT: 
- If this is a follow-up question (like "elaborate", "tell me more", "be more specific"), provide more details based on the previous conversation.
- For general questions about the data, give a comprehensive summary.
- For specific statistical questions, provide accurate numbers from the stats.

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
    chatHistory: AIMessage[]
): Promise<AIQueryResult> {
    try {
        const groq = getGroqClient();
        const context = formatProfileForLLM(dataProfile);

        // Build conversation context
        const recentHistory = chatHistory.slice(-4).map(m =>
            `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
        ).join('\n');

        const prompt = `You are a data visualization assistant. Create a chart configuration.

Dataset:
${context}

${recentHistory ? `Recent conversation:\n${recentHistory}\n\n` : ''}User request: "${query}"

Respond with ONLY a JSON object:
{
    "mark": "bar" | "line" | "point" | "area" | "arc",
    "encodings": [
        {
            "channel": "x" | "y" | "color" | "size",
            "fieldName": "exact field name",
            "aggregate": "sum" | "mean" | "count" | null,
            "bin": true | false
        }
    ],
    "title": "chart title"
}

Rules:
- Use field names EXACTLY as they appear in the dataset
- For categorical X + quantitative Y, use bar chart
- For temporal X + quantitative Y, use line chart
- For quantitative X + quantitative Y, use point (scatter)
- Always include aggregation for quantitative Y when X is categorical`;

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
            mark: MarkType;
            encodings: Array<{
                channel: EncodingChannel;
                fieldName: string;
                aggregate?: string;
                bin?: boolean;
            }>;
            title?: string;
        };

        const chartConfig = buildChartConfig(aiResponse, fields);

        return {
            query,
            intent: 'chart',
            chartConfig,
            textAnswer: `Created a ${aiResponse.mark} chart: "${aiResponse.title || 'Untitled'}"`,
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

        const prompt = `You are a chart modification assistant. CAREFULLY read the user's request and make ONLY the changes they ask for.

CURRENT CHART TYPE: ${currentMark} (pie charts are called "arc")
CURRENT ENCODINGS:
${currentChart}

AVAILABLE FIELDS: ${fieldList}

USER REQUEST: "${query}"

IMPORTANT RULES:
1. **PRESERVE the chart type** unless the user explicitly asks to change it (e.g., "make it a line chart")
2. **PRESERVE existing encodings** unless the user asks to change them
3. If user says "remove color" or "make colors same" or "uniform color" → Remove the color encoding and set fixedColor
4. If user says "make it [color]" or "all [color]" → Keep chart type, set fixedColor to that color
5. If user says "add color by [field]" → Add a color encoding with that field, clear fixedColor
6. If user says "change title to X" → Only change the title
7. For pie/arc charts, use mark: "arc" and theta encoding instead of y

Examples of CORRECT modifications:
- "Make all bars green" → Keep mark, encodings, set "fixedColor": "green"
- "Make the colors the same" → Keep mark, remove color encoding (if any)
- "Keep all colors blue" → Keep mark, set "fixedColor": "blue"
- "Remove the color" → Keep mark, remove color encoding
- "Add color by country" → Add color: country encoding
- "Make it a line chart" → Change mark to "line", keep all encodings

Respond with COMPLETE chart config:
{
    "mark": "bar" | "line" | "point" | "area" | "arc",
    "encodings": [
        {
            "channel": "x" | "y" | "theta" | "color" | "size",
            "fieldName": "exact field name from available fields",
            "aggregate": "sum" | "mean" | "count" | null
        }
    ],
    "title": "chart title",
    "fixedColor": "green" | "blue" | "#ff0000" | null
}

Respond with ONLY the JSON, no explanation.`;

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

        const aiResponse = extractJSON(content) as {
            mark: MarkType;
            encodings: Array<{
                channel: EncodingChannel;
                fieldName: string;
                aggregate?: string;
            }>;
            title?: string;
        };
        const chartConfig = buildChartConfig(aiResponse, fields);

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
 * Process a dashboard creation request
 */
async function processDashboardRequest(
    query: string,
    dataProfile: DataProfile,
    fields: FieldInfo[]
): Promise<AIQueryResult> {
    try {
        const groq = getGroqClient();
        const context = formatProfileForLLM(dataProfile);

        const prompt = `You are creating a multi-chart dashboard based on user request.

Dataset:
${context}

User request: "${query}"

Create a dashboard with 2-4 complementary charts. Respond with ONLY JSON:
{
    "title": "Dashboard title",
    "charts": [
        {
            "mark": "bar" | "line" | "point" | "area" | "arc",
            "encodings": [
                {
                    "channel": "x" | "y" | "color" | "size",
                    "fieldName": "exact field name",
                    "aggregate": "sum" | "mean" | "count" | null
                }
            ],
            "title": "Chart title"
        }
    ],
    "layout": {
        "cols": 2,
        "rows": 2
    }
}

Guidelines:
- Include a mix of chart types for variety
- One chart for trends (line), one for comparisons (bar), one for distribution
- Use different fields to show various aspects of the data`;

        const response = await groq.chat.completions.create({
            model: AI_MODEL,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.4,
            max_tokens: 2048,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response from AI');
        }

        const aiResponse = extractJSON(content) as {
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

        // Build dashboard config
        const charts: ChartConfig[] = aiResponse.charts.map((chart) =>
            buildChartConfig(chart, fields)
        );

        const layout: DashboardLayout = {
            cols: aiResponse.layout.cols,
            rows: aiResponse.layout.rows,
            items: charts.map((chart, index) => ({
                chartId: chart.id,
                col: index % aiResponse.layout.cols,
                row: Math.floor(index / aiResponse.layout.cols),
                colSpan: 1,
                rowSpan: 1,
            })),
        };

        const dashboardConfig: DashboardConfig = {
            id: uuidv4(),
            title: aiResponse.title,
            charts,
            layout,
            createdAt: new Date(),
        };

        return {
            query,
            intent: 'dashboard',
            dashboardConfig,
            textAnswer: `Created dashboard "${aiResponse.title}" with ${charts.length} charts`,
        };

    } catch (error) {
        console.error('Dashboard Request Error:', error);
        return {
            query,
            intent: 'dashboard',
            error: error instanceof Error ? error.message : 'Failed to create dashboard',
        };
    }
}

// ============================================
// Modify Dashboard Request Processing
// ============================================

/**
 * Process a request to modify an existing dashboard (add/remove charts)
 */
async function processModifyDashboardRequest(
    query: string,
    dataProfile: DataProfile,
    fields: FieldInfo[],
    currentDashboard: DashboardConfig,
    _chatHistory: AIMessage[]
): Promise<AIQueryResult> {
    try {
        const groq = getGroqClient();
        const context = formatProfileForLLM(dataProfile);

        // Describe current dashboard
        const currentCharts = currentDashboard.charts.map((c, i) =>
            `${i + 1}. ${c.title || c.mark + ' chart'}`
        ).join('\n');

        const prompt = `You are modifying an existing dashboard based on user instruction.

Current dashboard: "${currentDashboard.title}"
Current charts (by index):
${currentCharts}

Available fields: ${fields.map(f => `${f.name} (${f.type})`).join(', ')}

Dataset overview:
${context}

User instruction: "${query}"

IMPORTANT SYNONYMS:
- "delete" = "remove" = "take away" = "get rid of" → Use action: "remove"
- "add" = "create" = "include" = "put" → Use action: "add"

Determine what modification is needed:
- If ADDING a chart: specify the new chart configuration
- If REMOVING/DELETING a chart: specify which chart to remove by 0-based index

Respond with JSON:
{
    "action": "add" | "remove",
    "chart": {
        "mark": "bar" | "line" | "point" | "area" | "arc",
        "encodings": [
            {"channel": "x" | "y" | "color", "fieldName": "field name", "aggregate": "sum" | "mean" | null}
        ],
        "title": "chart title"
    },
    "removeIndex": 0
}

Note: For "remove" action, set removeIndex to the chart number minus 1 (e.g., "delete chart 1" → removeIndex: 0)`;

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

        const aiResponse = extractJSON(content) as {
            action: 'add' | 'remove';
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
        };

        let updatedCharts = [...currentDashboard.charts];
        let textAnswer: string;

        if (aiResponse.action === 'add' && aiResponse.chart) {
            const newChart = buildChartConfig(aiResponse.chart, fields);
            updatedCharts.push(newChart);
            textAnswer = `Added "${aiResponse.chart.title || aiResponse.chart.mark + ' chart'}" to dashboard (now ${updatedCharts.length} charts)`;
        } else if (aiResponse.action === 'remove' && aiResponse.removeIndex !== undefined) {
            updatedCharts.splice(aiResponse.removeIndex, 1);
            textAnswer = `Removed chart from dashboard (now ${updatedCharts.length} charts)`;
        } else {
            throw new Error('Invalid modification action');
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
 * Build ChartConfig from AI response with defensive checks
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

    // Defensive check for encodings array
    const responseEncodings = Array.isArray(aiResponse?.encodings)
        ? aiResponse.encodings
        : [];

    for (const enc of responseEncodings) {
        // Handle both 'fieldName' and 'field' as possible keys
        const fieldNameFromResponse = enc.fieldName || enc.field || '';
        const field = fields.find(f =>
            f.name.toLowerCase() === fieldNameFromResponse.toLowerCase()
        );
        if (field && enc.channel) {
            encodings.push({
                id: uuidv4(),
                field,
                channel: enc.channel,
                aggregate: enc.aggregate as ShelfPlacement['aggregate'],
                bin: enc.bin,
            });
        }
    }

    return {
        id: uuidv4(),
        mark: aiResponse?.mark || 'bar',
        encodings,
        title: aiResponse?.title,
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

export function isAIAvailable(): boolean {
    return Boolean(GROQ_API_KEY);
}
