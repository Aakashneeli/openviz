// ============================================
// EncodingDeck - DataViz Studio Channels
// ============================================

import { X, ArrowUp, Zap, Grid, Layers } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { EncodingShelf } from './EncodingShelf';
import { useVizStore, selectChartConfig } from '@/store/useVizStore';

export function EncodingDeck() {
    const { clearAllShelves } = useVizStore();

    return (
        <div className="flex flex-col h-full bg-[#09090b] border-r border-white/5">
            <div className="p-6 pb-2">
                <div className="flex items-center justify-between mb-1">
                    <h2 className="font-serif text-2xl font-bold text-white">Encoding Channels</h2>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAllShelves}
                        className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20"
                    >
                        <X className="w-3 h-3 mr-1" /> Clear
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-6">Map data to visual properties</p>
            </div>

            <ScrollArea className="flex-1 px-6 pb-6">
                <div className="space-y-8">

                    {/* Position Group */}
                    <div>
                        <div className="flex items-center gap-2 mb-4 text-xs font-bold text-primary tracking-widest uppercase">
                            <ArrowUp className="w-3.5 h-3.5" />
                            Position
                        </div>
                        <div className="space-y-3">
                            <EncodingShelf channel="x" label="X Axis" />
                            <EncodingShelf channel="y" label="Y Axis" />
                        </div>
                    </div>

                    {/* Mark Group */}
                    <div>
                        <div className="flex items-center gap-2 mb-4 text-xs font-bold text-primary tracking-widest uppercase">
                            <Zap className="w-3.5 h-3.5" />
                            Mark Properties
                        </div>
                        <div className="space-y-3">
                            <EncodingShelf channel="color" label="Color" />
                            <EncodingShelf channel="size" label="Size" />
                            <EncodingShelf channel="shape" label="Shape" />
                        </div>
                    </div>

                    {/* Facet Group */}
                    <div>
                        <div className="flex items-center gap-2 mb-4 text-xs font-bold text-primary tracking-widest uppercase">
                            <Grid className="w-3.5 h-3.5" />
                            Faceting
                        </div>
                        <div className="space-y-3">
                            <EncodingShelf channel="row" label="Row" />
                            <EncodingShelf channel="column" label="Column" />
                        </div>
                    </div>

                </div>
            </ScrollArea>
        </div>
    );
}
