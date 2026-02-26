// ============================================
// Share Service - Shareable Dashboard Links
// Compresses dashboard state into URL-safe strings
// ============================================

import LZString from 'lz-string';
import type { DashboardConfig, Dataset } from '@backend/types';

interface SharePayloadV1 {
    v: 1;
    d: DashboardConfig;
    ds: Dataset;
}

interface SharePayloadV2 {
    v: 2;
    d: DashboardConfig;
    includeDataset: boolean;
    ds?: Dataset;
}

type SharePayload = SharePayloadV1 | SharePayloadV2;

export interface ShareOptions {
    includeDataset?: boolean;
}

export interface DecompressedShareState {
    dashboard: DashboardConfig;
    dataset: Dataset | null;
    includeDataset: boolean;
    version: 1 | 2;
}

const MAX_URL_LENGTH = 32000; // Safe URL length limit

/**
 * Compress dashboard state into a URL-safe string.
 * V2 payload supports dataset privacy controls.
 */
export function compressDashboardState(
    dashboard: DashboardConfig,
    dataset: Dataset,
    options: ShareOptions = {},
): string {
    const includeDataset = options.includeDataset ?? true;

    const payload: SharePayloadV2 = {
        v: 2,
        d: dashboard,
        includeDataset,
        ...(includeDataset ? { ds: dataset } : {}),
    };

    const json = JSON.stringify(payload);
    const compressed = LZString.compressToEncodedURIComponent(json);
    return compressed;
}

function reviveDashboardDates(dashboard: DashboardConfig): DashboardConfig {
    return {
        ...dashboard,
        createdAt: new Date(dashboard.createdAt),
    };
}

function reviveDatasetDates(dataset: Dataset): Dataset {
    return {
        ...dataset,
        uploadedAt: new Date(dataset.uploadedAt),
    };
}

/**
 * Decompress a URL-safe string back into dashboard state.
 * Supports backward-compatible V1 and V2 payloads.
 */
export function decompressDashboardState(compressed: string): DecompressedShareState {
    const json = LZString.decompressFromEncodedURIComponent(compressed);
    if (!json) {
        throw new Error('Failed to decompress shared dashboard data');
    }

    const payload = JSON.parse(json) as SharePayload;

    // Backward compatibility: V1 always includes dataset.
    if ((payload as SharePayloadV1).v === 1) {
        const legacy = payload as SharePayloadV1;
        if (!legacy.d || !legacy.ds) {
            throw new Error('Invalid shared dashboard format (v1)');
        }

        return {
            version: 1,
            includeDataset: true,
            dashboard: reviveDashboardDates(legacy.d),
            dataset: reviveDatasetDates(legacy.ds),
        };
    }

    const current = payload as SharePayloadV2;
    if (!current.d) {
        throw new Error('Invalid shared dashboard format (v2)');
    }

    const includeDataset = current.includeDataset ?? Boolean(current.ds);

    return {
        version: 2,
        includeDataset,
        dashboard: reviveDashboardDates(current.d),
        dataset: current.ds ? reviveDatasetDates(current.ds) : null,
    };
}

/**
 * Generate a shareable URL for the current dashboard.
 * Returns the URL string and whether it is very large.
 */
export function generateShareURL(
    dashboard: DashboardConfig,
    dataset: Dataset,
    options: ShareOptions = {},
): { url: string; tooLarge: boolean } {
    const compressed = compressDashboardState(dashboard, dataset, options);
    const baseUrl = window.location.origin + window.location.pathname;
    const url = `${baseUrl}?state=${compressed}`;

    return {
        url,
        tooLarge: url.length > MAX_URL_LENGTH,
    };
}

/**
 * Check current URL for shared state parameter and return it if found
 */
export function getSharedStateFromURL(): string | null {
    const params = new URLSearchParams(window.location.search);
    return params.get('state');
}

/**
 * Clear the state parameter from the URL without reloading
 */
export function clearShareStateFromURL(): void {
    const url = new URL(window.location.href);
    url.searchParams.delete('state');
    window.history.replaceState({}, '', url.toString());
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            return true;
        } catch {
            return false;
        } finally {
            document.body.removeChild(textarea);
        }
    }
}
