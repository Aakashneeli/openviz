// ============================================
// EncodingDeck - DataViz Studio Channels
// ============================================

import { ArrowUp, Zap, Grid, Eraser, LayoutGrid, Database } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { EncodingShelf } from './EncodingShelf';
import { ChartTypeSelector } from './ChartTypeSelector';
import { useVizStore, selectDataset } from '@/store/useVizStore';

export function EncodingDeck() {
    const dataset = useVizStore(selectDataset);
    const { clearAllShelves } = useVizStore();

    // Show helpful message when no data is loaded
    if (!dataset) {
        return (
            <div className="flex flex-col h-full bg-transparent">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/20">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Visual Mapping
                    </span>
                </div>
                <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
                    <div className="w-14 h-14 mb-4 rounded-xl bg-muted/20 border border-dashed border-muted-foreground/20 flex items-center justify-center">
                        <Database className="w-6 h-6 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm text-muted-foreground/80 mb-2">No Data Loaded</p>
                    <p className="text-xs text-muted-foreground/50 max-w-[200px]">
                        Upload a dataset from the left panel to start mapping fields to chart channels.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-transparent">
            {/* Header - Property Inspector Style */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/20">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Visual Mapping
                </span>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearAllShelves}
                    className="h-5 w-5 text-muted-foreground hover:text-foreground rounded-sm"
                    title="Clear All"
                >
                    <Eraser className="w-3 h-3" />
                </Button>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-0">
                    {/* Chart Type Group */}
                    <div className="border-b border-border">
                        <div className="px-3 py-1.5 bg-muted/10 border-b border-border/50 flex items-center gap-2">
                            <LayoutGrid className="w-3 h-3 text-muted-foreground" />
                            <span className="text-[10px] font-bold text-foreground uppercase tracking-wide">Chart Type</span>
                        </div>
                        <div className="p-2">
                            <ChartTypeSelector />
                        </div>
                    </div>

                    {/* Position Group */}
                    <div className="border-b border-border">
                        <div className="px-3 py-1.5 bg-muted/10 border-b border-border/50 flex items-center gap-2">
                            <ArrowUp className="w-3 h-3 text-muted-foreground" />
                            <span className="text-[10px] font-bold text-foreground uppercase tracking-wide">Position</span>
                        </div>
                        <div className="p-2 space-y-1">
                            <EncodingShelf channel="x" label="X Axis" />
                            <EncodingShelf channel="y" label="Y Axis" />
                        </div>
                    </div>

                    {/* Mark Group */}
                    <div className="border-b border-border">
                        <div className="px-3 py-1.5 bg-muted/10 border-b border-border/50 flex items-center gap-2">
                            <Zap className="w-3 h-3 text-muted-foreground" />
                            <span className="text-[10px] font-bold text-foreground uppercase tracking-wide">Mark</span>
                        </div>
                        <div className="p-2 space-y-1">
                            <EncodingShelf channel="color" label="Color" />
                            <EncodingShelf channel="size" label="Size" />
                            <EncodingShelf channel="shape" label="Shape" />
                        </div>
                    </div>

                    {/* Facet Group */}
                    <div>
                        <div className="px-3 py-1.5 bg-muted/10 border-b border-border/50 flex items-center gap-2">
                            <Grid className="w-3 h-3 text-muted-foreground" />
                            <span className="text-[10px] font-bold text-foreground uppercase tracking-wide">Facets</span>
                        </div>
                        <div className="p-2 space-y-1">
                            <EncodingShelf channel="row" label="Row" />
                            <EncodingShelf channel="column" label="Column" />
                        </div>
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}

