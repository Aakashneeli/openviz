// ============================================
// Share Service - Shareable Dashboard Links
// Compresses dashboard state into URL-safe strings
// ============================================

import LZString from 'lz-string';
import type { DashboardConfig, Dataset } from '@backend/types';

interface SharePayload {
    v: 1;
    d: DashboardConfig;
    ds: Dataset;
}

const MAX_URL_LENGTH = 32000; // Safe URL length limit

/**
 * Compress dashboard + dataset into a URL-safe string
 */
export function compressDashboardState(
    dashboard: DashboardConfig,
    dataset: Dataset,
): string {
    const payload: SharePayload = {
        v: 1,
        d: dashboard,
        ds: dataset,
    };

    const json = JSON.stringify(payload);
    const compressed = LZString.compressToEncodedURIComponent(json);
    return compressed;
}

/**
 * Decompress a URL-safe string back into dashboard + dataset
 */
export function decompressDashboardState(compressed: string): {
    dashboard: DashboardConfig;
    dataset: Dataset;
} {
    const json = LZString.decompressFromEncodedURIComponent(compressed);
    if (!json) {
        throw new Error('Failed to decompress shared dashboard data');
    }

    const payload = JSON.parse(json) as SharePayload;

    if (!payload.d || !payload.ds) {
        throw new Error('Invalid shared dashboard format');
    }

    // Revive Date objects
    payload.d.createdAt = new Date(payload.d.createdAt);
    payload.ds.uploadedAt = new Date(payload.ds.uploadedAt);

    return {
        dashboard: payload.d,
        dataset: payload.ds,
    };
}

/**
 * Generate a shareable URL for the current dashboard
 * Returns the URL string and whether the dataset was too large
 */
export function generateShareURL(
    dashboard: DashboardConfig,
    dataset: Dataset,
): { url: string; tooLarge: boolean } {
    const compressed = compressDashboardState(dashboard, dataset);
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
