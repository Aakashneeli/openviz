// ============================================
// Google Sheets Service
// OAuth 2.0 + Sheets API v4 for reading data
// Uses Google Identity Services (GIS) for token-based auth
// ============================================

import type { DataRecord } from '@backend/types';

// ============================================
// Configuration
// ============================================

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

// ============================================
// Types
// ============================================

export interface GoogleSheetsImportResult {
    data: DataRecord[];
    rowCount: number;
    spreadsheetId: string;
    sheetName: string;
    spreadsheetTitle: string;
}

export interface SpreadsheetInfo {
    spreadsheetId: string;
    title: string;
    sheets: Array<{ sheetId: number; title: string; rowCount: number; columnCount: number }>;
}

interface TokenClient {
    requestAccessToken: (config?: { prompt?: string }) => void;
    callback: (response: TokenResponse) => void;
}

interface TokenResponse {
    access_token: string;
    error?: string;
    error_description?: string;
}

// ============================================
// GIS Script Loader
// ============================================

let gisLoaded = false;
let gisLoadPromise: Promise<void> | null = null;

function loadGISScript(): Promise<void> {
    if (gisLoaded) return Promise.resolve();
    if (gisLoadPromise) return gisLoadPromise;

    gisLoadPromise = new Promise<void>((resolve, reject) => {
        if (document.querySelector(`script[src="${GIS_SCRIPT_URL}"]`)) {
            gisLoaded = true;
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = GIS_SCRIPT_URL;
        script.async = true;
        script.defer = true;
        script.onload = () => {
            gisLoaded = true;
            resolve();
        };
        script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
        document.head.appendChild(script);
    });

    return gisLoadPromise;
}

// ============================================
// Token Management
// ============================================

let cachedAccessToken: string | null = null;
let tokenExpiry = 0;

function isTokenValid(): boolean {
    return !!cachedAccessToken && Date.now() < tokenExpiry;
}

/**
 * Request an OAuth2 access token via Google Identity Services popup
 */
export async function getAccessToken(): Promise<string> {
    if (isTokenValid()) return cachedAccessToken!;

    if (!GOOGLE_CLIENT_ID) {
        throw new Error(
            'Google Client ID not configured. Add VITE_GOOGLE_CLIENT_ID to your .env file. ' +
            'Get one from https://console.cloud.google.com/apis/credentials'
        );
    }

    await loadGISScript();

    return new Promise<string>((resolve, reject) => {
        const google = (window as unknown as { google: { accounts: { oauth2: { initTokenClient: (config: { client_id: string; scope: string; callback: (resp: TokenResponse) => void; error_callback: (err: { type: string }) => void }) => TokenClient } } } }).google;

        if (!google?.accounts?.oauth2) {
            reject(new Error('Google Identity Services not available'));
            return;
        }

        const tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: SCOPES,
            callback: (response: TokenResponse) => {
                if (response.error) {
                    reject(new Error(response.error_description || response.error));
                    return;
                }
                cachedAccessToken = response.access_token;
                // Tokens last ~1 hour, set expiry at 55 min
                tokenExpiry = Date.now() + 55 * 60 * 1000;
                resolve(response.access_token);
            },
            error_callback: (err: { type: string }) => {
                reject(new Error(`Google auth error: ${err.type}`));
            },
        });

        tokenClient.requestAccessToken({ prompt: '' });
    });
}

/**
 * Clear cached token (for sign out)
 */
export function clearGoogleAuth(): void {
    if (cachedAccessToken) {
        const google = (window as unknown as { google: { accounts: { oauth2: { revoke: (token: string, cb: () => void) => void } } } }).google;
        google?.accounts?.oauth2?.revoke(cachedAccessToken, () => { /* revoked */ });
    }
    cachedAccessToken = null;
    tokenExpiry = 0;
}

// ============================================
// Spreadsheet ID Extraction
// ============================================

/**
 * Extract spreadsheet ID from a Google Sheets URL or direct ID
 */
export function extractSpreadsheetId(input: string): string {
    const trimmed = input.trim();

    // Direct ID (no slashes, alphanumeric + hyphens/underscores)
    if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) {
        return trimmed;
    }

    // URL patterns:
    // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
    // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];

    throw new Error('Invalid Google Sheets URL or ID. Paste the full URL or spreadsheet ID.');
}

// ============================================
// Sheets API Calls
// ============================================

/**
 * Get spreadsheet metadata (title, sheet names, dimensions)
 */
export async function getSpreadsheetInfo(spreadsheetId: string, accessToken: string): Promise<SpreadsheetInfo> {
    const url = `${SHEETS_API_BASE}/${spreadsheetId}?fields=spreadsheetId,properties.title,sheets.properties`;

    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
        if (response.status === 404) throw new Error('Spreadsheet not found. Check the URL or ID.');
        if (response.status === 403) throw new Error('Access denied. Make sure the spreadsheet is shared with you.');
        throw new Error(`Google Sheets API error: ${response.status}`);
    }

    const data = await response.json();

    return {
        spreadsheetId: data.spreadsheetId,
        title: data.properties.title,
        sheets: data.sheets.map((s: { properties: { sheetId: number; title: string; gridProperties?: { rowCount?: number; columnCount?: number } } }) => ({
            sheetId: s.properties.sheetId,
            title: s.properties.title,
            rowCount: s.properties.gridProperties?.rowCount ?? 0,
            columnCount: s.properties.gridProperties?.columnCount ?? 0,
        })),
    };
}

/**
 * Read all data from a specific sheet
 */
export async function readSheetData(
    spreadsheetId: string,
    sheetName: string,
    accessToken: string
): Promise<DataRecord[]> {
    const range = encodeURIComponent(sheetName);
    const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${range}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;

    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
        throw new Error(`Failed to read sheet data: ${response.status}`);
    }

    const result = await response.json();
    const rows: unknown[][] = result.values || [];

    if (rows.length < 2) {
        throw new Error('Sheet has no data rows (need at least a header row and one data row)');
    }

    // First row = headers
    const headers = rows[0].map((h: unknown, i: number) =>
        h != null && String(h).trim() !== '' ? String(h).trim() : `Column_${i + 1}`
    );

    // Remaining rows = data
    const data: DataRecord[] = [];
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        // Skip entirely empty rows
        if (!row || row.every(cell => cell === null || cell === undefined || cell === '')) continue;

        const record: DataRecord = {};
        for (let j = 0; j < headers.length; j++) {
            const value = j < row.length ? row[j] : null;
            record[headers[j]] = value;
        }
        data.push(record);
    }

    return data;
}

/**
 * Full import flow: authenticate, fetch metadata, read data
 */
export async function importFromGoogleSheets(
    spreadsheetInput: string,
    sheetName?: string
): Promise<GoogleSheetsImportResult> {
    const spreadsheetId = extractSpreadsheetId(spreadsheetInput);
    const accessToken = await getAccessToken();

    // Get spreadsheet info
    const info = await getSpreadsheetInfo(spreadsheetId, accessToken);

    // Use specified sheet or first sheet
    const targetSheet = sheetName
        ? info.sheets.find(s => s.title === sheetName)
        : info.sheets[0];

    if (!targetSheet) {
        throw new Error(`Sheet "${sheetName}" not found. Available: ${info.sheets.map(s => s.title).join(', ')}`);
    }

    // Read data
    const data = await readSheetData(spreadsheetId, targetSheet.title, accessToken);

    return {
        data,
        rowCount: data.length,
        spreadsheetId,
        sheetName: targetSheet.title,
        spreadsheetTitle: info.title,
    };
}

/**
 * Check if Google Sheets integration is available (client ID configured)
 */
export function isGoogleSheetsAvailable(): boolean {
    return !!GOOGLE_CLIENT_ID;
}
