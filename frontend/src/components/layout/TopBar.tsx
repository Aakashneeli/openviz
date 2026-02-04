// ============================================
// TopBar - OpenViz Header (Clean)
// ============================================

import { useRef } from 'react';
import { Upload, BarChart2, Undo2, Redo2, Command } from 'lucide-react';
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
        <header className="h-10 border-b border-border bg-background flex items-center justify-between px-3 select-none">
            {/* Left: Brand & History */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center h-5 w-5 rounded bg-primary text-primary-foreground shadow-sm">
                        <BarChart2 className="h-3 w-3" />
                    </div>
                    <span className="font-semibold text-sm tracking-tight text-foreground">
                        OpenViz
                    </span>
                </div>

                {/* Divider */}
                <div className="h-4 w-px bg-border mx-1" />

                {/* History Controls */}
                <div className="flex items-center gap-0.5">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={undo}
                        disabled={!canUndo()}
                        className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-30 rounded-sm"
                        title="Undo (Ctrl+Z)"
                    >
                        <Undo2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={redo}
                        disabled={!canRedo()}
                        className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-30 rounded-sm"
                        title="Redo (Ctrl+Y)"
                    >
                        <Redo2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* Center - Dataset Info (Status Bar Style) */}
            {dataset && (
                <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-muted/30 rounded border border-border/40 text-[11px] text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="font-medium text-foreground truncate max-w-[200px]">{dataset.name}</span>
                    <span className="text-border opacity-50">|</span>
                    <span>{dataset.rowCount.toLocaleString()} rows</span>
                    <span className="text-border opacity-50">|</span>
                    <span>{dataset.fields.length} fields</span>
                </div>
            )}

            {/* Right Actions */}
            <div className="flex items-center gap-2">
                {/* CMD+K Hint */}
                <div className="hidden md:flex items-center gap-1 px-1.5 py-0.5 bg-muted rounded border border-border text-[10px] text-muted-foreground mr-1">
                    <Command className="h-3 w-3" />
                    <span>K</span>
                </div>

                <div className="h-4 w-px bg-border mx-1" />

                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.json,.tsv,.xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                />

                <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    variant="secondary"
                    className={cn(
                        "h-7 text-xs gap-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border transition-all",
                        isLoading && "opacity-80"
                    )}
                    size="sm"
                >
                    <Upload className="h-3.5 w-3.5" />
                    {isLoading ? 'Loading...' : 'Import Data'}
                </Button>
            </div>
        </header>
    );
}
