import type { DashboardTemplate } from '@backend/types';
import type { FieldType } from '@backend/types';
import { getChartTemplateById, canApplyTemplate } from './chartTemplates';

// ============================================
// Dashboard Template Definitions
// ============================================

export const dashboardTemplates: DashboardTemplate[] = [
    // ---- Sales ----
    {
        id: 'sales-overview',
        name: 'Sales Overview',
        description: 'Regional breakdown, revenue trend, product mix, and category comparison in one view.',
        category: 'sales',
        icon: 'TrendingUp',
        tags: ['sales', 'revenue', 'region', 'trend', 'overview'],
        cols: 2,
        chartSlots: [
            {
                chartTemplateId: 'sales-by-region',
                suggestedTitle: 'Sales by Region',
                layout: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
            },
            {
                chartTemplateId: 'sales-trend',
                suggestedTitle: 'Revenue Trend',
                layout: { col: 1, row: 0, colSpan: 1, rowSpan: 1 },
            },
            {
                chartTemplateId: 'pie-breakdown',
                suggestedTitle: 'Product Mix',
                layout: { col: 0, row: 1, colSpan: 1, rowSpan: 1 },
            },
            {
                chartTemplateId: 'bar-comparison',
                suggestedTitle: 'Category Comparison',
                layout: { col: 1, row: 1, colSpan: 1, rowSpan: 1 },
            },
        ],
    },
    {
        id: 'sales-pipeline-dashboard',
        name: 'Sales Pipeline',
        description: 'Pipeline funnel, regional performance, trends, and proportion breakdown.',
        category: 'sales',
        icon: 'Filter',
        tags: ['sales', 'pipeline', 'funnel', 'conversion'],
        cols: 2,
        chartSlots: [
            {
                chartTemplateId: 'sales-pipeline',
                suggestedTitle: 'Sales Pipeline',
                layout: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
            },
            {
                chartTemplateId: 'sales-by-region',
                suggestedTitle: 'Regional Performance',
                layout: { col: 1, row: 0, colSpan: 1, rowSpan: 1 },
            },
            {
                chartTemplateId: 'sales-trend',
                suggestedTitle: 'Revenue Over Time',
                layout: { col: 0, row: 1, colSpan: 1, rowSpan: 1 },
            },
            {
                chartTemplateId: 'pie-breakdown',
                suggestedTitle: 'Proportion Breakdown',
                layout: { col: 1, row: 1, colSpan: 1, rowSpan: 1 },
            },
        ],
    },

    // ---- Marketing ----
    {
        id: 'marketing-dashboard',
        name: 'Marketing Dashboard',
        description: 'Campaign metrics, conversion funnel, engagement radar, and trend analysis.',
        category: 'marketing',
        icon: 'Megaphone',
        tags: ['marketing', 'campaign', 'funnel', 'engagement', 'conversion'],
        cols: 2,
        chartSlots: [
            {
                chartTemplateId: 'campaign-performance',
                suggestedTitle: 'Campaign Performance',
                layout: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
            },
            {
                chartTemplateId: 'conversion-funnel',
                suggestedTitle: 'Conversion Funnel',
                layout: { col: 1, row: 0, colSpan: 1, rowSpan: 1 },
            },
            {
                chartTemplateId: 'engagement-radar',
                suggestedTitle: 'Engagement Metrics',
                layout: { col: 0, row: 1, colSpan: 1, rowSpan: 1 },
            },
            {
                chartTemplateId: 'line-trend',
                suggestedTitle: 'Trend Over Time',
                layout: { col: 1, row: 1, colSpan: 1, rowSpan: 1 },
            },
        ],
    },

    // ---- General ----
    {
        id: 'executive-summary',
        name: 'Executive Summary',
        description: 'High-level overview with a featured comparison chart, trend line, and proportion breakdown.',
        category: 'general',
        icon: 'BarChart3',
        tags: ['executive', 'summary', 'overview', 'kpi'],
        cols: 2,
        chartSlots: [
            {
                chartTemplateId: 'bar-comparison',
                suggestedTitle: 'Key Metrics Comparison',
                layout: { col: 0, row: 0, colSpan: 2, rowSpan: 1 },
            },
            {
                chartTemplateId: 'line-trend',
                suggestedTitle: 'Trend Analysis',
                layout: { col: 0, row: 1, colSpan: 1, rowSpan: 1 },
            },
            {
                chartTemplateId: 'pie-breakdown',
                suggestedTitle: 'Distribution',
                layout: { col: 1, row: 1, colSpan: 1, rowSpan: 1 },
            },
        ],
    },
    {
        id: 'correlation-explorer',
        name: 'Correlation Explorer',
        description: 'Scatter plot, heatmap, and comparison chart for exploring data relationships.',
        category: 'general',
        icon: 'GitBranch',
        tags: ['correlation', 'scatter', 'heatmap', 'analysis', 'relationship'],
        cols: 2,
        chartSlots: [
            {
                chartTemplateId: 'scatter-correlation',
                suggestedTitle: 'Correlation Plot',
                layout: { col: 0, row: 0, colSpan: 2, rowSpan: 1 },
            },
            {
                chartTemplateId: 'heatmap-grid',
                suggestedTitle: 'Heatmap',
                layout: { col: 0, row: 1, colSpan: 1, rowSpan: 1 },
            },
            {
                chartTemplateId: 'bar-comparison',
                suggestedTitle: 'Category Breakdown',
                layout: { col: 1, row: 1, colSpan: 1, rowSpan: 1 },
            },
        ],
    },

    // ---- Operations ----
    {
        id: 'operations-monitor',
        name: 'Operations Monitor',
        description: 'Throughput timeline, quality metrics, and category comparison for operational tracking.',
        category: 'operations',
        icon: 'Activity',
        tags: ['operations', 'throughput', 'quality', 'monitoring'],
        cols: 2,
        chartSlots: [
            {
                chartTemplateId: 'throughput-timeline',
                suggestedTitle: 'Throughput Over Time',
                layout: { col: 0, row: 0, colSpan: 2, rowSpan: 1 },
            },
            {
                chartTemplateId: 'quality-distribution',
                suggestedTitle: 'Quality Distribution',
                layout: { col: 0, row: 1, colSpan: 1, rowSpan: 1 },
            },
            {
                chartTemplateId: 'bar-comparison',
                suggestedTitle: 'Category Comparison',
                layout: { col: 1, row: 1, colSpan: 1, rowSpan: 1 },
            },
        ],
    },

    // ---- Finance ----
    {
        id: 'financial-report',
        name: 'Financial Report',
        description: 'Budget vs actual, expense breakdown, revenue waterfall, and revenue trend.',
        category: 'finance',
        icon: 'DollarSign',
        tags: ['finance', 'budget', 'expense', 'revenue', 'waterfall'],
        cols: 2,
        chartSlots: [
            {
                chartTemplateId: 'budget-vs-actual',
                suggestedTitle: 'Budget vs Actual',
                layout: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
            },
            {
                chartTemplateId: 'expense-breakdown',
                suggestedTitle: 'Expense Breakdown',
                layout: { col: 1, row: 0, colSpan: 1, rowSpan: 1 },
            },
            {
                chartTemplateId: 'revenue-waterfall',
                suggestedTitle: 'Revenue Waterfall',
                layout: { col: 0, row: 1, colSpan: 1, rowSpan: 1 },
            },
            {
                chartTemplateId: 'sales-trend',
                suggestedTitle: 'Revenue Trend',
                layout: { col: 1, row: 1, colSpan: 1, rowSpan: 1 },
            },
        ],
    },
];

// ============================================
// Applicability Helpers
// ============================================

/**
 * Check how many charts in a dashboard template can be applied to the current dataset.
 */
export function getDashboardTemplateApplicability(
    template: DashboardTemplate,
    fields: { name: string; type: FieldType }[],
): { total: number; applicable: number; canApply: boolean } {
    let applicable = 0;
    const total = template.chartSlots.length;

    for (const slot of template.chartSlots) {
        const chartTemplate = getChartTemplateById(slot.chartTemplateId);
        if (chartTemplate && canApplyTemplate(chartTemplate, fields)) {
            applicable++;
        }
    }

    return { total, applicable, canApply: applicable >= 2 };
}

/**
 * Convenience: can at least 2 charts in this dashboard template be applied?
 */
export function canApplyDashboardTemplate(
    template: DashboardTemplate,
    fields: { name: string; type: FieldType }[],
): boolean {
    return getDashboardTemplateApplicability(template, fields).canApply;
}
