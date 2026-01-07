// ============================================
// Data Context Service
// Generates data profiles for AI context injection
// ============================================

import * as aq from 'arquero';
import type { ColumnTable } from 'arquero';
import type {
    DataRecord,
    FieldInfo,
    DataProfile,
    FieldProfile,
    CleaningSuggestion,
} from '../types';

// ============================================
// Profile Generation
// ============================================

/**
 * Generate a comprehensive data profile for AI context
 * This profile is injected into LLM prompts for accurate answers
 */
export function generateDataProfile(
    data: DataRecord[],
    fields: FieldInfo[]
): DataProfile {
    const table = aq.from(data);

    const fieldProfiles: FieldProfile[] = fields.map(field =>
        generateFieldProfile(field, table, data)
    );

    const cleaningSuggestions = detectDataIssues(fields, data);

    return {
        rowCount: data.length,
        columnCount: fields.length,
        fields: fieldProfiles,
        cleaningSuggestions,
        generatedAt: new Date(),
    };
}

/**
 * Generate profile for a single field
 */
function generateFieldProfile(
    field: FieldInfo,
    _table: ColumnTable, // Keep for future use
    data: DataRecord[]
): FieldProfile {
    const profile: FieldProfile = {
        name: field.name,
        type: field.type,
        uniqueCount: field.stats.uniqueCount ?? 0,
        nullCount: field.stats.nullCount,
        exampleValues: getExampleValues(data, field.name, 5),
    };

    // Add quantitative stats
    if (field.type === 'quantitative') {
        profile.stats = {
            min: field.stats.min ?? 0,
            max: field.stats.max ?? 0,
            mean: field.stats.mean ?? 0,
            median: field.stats.median ?? 0,
            stdDev: field.stats.stdDev ?? 0,
        };
    }

    // Add temporal range
    if (field.type === 'temporal') {
        profile.dateRange = {
            min: field.stats.minDate ?? '',
            max: field.stats.maxDate ?? '',
        };
    }

    // Add top values for categorical fields
    if (field.type === 'nominal' || field.type === 'ordinal') {
        profile.topValues = field.stats.topValues?.slice(0, 5);
    }

    return profile;
}

/**
 * Get example values from a column
 */
function getExampleValues(
    data: DataRecord[],
    fieldName: string,
    count: number
): unknown[] {
    const values: unknown[] = [];
    const seen = new Set<string>();

    for (const row of data) {
        const val = row[fieldName];
        if (val != null) {
            const key = String(val);
            if (!seen.has(key)) {
                seen.add(key);
                values.push(val);
                if (values.length >= count) break;
            }
        }
    }

    return values;
}

/**
 * Detect potential data quality issues
 */
function detectDataIssues(
    fields: FieldInfo[],
    data: DataRecord[]
): CleaningSuggestion[] {
    const suggestions: CleaningSuggestion[] = [];

    for (const field of fields) {
        // Check for missing values
        if (field.stats.nullCount > 0) {
            const percentage = (field.stats.nullCount / data.length) * 100;
            if (percentage > 5) {
                suggestions.push({
                    field: field.name,
                    issue: 'missing_values',
                    description: `${field.stats.nullCount} missing values (${percentage.toFixed(1)}%)`,
                    severity: percentage > 20 ? 'high' : percentage > 10 ? 'medium' : 'low',
                });
            }
        }

        // Check for potential outliers in quantitative fields
        if (field.type === 'quantitative' && field.stats.stdDev) {
            const mean = field.stats.mean ?? 0;
            const stdDev = field.stats.stdDev;
            const max = field.stats.max ?? 0;
            const min = field.stats.min ?? 0;

            // If max/min is more than 3 standard deviations from mean
            if (max > mean + 3 * stdDev || min < mean - 3 * stdDev) {
                suggestions.push({
                    field: field.name,
                    issue: 'outliers',
                    description: `Potential outliers detected (values beyond 3σ from mean)`,
                    severity: 'low',
                });
            }
        }
    }

    return suggestions;
}

// ============================================
// Query Execution (for accurate answers)
// ============================================

export type QueryOperation =
    | 'sum' | 'mean' | 'min' | 'max' | 'median' | 'count'
    | 'distinct' | 'any';

export interface DataQuery {
    operation: QueryOperation;
    field: string;
    groupBy?: string;
    filter?: { field: string; operator: string; value: unknown };
    limit?: number;
    orderBy?: { field: string; direction: 'asc' | 'desc' };
}

/**
 * Execute a structured data query using Arquero
 * This ensures 100% accurate answers for data questions
 */
export function executeDataQuery(
    data: DataRecord[],
    query: DataQuery
): unknown {
    let table = aq.from(data);

    // Apply filter if present
    if (query.filter) {
        const { field, operator, value } = query.filter;
        table = table.filter(aq.escape((d: DataRecord) => {
            const fieldValue = d[field];
            switch (operator) {
                case 'eq': return fieldValue === value;
                case 'neq': return fieldValue !== value;
                case 'gt': return (fieldValue as number) > (value as number);
                case 'gte': return (fieldValue as number) >= (value as number);
                case 'lt': return (fieldValue as number) < (value as number);
                case 'lte': return (fieldValue as number) <= (value as number);
                case 'contains': return String(fieldValue).includes(String(value));
                default: return true;
            }
        }));
    }

    // Apply groupBy if present
    if (query.groupBy) {
        table = table.groupby(query.groupBy).rollup({
            [`${query.operation}_${query.field}`]: getAggregation(query.operation, query.field)
        });

        // Apply ordering
        if (query.orderBy) {
            const orderField = query.orderBy.field === query.field
                ? `${query.operation}_${query.field}`
                : query.orderBy.field;
            table = query.orderBy.direction === 'desc'
                ? table.orderby(aq.desc(orderField))
                : table.orderby(orderField);
        }

        // Apply limit
        if (query.limit) {
            table = table.slice(0, query.limit);
        }

        return table.objects();
    }

    // Simple aggregation without groupBy
    const result = table.rollup({
        result: getAggregation(query.operation, query.field)
    });
    return result.get('result', 0);
}

/**
 * Get Arquero aggregation function
 */
function getAggregation(operation: QueryOperation, field: string) {
    switch (operation) {
        case 'sum': return aq.op.sum(field);
        case 'mean': return aq.op.mean(field);
        case 'min': return aq.op.min(field);
        case 'max': return aq.op.max(field);
        case 'median': return aq.op.median(field);
        case 'count': return aq.op.count();
        case 'distinct': return aq.op.distinct(field);
        case 'any': return aq.op.any(field);
        default: return aq.op.count();
    }
}

// ============================================
// Context Formatting for LLM
// ============================================

/**
 * Format data profile as context string for LLM prompt
 */
export function formatProfileForLLM(profile: DataProfile): string {
    const lines: string[] = [
        `Dataset: ${profile.rowCount} rows, ${profile.columnCount} columns`,
        '',
        'Fields:',
    ];

    for (const field of profile.fields) {
        let fieldLine = `- "${field.name}" (${field.type})`;

        if (field.stats) {
            fieldLine += `: min=${field.stats.min}, max=${field.stats.max}, mean=${field.stats.mean.toFixed(2)}`;
        } else if (field.dateRange) {
            fieldLine += `: ${field.dateRange.min} to ${field.dateRange.max}`;
        } else if (field.topValues && field.topValues.length > 0) {
            const topVals = field.topValues.slice(0, 3).map(v => v.value).join(', ');
            fieldLine += `: ${field.uniqueCount} unique values (e.g., ${topVals})`;
        }

        lines.push(fieldLine);
    }

    if (profile.cleaningSuggestions && profile.cleaningSuggestions.length > 0) {
        lines.push('');
        lines.push('Data Quality Notes:');
        for (const suggestion of profile.cleaningSuggestions) {
            lines.push(`- ${suggestion.field}: ${suggestion.description}`);
        }
    }

    return lines.join('\n');
}
