// ============================================
// URLImportDialog - Import data from URL/API
// ============================================

import { useState } from 'react';
import { X, Globe, Loader2, Plus, Trash2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useVizStore } from '@/store/useVizStore';
import { fetchDataFromURL } from '@/services/urlDataService';
import type { URLImportOptions } from '@/services/urlDataService';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

interface URLImportDialogProps {
    open: boolean;
    onClose: () => void;
}

export function URLImportDialog({ open, onClose }: URLImportDialogProps) {
    const loadDataFromFile = useVizStore(state => state.loadDataFromFile);
    const setDataSource = useVizStore(state => state.setDataSource);

    const [url, setUrl] = useState('');
    const [format, setFormat] = useState<'auto' | 'json' | 'csv'>('auto');
    const [jsonPath, setJsonPath] = useState('');
    const [headers, setHeaders] = useState<Array<{ key: string; value: string }>>([]);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const addHeader = () => {
        setHeaders(prev => [...prev, { key: '', value: '' }]);
    };

    const updateHeader = (index: number, field: 'key' | 'value', val: string) => {
        setHeaders(prev => prev.map((h, i) => i === index ? { ...h, [field]: val } : h));
    };

    const removeHeader = (index: number) => {
        setHeaders(prev => prev.filter((_, i) => i !== index));
    };

    const handleImport = async () => {
        if (!url.trim()) return;

        setIsLoading(true);
        setError(null);

        try {
            const options: URLImportOptions = {
                url: url.trim(),
                format,
                jsonPath: jsonPath.trim() || undefined,
                headers: headers.reduce((acc, h) => {
                    if (h.key.trim()) acc[h.key.trim()] = h.value;
                    return acc;
                }, {} as Record<string, string>),
            };

            const result = await fetchDataFromURL(options);

            // Create a File-like blob to reuse existing loadDataFromFile logic
            let content: string;
            if (result.format === 'json') {
                content = JSON.stringify(result.data);
            } else {
                // Convert back to CSV
                const Papa = await import('papaparse');
                content = Papa.default.unparse(result.data);
            }

            const blob = new Blob([content], {
                type: result.format === 'json' ? 'application/json' : 'text/csv'
            });
            const file = new File([blob], `${result.name}.${result.format}`, {
                type: blob.type,
            });

            await loadDataFromFile(file);

            // Store data source for refresh capability
            setDataSource({
                type: 'url',
                url: url.trim(),
                lastFetchedAt: new Date(),
            });

            toast.success('Data imported from URL', {
                description: `${result.rowCount.toLocaleString()} rows loaded from ${result.name}`,
            });

            // Reset and close
            setUrl('');
            setJsonPath('');
            setHeaders([]);
            setError(null);
            onClose();
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to fetch data';
            setError(msg);
            toast.error('Import failed', { description: msg });
        } finally {
            setIsLoading(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-slate-900 border border-white/10 rounded-xl shadow-2xl w-[480px] max-h-[80vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-cyan-400" />
                        <h2 className="text-sm font-semibold text-slate-100">Import from URL</h2>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-6 w-6 text-slate-400 hover:text-white">
                        <X className="h-3.5 w-3.5" />
                    </Button>
                </div>

                <div className="p-5 space-y-4">
                    {/* URL Input */}
                    <div>
                        <label className="text-xs text-slate-400 mb-1 block">Data URL</label>
                        <Input
                            value={url}
                            onChange={e => { setUrl(e.target.value); setError(null); }}
                            placeholder="https://api.example.com/data.json"
                            className="h-9 bg-white/5 border-white/10 text-sm font-mono"
                            onKeyDown={e => e.key === 'Enter' && handleImport()}
                        />
                        <p className="text-[10px] text-slate-500 mt-1">
                            Supports JSON and CSV URLs. CORS must be enabled on the server.
                        </p>
                    </div>

                    {/* Format Selector */}
                    <div>
                        <label className="text-xs text-slate-400 mb-1.5 block">Format</label>
                        <div className="flex gap-2">
                            {(['auto', 'json', 'csv'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFormat(f)}
                                    className={cn(
                                        "px-3 py-1 rounded text-xs border transition-colors",
                                        format === f
                                            ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
                                            : "bg-white/5 border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/10"
                                    )}
                                >
                                    {f === 'auto' ? 'Auto-detect' : f.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Advanced Options Toggle */}
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                    >
                        <ChevronDown className={cn("w-3 h-3 transition-transform", showAdvanced && "rotate-180")} />
                        Advanced Options
                    </button>

                    {showAdvanced && (
                        <div className="space-y-3 pl-2 border-l-2 border-white/5">
                            {/* JSON Path */}
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">JSON Path (optional)</label>
                                <Input
                                    value={jsonPath}
                                    onChange={e => setJsonPath(e.target.value)}
                                    placeholder="e.g., data.results"
                                    className="h-8 bg-white/5 border-white/10 text-xs font-mono"
                                />
                                <p className="text-[10px] text-slate-500 mt-1">
                                    Dot-separated path to the data array in JSON response
                                </p>
                            </div>

                            {/* Custom Headers */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs text-slate-400">Request Headers</label>
                                    <Button variant="ghost" size="sm" onClick={addHeader} className="h-5 text-[10px] text-cyan-400 hover:text-cyan-300 px-1.5">
                                        <Plus className="w-2.5 h-2.5 mr-1" />
                                        Add Header
                                    </Button>
                                </div>
                                {headers.length === 0 && (
                                    <p className="text-[10px] text-slate-500">No custom headers. Add headers for authenticated APIs.</p>
                                )}
                                <div className="space-y-1.5">
                                    {headers.map((header, idx) => (
                                        <div key={idx} className="flex items-center gap-1.5">
                                            <Input
                                                value={header.key}
                                                onChange={e => updateHeader(idx, 'key', e.target.value)}
                                                placeholder="Header name"
                                                className="h-7 bg-white/5 border-white/10 text-[10px] font-mono flex-1"
                                            />
                                            <Input
                                                value={header.value}
                                                onChange={e => updateHeader(idx, 'value', e.target.value)}
                                                placeholder="Value"
                                                className="h-7 bg-white/5 border-white/10 text-[10px] font-mono flex-1"
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeHeader(idx)}
                                                className="h-6 w-6 text-red-400 hover:text-red-300 flex-shrink-0"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Error Display */}
                    {error && (
                        <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-300">
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/10">
                    <Button variant="ghost" size="sm" onClick={onClose} className="text-xs text-slate-400">
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleImport}
                        disabled={!url.trim() || isLoading}
                        className="text-xs bg-cyan-600 hover:bg-cyan-700 text-white"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                                Fetching...
                            </>
                        ) : (
                            <>
                                <Globe className="w-3 h-3 mr-1.5" />
                                Import Data
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
