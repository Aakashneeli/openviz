// ============================================
// TopBar - OpenViz Header (Clean)
// ============================================

import { useRef } from 'react';
import { Upload, BarChart2, Undo2, Redo2, Download, Command } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVizStore, selectUploadStatus, selectDataset } from '@/store/useVizStore';
import { cn } from '@/lib/utils';

export function TopBar() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { loadDataFromFile, undo, redo, canUndo, canRedo } = useVizStore();
    const uploadStatus = useVizStore(selectUploadStatus);
    const dataset = useVizStore(selectDataset);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            await loadDataFromFile(file);
        }
        e.target.value = '';
    };

    const isLoading = uploadStatus.state === 'uploading' || uploadStatus.state === 'processing';

    return (
        <header className="h-14 border-b border-border bg-background/80 backdrop-blur-md flex items-center justify-between px-4 z-50">
            {/* Left: Brand & History */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 text-white shadow-lg shadow-primary/25">
                        <BarChart2 className="h-5 w-5" />
                    </div>
                    <span className="font-semibold text-lg tracking-tight text-foreground/90">
                        OpenViz
                    </span>
                </div>

                {/* Vertical Divider */}
                <div className="h-6 w-px bg-border/50 mx-2" />

                {/* History Controls */}
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={undo}
                        disabled={!canUndo()}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        title="Undo (Ctrl+Z)"
                    >
                        <Undo2 className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={redo}
                        disabled={!canRedo()}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        title="Redo (Ctrl+Y)"
                    >
                        <Redo2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Center - Dataset Info */}
            {dataset && (
                <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/30 border border-border/50 text-xs text-muted-foreground backdrop-blur-sm shadow-sm max-w-md">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                    <span className="font-medium text-foreground truncate max-w-[150px]">{dataset.name}</span>
                    <span className="text-border">•</span>
                    <span>{dataset.rowCount.toLocaleString()} rows</span>
                    <span className="text-border">•</span>
                    <span>{dataset.fields.length} fields</span>
                </div>
            )}

            {/* Right Actions */}
            <div className="flex items-center gap-3">
                {/* Export (Placeholder for now) */}
                <Button variant="ghost" size="sm" className="hidden sm:flex text-muted-foreground hover:text-foreground gap-2 h-8">
                    <Download className="h-4 w-4" />
                    <span className="text-xs">Export</span>
                </Button>

                {/* CMD+K Hint */}
                <div className="hidden md:flex items-center gap-1 px-2 py-1 bg-secondary/50 rounded border border-border/50 text-[10px] text-muted-foreground mr-2">
                    <Command className="h-3 w-3" />
                    <span>K</span>
                </div>

                <div className="h-6 w-px bg-border/50" />

                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.json,.tsv"
                    onChange={handleFileSelect}
                    className="hidden"
                />

                <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className={cn(
                        "bg-primary hover:bg-primary/90 text-primary-foreground border-0 shadow-lg shadow-primary/20 transition-all",
                        isLoading && "opacity-80"
                    )}
                    size="sm"
                >
                    <Upload className="h-4 w-4 mr-2" />
                    {isLoading ? 'Processing...' : 'Upload Data'}
                </Button>
            </div>
        </header>
    );
}
