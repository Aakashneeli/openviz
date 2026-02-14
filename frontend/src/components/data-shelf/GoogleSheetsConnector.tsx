// ============================================
// GoogleSheetsConnector - Import data from Google Sheets
// ============================================

import { useState } from 'react';
import { X, Loader2, FileSpreadsheet, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useVizStore } from '@/store/useVizStore';
import {
    importFromGoogleSheets,
    extractSpreadsheetId,
    getSpreadsheetInfo,
    getAccessToken,
    isGoogleSheetsAvailable,
} from '@/services/googleSheetsService';
import type { SpreadsheetInfo } from '@/services/googleSheetsService';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

interface GoogleSheetsConnectorProps {
    open: boolean;
    onClose: () => void;
}

export function GoogleSheetsConnector({ open, onClose }: GoogleSheetsConnectorProps) {
    const loadDataFromFile = useVizStore(state => state.loadDataFromFile);
    const setDataSource = useVizStore(state => state.setDataSource);

    const [urlOrId, setUrlOrId] = useState('');
    const [spreadsheetInfo, setSpreadsheetInfo] = useState<SpreadsheetInfo | null>(null);
    const [selectedSheet, setSelectedSheet] = useState<string>('');
    const [isConnecting, setIsConnecting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [step, setStep] = useState<'url' | 'sheet'>('url');

    const available = isGoogleSheetsAvailable();

    const handleConnect = async () => {
        if (!urlOrId.trim()) return;
        setIsConnecting(true);
        setError(null);

        try {
            const spreadsheetId = extractSpreadsheetId(urlOrId.trim());
            const accessToken = await getAccessToken();
            const info = await getSpreadsheetInfo(spreadsheetId, accessToken);
            setSpreadsheetInfo(info);
            setSelectedSheet(info.sheets[0]?.title || '');
            setStep('sheet');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to connect';
            setError(msg);
        } finally {
            setIsConnecting(false);
        }
    };

    const handleImport = async () => {
        if (!spreadsheetInfo || !selectedSheet) return;
        setIsImporting(true);
        setError(null);

        try {
            const result = await importFromGoogleSheets(
                spreadsheetInfo.spreadsheetId,
                selectedSheet
            );

            // Convert to CSV and load via existing pipeline
            const Papa = await import('papaparse');
            const csvContent = Papa.default.unparse(result.data);
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const file = new File([blob], `${result.spreadsheetTitle} - ${result.sheetName}.csv`, {
                type: 'text/csv',
            });

            await loadDataFromFile(file);

            // Store the connection info for refresh capability
            setDataSource({
                type: 'google-sheets',
                spreadsheetId: result.spreadsheetId,
                sheetName: result.sheetName,
                spreadsheetTitle: result.spreadsheetTitle,
                lastFetchedAt: new Date(),
            });

            toast.success('Google Sheets data imported', {
                description: `${result.rowCount.toLocaleString()} rows from "${result.spreadsheetTitle}" → ${result.sheetName}`,
            });

            handleReset();
            onClose();
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to import data';
            setError(msg);
            toast.error('Import failed', { description: msg });
        } finally {
            setIsImporting(false);
        }
    };

    const handleReset = () => {
        setUrlOrId('');
        setSpreadsheetInfo(null);
        setSelectedSheet('');
        setStep('url');
        setError(null);
    };

    const handleClose = () => {
        handleReset();
        onClose();
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-slate-900 border border-white/10 rounded-xl shadow-2xl w-[480px] max-h-[80vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-green-400" />
                        <h2 className="text-sm font-semibold text-slate-100">Google Sheets</h2>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleClose} className="h-6 w-6 text-slate-400 hover:text-white">
                        <X className="h-3.5 w-3.5" />
                    </Button>
                </div>

                <div className="p-5 space-y-4">
                    {!available ? (
                        /* No Client ID configured */
                        <div className="text-center py-4">
                            <FileSpreadsheet className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                            <p className="text-sm text-slate-300 mb-2">Google Sheets not configured</p>
                            <p className="text-xs text-slate-500 mb-4 max-w-[350px] mx-auto">
                                To enable Google Sheets import, add your Google OAuth Client ID to the environment variables.
                            </p>
                            <div className="bg-white/5 rounded-lg p-3 text-left">
                                <p className="text-[10px] text-slate-500 mb-1">Add to your .env file:</p>
                                <code className="text-xs text-green-400 font-mono">
                                    VITE_GOOGLE_CLIENT_ID=your_client_id_here
                                </code>
                            </div>
                            <a
                                href="https://console.cloud.google.com/apis/credentials"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-3"
                            >
                                Get a Client ID from Google Cloud Console
                                <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>
                    ) : step === 'url' ? (
                        /* Step 1: Enter URL/ID */
                        <>
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Spreadsheet URL or ID</label>
                                <Input
                                    value={urlOrId}
                                    onChange={e => { setUrlOrId(e.target.value); setError(null); }}
                                    placeholder="https://docs.google.com/spreadsheets/d/..."
                                    className="h-9 bg-white/5 border-white/10 text-sm font-mono"
                                    onKeyDown={e => e.key === 'Enter' && handleConnect()}
                                />
                                <p className="text-[10px] text-slate-500 mt-1">
                                    Paste a Google Sheets URL or the spreadsheet ID
                                </p>
                            </div>

                            <div className="bg-white/5 rounded-lg p-3">
                                <p className="text-[10px] text-slate-400 font-medium mb-2">How it works:</p>
                                <ol className="text-[10px] text-slate-500 space-y-1 list-decimal list-inside">
                                    <li>Paste your Google Sheets URL above</li>
                                    <li>Sign in with Google to grant read-only access</li>
                                    <li>Select which sheet to import</li>
                                    <li>Data loads into OpenViz for visualization</li>
                                </ol>
                            </div>
                        </>
                    ) : (
                        /* Step 2: Select sheet */
                        <>
                            {/* Connected spreadsheet info */}
                            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <FileSpreadsheet className="w-3.5 h-3.5 text-green-400" />
                                    <span className="text-xs font-medium text-green-300 truncate">
                                        {spreadsheetInfo?.title}
                                    </span>
                                </div>
                                <p className="text-[10px] text-green-400/60">
                                    {spreadsheetInfo?.sheets.length} sheet{spreadsheetInfo?.sheets.length !== 1 ? 's' : ''} available
                                </p>
                            </div>

                            {/* Sheet selector */}
                            <div>
                                <label className="text-xs text-slate-400 mb-1.5 block">Select Sheet</label>
                                <div className="space-y-1.5">
                                    {spreadsheetInfo?.sheets.map(sheet => (
                                        <button
                                            key={sheet.sheetId}
                                            onClick={() => setSelectedSheet(sheet.title)}
                                            className={cn(
                                                "w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-colors text-left",
                                                selectedSheet === sheet.title
                                                    ? "bg-green-500/15 border-green-500/30 text-green-200"
                                                    : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/15"
                                            )}
                                        >
                                            <span className="text-xs font-medium truncate">{sheet.title}</span>
                                            <span className="text-[10px] text-slate-500 ml-2 shrink-0">
                                                {sheet.rowCount > 0 ? `~${sheet.rowCount} rows` : ''}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Back button */}
                            <button
                                onClick={handleReset}
                                className="text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1"
                            >
                                <RefreshCw className="w-3 h-3" />
                                Use a different spreadsheet
                            </button>
                        </>
                    )}

                    {/* Error Display */}
                    {error && (
                        <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-300">
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {available && (
                    <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/10">
                        <Button variant="ghost" size="sm" onClick={handleClose} className="text-xs text-slate-400">
                            Cancel
                        </Button>
                        {step === 'url' ? (
                            <Button
                                size="sm"
                                onClick={handleConnect}
                                disabled={!urlOrId.trim() || isConnecting}
                                className="text-xs bg-green-600 hover:bg-green-700 text-white"
                            >
                                {isConnecting ? (
                                    <>
                                        <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                                        Connecting...
                                    </>
                                ) : (
                                    <>
                                        <FileSpreadsheet className="w-3 h-3 mr-1.5" />
                                        Connect
                                    </>
                                )}
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                onClick={handleImport}
                                disabled={!selectedSheet || isImporting}
                                className="text-xs bg-green-600 hover:bg-green-700 text-white"
                            >
                                {isImporting ? (
                                    <>
                                        <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                                        Importing...
                                    </>
                                ) : (
                                    <>
                                        <FileSpreadsheet className="w-3 h-3 mr-1.5" />
                                        Import Sheet
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
