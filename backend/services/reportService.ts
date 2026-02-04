// ============================================
// Report Generation Service
// Generates markdown reports with LLM narratives
// ============================================

import type {
    DataProfile,
    ChartConfig,
    DataRecord,
    ReportSection,
    ReportData,
} from '../types';

/**
 * Generate a data overview section (pure computation, no LLM)
 */
export function generateDataOverview(dataProfile: DataProfile): ReportSection {
    const lines: string[] = [];
    lines.push(`The dataset contains **${dataProfile.rowCount}** rows and **${dataProfile.columnCount}** columns.`);
    lines.push('');
    lines.push('### Field Summary');
    lines.push('');
    lines.push('| Field | Type | Details |');
    lines.push('|-------|------|---------|');

    for (const field of dataProfile.fields) {
        let details = '';
        if (field.stats) {
            details = `Min: ${field.stats.min}, Max: ${field.stats.max}, Mean: ${field.stats.mean.toFixed(2)}`;
        } else if (field.dateRange) {
            details = `${field.dateRange.min} to ${field.dateRange.max}`;
        } else if (field.topValues && field.topValues.length > 0) {
            details = `${field.uniqueCount} unique values`;
        }
        lines.push(`| ${field.name} | ${field.type} | ${details} |`);
    }

    if (dataProfile.cleaningSuggestions && dataProfile.cleaningSuggestions.length > 0) {
        lines.push('');
        lines.push('### Data Quality Notes');
        for (const s of dataProfile.cleaningSuggestions) {
            lines.push(`- **${s.field}**: ${s.description} (${s.severity})`);
        }
    }

    return {
        type: 'data_overview',
        title: 'Data Overview',
        content: lines.join('\n'),
        enabled: true,
    };
}

/**
 * Generate executive summary via LLM
 */
export async function generateExecutiveSummary(
    dataProfile: DataProfile,
    charts: ChartConfig[],
    generateNarrative: (prompt: string) => Promise<string>
): Promise<ReportSection> {
    const chartDescriptions = charts.map((c, i) => {
        const xEnc = c.encodings.find(e => e.channel === 'x');
        const yEnc = c.encodings.find(e => e.channel === 'y');
        return `${i + 1}. ${c.title || c.mark + ' chart'}${xEnc && yEnc ? ` — ${yEnc.field.name} by ${xEnc.field.name}` : ''}`;
    }).join('\n');

    const fieldSummary = dataProfile.fields.map(f => {
        if (f.stats) return `${f.name}: avg ${f.stats.mean.toFixed(1)}, range ${f.stats.min}–${f.stats.max}`;
        if (f.topValues) return `${f.name}: ${f.uniqueCount} categories`;
        return `${f.name}: ${f.type}`;
    }).join('; ');

    const prompt = `Write a concise executive summary (3-5 sentences) for a data report.
Dataset: ${dataProfile.rowCount} rows, ${dataProfile.columnCount} columns.
Key stats: ${fieldSummary}
Charts created: ${chartDescriptions || 'None yet'}
Focus on the most important findings and actionable takeaways. Use specific numbers.`;

    const content = await generateNarrative(prompt);

    return {
        type: 'executive_summary',
        title: 'Executive Summary',
        content,
        enabled: true,
    };
}

/**
 * Generate narrative for a single chart via LLM
 */
export async function generateChartNarrative(
    chartConfig: ChartConfig,
    _dataProfile: DataProfile,
    data: DataRecord[],
    generateNarrative: (prompt: string) => Promise<string>
): Promise<ReportSection> {
    const xEnc = chartConfig.encodings.find(e => e.channel === 'x');
    const yEnc = chartConfig.encodings.find(e => e.channel === 'y');

    const sampleData = data.slice(0, 10).map(row => {
        const subset: Record<string, unknown> = {};
        chartConfig.encodings.forEach(e => { subset[e.field.name] = row[e.field.name]; });
        return subset;
    });

    const prompt = `Write a 2-3 sentence narrative about this ${chartConfig.mark} chart titled "${chartConfig.title || 'Untitled'}".
X-axis: ${xEnc?.field.name || 'N/A'} (${xEnc?.field.type || ''})
Y-axis: ${yEnc?.field.name || 'N/A'} (${yEnc?.field.type || ''})${yEnc?.aggregate ? ` aggregated by ${yEnc.aggregate}` : ''}
Sample data: ${JSON.stringify(sampleData)}
Highlight the key insight. Use specific numbers.`;

    const content = await generateNarrative(prompt);

    return {
        type: 'chart_narrative',
        title: chartConfig.title || `${chartConfig.mark} Chart Analysis`,
        content,
        enabled: true,
    };
}

/**
 * Generate key findings via LLM
 */
export async function generateKeyFindings(
    dataProfile: DataProfile,
    data: DataRecord[],
    generateNarrative: (prompt: string) => Promise<string>
): Promise<ReportSection> {
    const fieldStats = dataProfile.fields
        .filter(f => f.stats)
        .map(f => `${f.name}: mean=${f.stats!.mean.toFixed(1)}, stdDev=${f.stats!.stdDev.toFixed(1)}`)
        .join('; ');

    const samples = data.slice(0, 5);

    const prompt = `List 3-5 key findings from this dataset as bullet points.
Stats: ${fieldStats}
Sample: ${JSON.stringify(samples)}
Each finding should be specific, use numbers, and be actionable. Format as markdown bullet list.`;

    const content = await generateNarrative(prompt);

    return {
        type: 'key_findings',
        title: 'Key Findings',
        content,
        enabled: true,
    };
}

/**
 * Orchestrate full report generation
 */
export async function generateFullReport(
    dataProfile: DataProfile,
    data: DataRecord[],
    charts: ChartConfig[],
    datasetName: string,
    generateNarrative: (prompt: string) => Promise<string>
): Promise<ReportData> {
    const sections: ReportSection[] = [];

    // Executive summary
    const execSummary = await generateExecutiveSummary(dataProfile, charts, generateNarrative);
    sections.push(execSummary);

    // Data overview (no LLM)
    sections.push(generateDataOverview(dataProfile));

    // Chart narratives
    for (const chart of charts) {
        const narrative = await generateChartNarrative(chart, dataProfile, data, generateNarrative);
        sections.push(narrative);
    }

    // Key findings
    const findings = await generateKeyFindings(dataProfile, data, generateNarrative);
    sections.push(findings);

    return {
        title: `${datasetName} — Data Report`,
        sections,
        generatedAt: new Date(),
        datasetName,
    };
}

/**
 * Compile report to markdown string
 */
export function compileToMarkdown(report: ReportData): string {
    const lines: string[] = [];
    lines.push(`# ${report.title}`);
    lines.push(`*Generated on ${report.generatedAt.toLocaleDateString()} at ${report.generatedAt.toLocaleTimeString()}*`);
    lines.push('');

    for (const section of report.sections) {
        if (!section.enabled) continue;
        lines.push(`## ${section.title}`);
        lines.push('');
        lines.push(section.content);
        lines.push('');
    }

    lines.push('---');
    lines.push('*Report generated by OpenViz*');

    return lines.join('\n');
}
