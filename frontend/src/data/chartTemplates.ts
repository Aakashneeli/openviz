// ============================================
// Chart Templates - Pre-built chart configurations
// that can be applied to any dataset
// ============================================

import type { MarkType, FieldType, EncodingChannel, AggregateFunction } from '@backend/types';

// ============================================
// Types
// ============================================

/** Slot that a template expects to be filled with a field */
export interface TemplateSlot {
    channel: EncodingChannel;
    /** What type of field this slot expects */
    expectedType: FieldType | FieldType[];
    /** Human-readable label like "Category" or "Metric" */
    label: string;
    /** Whether this slot is required */
    required: boolean;
    /** Default aggregate to apply */
    aggregate?: AggregateFunction;
    /** Preferred field name patterns for auto-mapping (regex-friendly) */
    preferredPatterns?: string[];
}

/** A chart template definition */
export interface ChartTemplate {
    id: string;
    name: string;
    description: string;
    category: TemplateCategory;
    mark: MarkType;
    slots: TemplateSlot[];
    /** Optional fixed color */
    fixedColor?: string;
    /** Preview icon name (matches lucide icons) */
    icon: string;
}

export type TemplateCategory = 'sales' | 'marketing' | 'operations' | 'finance' | 'general';

export const TEMPLATE_CATEGORIES: { id: TemplateCategory; label: string; description: string }[] = [
    { id: 'general', label: 'General', description: 'Common chart patterns' },
    { id: 'sales', label: 'Sales', description: 'Revenue, pipeline, performance' },
    { id: 'marketing', label: 'Marketing', description: 'Campaigns, funnels, engagement' },
    { id: 'operations', label: 'Operations', description: 'Efficiency, throughput, quality' },
    { id: 'finance', label: 'Finance', description: 'Budget, P&L, forecasting' },
];

// ============================================
// Template Definitions
// ============================================

export const chartTemplates: ChartTemplate[] = [
    // ---- General ----
    {
        id: 'bar-comparison',
        name: 'Category Comparison',
        description: 'Compare values across categories with a bar chart',
        category: 'general',
        mark: 'bar',
        icon: 'BarChart3',
        slots: [
            {
                channel: 'x',
                expectedType: ['nominal', 'ordinal'],
                label: 'Category',
                required: true,
                preferredPatterns: ['category', 'name', 'type', 'group', 'region', 'department'],
            },
            {
                channel: 'y',
                expectedType: 'quantitative',
                label: 'Value',
                required: true,
                aggregate: 'sum',
                preferredPatterns: ['amount', 'total', 'value', 'count', 'revenue', 'sales'],
            },
        ],
    },
    {
        id: 'line-trend',
        name: 'Trend Over Time',
        description: 'Show how a metric changes over time',
        category: 'general',
        mark: 'line',
        icon: 'LineChart',
        slots: [
            {
                channel: 'x',
                expectedType: 'temporal',
                label: 'Date',
                required: true,
                preferredPatterns: ['date', 'time', 'month', 'year', 'day', 'period', 'quarter'],
            },
            {
                channel: 'y',
                expectedType: 'quantitative',
                label: 'Metric',
                required: true,
                aggregate: 'sum',
                preferredPatterns: ['value', 'amount', 'total', 'count'],
            },
            {
                channel: 'color',
                expectedType: ['nominal', 'ordinal'],
                label: 'Series (optional)',
                required: false,
                preferredPatterns: ['category', 'type', 'group', 'name'],
            },
        ],
    },
    {
        id: 'pie-breakdown',
        name: 'Proportion Breakdown',
        description: 'Show parts of a whole as a pie/donut chart',
        category: 'general',
        mark: 'arc',
        icon: 'PieChart',
        slots: [
            {
                channel: 'color',
                expectedType: ['nominal', 'ordinal'],
                label: 'Segment',
                required: true,
                preferredPatterns: ['category', 'type', 'name', 'group', 'segment'],
            },
            {
                channel: 'theta',
                expectedType: 'quantitative',
                label: 'Value',
                required: true,
                aggregate: 'sum',
                preferredPatterns: ['amount', 'value', 'total', 'count', 'revenue'],
            },
        ],
    },
    {
        id: 'scatter-correlation',
        name: 'Correlation Plot',
        description: 'Explore relationships between two numeric variables',
        category: 'general',
        mark: 'point',
        icon: 'ScatterChart',
        slots: [
            {
                channel: 'x',
                expectedType: 'quantitative',
                label: 'X Variable',
                required: true,
            },
            {
                channel: 'y',
                expectedType: 'quantitative',
                label: 'Y Variable',
                required: true,
            },
            {
                channel: 'color',
                expectedType: ['nominal', 'ordinal'],
                label: 'Group (optional)',
                required: false,
            },
            {
                channel: 'size',
                expectedType: 'quantitative',
                label: 'Size (optional)',
                required: false,
            },
        ],
    },
    {
        id: 'heatmap-grid',
        name: 'Heatmap Grid',
        description: 'Visualize intensity across two categorical dimensions',
        category: 'general',
        mark: 'heatmap',
        icon: 'Grid3X3',
        slots: [
            {
                channel: 'x',
                expectedType: ['nominal', 'ordinal'],
                label: 'Column',
                required: true,
            },
            {
                channel: 'y',
                expectedType: ['nominal', 'ordinal'],
                label: 'Row',
                required: true,
            },
            {
                channel: 'color',
                expectedType: 'quantitative',
                label: 'Intensity',
                required: true,
                aggregate: 'mean',
            },
        ],
    },

    // ---- Sales ----
    {
        id: 'sales-by-region',
        name: 'Sales by Region',
        description: 'Compare revenue across geographic regions',
        category: 'sales',
        mark: 'bar',
        icon: 'BarChart3',
        slots: [
            {
                channel: 'x',
                expectedType: ['nominal', 'ordinal'],
                label: 'Region',
                required: true,
                preferredPatterns: ['region', 'country', 'state', 'city', 'location', 'territory'],
            },
            {
                channel: 'y',
                expectedType: 'quantitative',
                label: 'Revenue',
                required: true,
                aggregate: 'sum',
                preferredPatterns: ['revenue', 'sales', 'amount', 'total'],
            },
            {
                channel: 'color',
                expectedType: ['nominal', 'ordinal'],
                label: 'Product (optional)',
                required: false,
                preferredPatterns: ['product', 'category', 'segment'],
            },
        ],
    },
    {
        id: 'sales-trend',
        name: 'Revenue Trend',
        description: 'Track revenue growth over time periods',
        category: 'sales',
        mark: 'area',
        icon: 'TrendingUp',
        slots: [
            {
                channel: 'x',
                expectedType: 'temporal',
                label: 'Period',
                required: true,
                preferredPatterns: ['date', 'month', 'quarter', 'year', 'period'],
            },
            {
                channel: 'y',
                expectedType: 'quantitative',
                label: 'Revenue',
                required: true,
                aggregate: 'sum',
                preferredPatterns: ['revenue', 'sales', 'amount', 'income'],
            },
        ],
    },
    {
        id: 'sales-pipeline',
        name: 'Sales Pipeline',
        description: 'Visualize conversion stages as a funnel',
        category: 'sales',
        mark: 'funnel',
        icon: 'TrendingDown',
        slots: [
            {
                channel: 'x',
                expectedType: ['nominal', 'ordinal'],
                label: 'Stage',
                required: true,
                preferredPatterns: ['stage', 'step', 'phase', 'status', 'funnel'],
            },
            {
                channel: 'y',
                expectedType: 'quantitative',
                label: 'Count/Value',
                required: true,
                aggregate: 'sum',
                preferredPatterns: ['count', 'deals', 'value', 'leads', 'opportunities'],
            },
        ],
    },

    // ---- Marketing ----
    {
        id: 'campaign-performance',
        name: 'Campaign Performance',
        description: 'Compare metrics across marketing campaigns',
        category: 'marketing',
        mark: 'bar',
        icon: 'BarChart3',
        slots: [
            {
                channel: 'x',
                expectedType: ['nominal', 'ordinal'],
                label: 'Campaign',
                required: true,
                preferredPatterns: ['campaign', 'channel', 'source', 'medium', 'ad'],
            },
            {
                channel: 'y',
                expectedType: 'quantitative',
                label: 'Metric',
                required: true,
                aggregate: 'sum',
                preferredPatterns: ['clicks', 'impressions', 'conversions', 'spend', 'roi', 'ctr'],
            },
        ],
    },
    {
        id: 'engagement-radar',
        name: 'Engagement Radar',
        description: 'Multi-metric comparison across categories',
        category: 'marketing',
        mark: 'radar',
        icon: 'Target',
        slots: [
            {
                channel: 'x',
                expectedType: ['nominal', 'ordinal'],
                label: 'Dimension',
                required: true,
                preferredPatterns: ['metric', 'dimension', 'attribute', 'category'],
            },
            {
                channel: 'y',
                expectedType: 'quantitative',
                label: 'Score',
                required: true,
                aggregate: 'mean',
                preferredPatterns: ['score', 'value', 'rating', 'index'],
            },
        ],
    },
    {
        id: 'conversion-funnel',
        name: 'Conversion Funnel',
        description: 'Track user journey from awareness to conversion',
        category: 'marketing',
        mark: 'funnel',
        icon: 'TrendingDown',
        slots: [
            {
                channel: 'x',
                expectedType: ['nominal', 'ordinal'],
                label: 'Stage',
                required: true,
                preferredPatterns: ['stage', 'step', 'funnel', 'phase'],
            },
            {
                channel: 'y',
                expectedType: 'quantitative',
                label: 'Users/Count',
                required: true,
                aggregate: 'sum',
                preferredPatterns: ['users', 'visitors', 'count', 'sessions'],
            },
        ],
    },

    // ---- Operations ----
    {
        id: 'throughput-timeline',
        name: 'Throughput Timeline',
        description: 'Track operational output over time',
        category: 'operations',
        mark: 'line',
        icon: 'LineChart',
        slots: [
            {
                channel: 'x',
                expectedType: 'temporal',
                label: 'Date',
                required: true,
                preferredPatterns: ['date', 'time', 'shift', 'period'],
            },
            {
                channel: 'y',
                expectedType: 'quantitative',
                label: 'Output',
                required: true,
                aggregate: 'sum',
                preferredPatterns: ['units', 'output', 'produced', 'throughput', 'count'],
            },
            {
                channel: 'color',
                expectedType: ['nominal', 'ordinal'],
                label: 'Line (optional)',
                required: false,
                preferredPatterns: ['line', 'machine', 'department', 'team'],
            },
        ],
    },
    {
        id: 'quality-distribution',
        name: 'Quality Distribution',
        description: 'Analyze distribution of quality metrics',
        category: 'operations',
        mark: 'boxplot',
        icon: 'BoxSelect',
        slots: [
            {
                channel: 'x',
                expectedType: ['nominal', 'ordinal'],
                label: 'Category',
                required: true,
                preferredPatterns: ['product', 'line', 'batch', 'type', 'category'],
            },
            {
                channel: 'y',
                expectedType: 'quantitative',
                label: 'Measurement',
                required: true,
                preferredPatterns: ['quality', 'score', 'measurement', 'defects', 'yield'],
            },
        ],
    },

    // ---- Finance ----
    {
        id: 'budget-vs-actual',
        name: 'Budget vs Actual',
        description: 'Compare budgeted vs actual spending by category',
        category: 'finance',
        mark: 'bar',
        icon: 'BarChart3',
        slots: [
            {
                channel: 'x',
                expectedType: ['nominal', 'ordinal'],
                label: 'Category',
                required: true,
                preferredPatterns: ['category', 'department', 'account', 'item', 'line'],
            },
            {
                channel: 'y',
                expectedType: 'quantitative',
                label: 'Amount',
                required: true,
                aggregate: 'sum',
                preferredPatterns: ['budget', 'actual', 'amount', 'spend', 'cost'],
            },
            {
                channel: 'color',
                expectedType: ['nominal', 'ordinal'],
                label: 'Type (Budget/Actual)',
                required: false,
                preferredPatterns: ['type', 'category', 'budget_actual', 'version'],
            },
        ],
    },
    {
        id: 'expense-breakdown',
        name: 'Expense Breakdown',
        description: 'Visualize expense distribution with a treemap',
        category: 'finance',
        mark: 'treemap',
        icon: 'Grid3X3',
        slots: [
            {
                channel: 'x',
                expectedType: ['nominal', 'ordinal'],
                label: 'Category',
                required: true,
                preferredPatterns: ['category', 'department', 'account', 'expense_type'],
            },
            {
                channel: 'y',
                expectedType: 'quantitative',
                label: 'Amount',
                required: true,
                aggregate: 'sum',
                preferredPatterns: ['amount', 'cost', 'expense', 'spend', 'total'],
            },
        ],
    },
    {
        id: 'revenue-waterfall',
        name: 'Revenue Waterfall',
        description: 'Show how revenue builds up or breaks down',
        category: 'finance',
        mark: 'waterfall',
        icon: 'Layers',
        slots: [
            {
                channel: 'x',
                expectedType: ['nominal', 'ordinal'],
                label: 'Component',
                required: true,
                preferredPatterns: ['item', 'component', 'category', 'stage', 'source'],
            },
            {
                channel: 'y',
                expectedType: 'quantitative',
                label: 'Amount',
                required: true,
                aggregate: 'sum',
                preferredPatterns: ['amount', 'value', 'revenue', 'change'],
            },
        ],
    },
];

// ============================================
// Auto-Mapping Logic
// ============================================

/**
 * Score how well a field matches a template slot.
 * Higher score = better match.
 */
function scoreFieldForSlot(
    fieldName: string,
    fieldType: FieldType,
    slot: TemplateSlot,
): number {
    // Type must match
    const expectedTypes = Array.isArray(slot.expectedType)
        ? slot.expectedType
        : [slot.expectedType];

    if (!expectedTypes.includes(fieldType)) {
        return -1; // Incompatible type
    }

    let score = 1; // Base score for type match

    // Bonus for name pattern match
    if (slot.preferredPatterns) {
        const lowerName = fieldName.toLowerCase();
        for (const pattern of slot.preferredPatterns) {
            if (lowerName.includes(pattern.toLowerCase())) {
                score += 10;
                break;
            }
        }
    }

    return score;
}

/**
 * Auto-map dataset fields to a template's slots.
 * Returns a mapping of channel -> field, or null for slots that couldn't be filled.
 */
export function autoMapFields(
    template: ChartTemplate,
    fields: { name: string; type: FieldType }[],
): Map<EncodingChannel, { name: string; type: FieldType } | null> {
    const result = new Map<EncodingChannel, { name: string; type: FieldType } | null>();
    const usedFields = new Set<string>();

    // Sort slots: required first, then by number of matching fields (harder to fill first)
    const sortedSlots = [...template.slots].sort((a, b) => {
        if (a.required !== b.required) return a.required ? -1 : 1;
        return 0;
    });

    for (const slot of sortedSlots) {
        // Score all available fields
        const candidates = fields
            .filter(f => !usedFields.has(f.name))
            .map(f => ({ field: f, score: scoreFieldForSlot(f.name, f.type, slot) }))
            .filter(c => c.score > 0)
            .sort((a, b) => b.score - a.score);

        if (candidates.length > 0) {
            const best = candidates[0].field;
            result.set(slot.channel, best);
            usedFields.add(best.name);
        } else {
            result.set(slot.channel, null);
        }
    }

    return result;
}

/**
 * Check if a template can be applied to a dataset (all required slots fillable)
 */
export function canApplyTemplate(
    template: ChartTemplate,
    fields: { name: string; type: FieldType }[],
): boolean {
    const mapping = autoMapFields(template, fields);
    return template.slots
        .filter(s => s.required)
        .every(s => mapping.get(s.channel) !== null);
}

/**
 * Look up a chart template by its ID
 */
export function getChartTemplateById(id: string): ChartTemplate | undefined {
    return chartTemplates.find(t => t.id === id);
}
