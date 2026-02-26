// ============================================
// Filter Service
// Applies NL-parsed filters to datasets
// ============================================

import type { DataRecord, FilterSpec, FilterCondition, FilterOperator } from '../types';

/**
 * Evaluate a single filter condition against a record
 */
function evaluateCondition(record: DataRecord, condition: FilterCondition): boolean {
    const fieldValue = record[condition.field];
    const { operator, value, valueTo } = condition;

    switch (operator) {
        case 'eq':
            return fieldValue == value; // loose equality for string/number coercion
        case 'neq':
            return fieldValue != value;
        case 'gt':
            return Number(fieldValue) > Number(value);
        case 'gte':
            return Number(fieldValue) >= Number(value);
        case 'lt':
            return Number(fieldValue) < Number(value);
        case 'lte':
            return Number(fieldValue) <= Number(value);
        case 'contains':
            return String(fieldValue).toLowerCase().includes(String(value).toLowerCase());
        case 'notContains':
            return !String(fieldValue).toLowerCase().includes(String(value).toLowerCase());
        case 'in':
            return Array.isArray(value) && value.includes(fieldValue);
        case 'notIn':
            return Array.isArray(value) && !value.includes(fieldValue);
        case 'between':
            return Number(fieldValue) >= Number(value) && Number(fieldValue) <= Number(valueTo);
        default:
            return true;
    }
}

/**
 * Apply filter spec to dataset
 */
export function applyFilters(data: DataRecord[], spec: FilterSpec): DataRecord[] {
    if (!spec.conditions || spec.conditions.length === 0) return data;

    return data.filter(record => {
        if (spec.logic === 'or') {
            return spec.conditions.some(c => evaluateCondition(record, c));
        }
        return spec.conditions.every(c => evaluateCondition(record, c));
    });
}

/**
 * Generate a human-readable summary of the filter
 */
export function getFilterSummary(
    spec: FilterSpec,
    originalCount: number,
    filteredCount: number
): string {
    const opLabels: Record<FilterOperator, string> = {
        eq: 'equals',
        neq: 'not equals',
        gt: 'greater than',
        gte: 'at least',
        lt: 'less than',
        lte: 'at most',
        contains: 'contains',
        notContains: 'does not contain',
        in: 'is one of',
        notIn: 'is not one of',
        between: 'between',
    };

    const parts = spec.conditions.map(c => {
        const op = opLabels[c.operator] || c.operator;
        if (c.operator === 'between') {
            return `${c.field} ${op} ${c.value} and ${c.valueTo}`;
        }
        return `${c.field} ${op} ${c.value}`;
    });

    const logic = spec.logic === 'or' ? ' OR ' : ' AND ';
    const filterDesc = parts.join(logic);
    return `Filtered: ${filterDesc} (${filteredCount} of ${originalCount} rows)`;
}
