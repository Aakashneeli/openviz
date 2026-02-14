// ============================================
// URL/API Data Service
// Fetch and parse data from remote URLs
// Supports JSON and CSV formats
// ============================================

import Papa from 'papaparse';
import type { DataRecord } from '@backend/types';

export interface URLImportOptions {
    url: string;
    format: 'auto' | 'json' | 'csv';
    headers?: Record<string, string>;
    jsonPath?: string; // dot-separated path to array in JSON (e.g., "data.results")
}

export interface URLImportResult {
    data: DataRecord[];
    format: 'json' | 'csv';
    rowCount: number;
    name: string;
}

/**
 * Detect format from URL or content-type
 */
function detectFormat(url: string, contentType?: string): 'json' | 'csv' {
    if (contentType) {
        if (contentType.includes('json')) return 'json';
        if (contentType.includes('csv') || contentType.includes('text/plain')) return 'csv';
    }
    const urlLower = url.toLowerCase();
    if (urlLower.endsWith('.csv') || urlLower.endsWith('.tsv')) return 'csv';
    if (urlLower.endsWith('.json')) return 'json';
    // Default to JSON for API endpoints
    return 'json';
}

/**
 * Extract a nested value from a JSON object using dot notation
 * e.g., getNestedValue(obj, "data.results") => obj.data.results
 */
function getNestedValue(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
        if (current === null || current === undefined || typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[part];
    }
    return current;
}

/**
 * Extract filename from URL for display
 */
function extractNameFromURL(url: string): string {
    try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        const lastPart = pathParts[pathParts.length - 1];
        if (lastPart) {
            // Remove extension
            return lastPart.replace(/\.(csv|json|tsv)$/i, '') || urlObj.hostname;
        }
        return urlObj.hostname;
    } catch {
        return 'url-data';
    }
}

/**
 * Fetch and parse data from a URL
 */
export async function fetchDataFromURL(options: URLImportOptions): Promise<URLImportResult> {
    const { url, format: requestedFormat, headers = {}, jsonPath } = options;

    // Validate URL
    try {
        new URL(url);
    } catch {
        throw new Error('Invalid URL format');
    }

    // Fetch data
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            ...headers,
        },
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    const format = requestedFormat === 'auto'
        ? detectFormat(url, contentType)
        : requestedFormat;

    const text = await response.text();

    let data: DataRecord[];

    if (format === 'json') {
        const parsed = JSON.parse(text);
        let targetData = parsed;

        // Navigate to nested array if jsonPath is specified
        if (jsonPath) {
            targetData = getNestedValue(parsed, jsonPath);
            if (!targetData) {
                throw new Error(`No data found at path "${jsonPath}"`);
            }
        }

        // Handle various JSON structures
        if (Array.isArray(targetData)) {
            data = targetData as DataRecord[];
        } else if (typeof targetData === 'object' && targetData !== null) {
            // Try common patterns: data, results, items, records, rows
            const commonKeys = ['data', 'results', 'items', 'records', 'rows', 'entries', 'values'];
            const found = commonKeys.find(key =>
                Array.isArray((targetData as Record<string, unknown>)[key])
            );
            if (found) {
                data = (targetData as Record<string, unknown>)[found] as DataRecord[];
            } else {
                throw new Error('Could not find data array in JSON response. Try specifying a JSON path.');
            }
        } else {
            throw new Error('Invalid JSON format. Expected an array or object with data array.');
        }
    } else {
        // CSV parsing
        const parseResult = Papa.parse<DataRecord>(text, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
        });

        if (parseResult.errors.length > 0 && parseResult.data.length === 0) {
            throw new Error(`CSV parse error: ${parseResult.errors[0].message}`);
        }

        data = parseResult.data;
    }

    if (data.length === 0) {
        throw new Error('No data rows found in the response');
    }

    return {
        data,
        format,
        rowCount: data.length,
        name: extractNameFromURL(url),
    };
}
