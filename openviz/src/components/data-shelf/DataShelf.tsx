// ============================================
// DataShelf - DataViz Studio Sidebar
// ============================================

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { DraggableField } from './DraggableField';
import { useVizStore, selectFields, selectDataset } from '@/store/useVizStore';

export function DataShelf() {
    const [searchQuery, setSearchQuery] = useState('');
    const dataset = useVizStore(selectDataset);
    const fields = useVizStore(selectFields);

    const filteredFields = useMemo(() => {
        return fields.filter(f =>
            f.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [fields, searchQuery]);

    if (!dataset) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center text-muted-foreground">
                <p className="font-serif italic text-xl text-white/20 mb-2">No Data</p>
                <p className="text-xs text-white/20">Import a dataset to begin</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background border-r border-border">
            <div className="p-6 pb-2">
                <h2 className="font-serif text-2xl font-bold text-foreground mb-1">Data Fields</h2>
                <p className="text-xs text-muted-foreground mb-6">Drag fields to encode your chart</p>

                {/* Legend */}
                <div className="grid grid-cols-2 gap-2 mb-6">
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <div className="w-2 h-2 rounded-sm bg-[hsl(var(--field-q))]" /> QUANTITATIVE
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <div className="w-2 h-2 rounded-sm bg-[hsl(var(--field-n))]" /> NOMINAL
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <div className="w-2 h-2 rounded-sm bg-[hsl(var(--field-o))]" /> ORDINAL
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <div className="w-2 h-2 rounded-sm bg-[hsl(var(--field-t))]" /> TEMPORAL
                    </div>
                </div>

                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-9 pl-9 bg-secondary/50 border-input text-sm text-foreground focus-visible:ring-primary/50 placeholder:text-muted-foreground/50 transition-all focus:bg-secondary"
                        placeholder="Search fields..."
                    />
                </div>
            </div>

            <ScrollArea className="flex-1 px-6 pb-6">
                <div className="space-y-2">
                    {filteredFields.map(field => (
                        <DraggableField key={field.id} field={field} />
                    ))}
                </div>

                <div className="mt-6 pt-4 border-t border-border text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
                        {filteredFields.length} Fields Available
                    </p>
                </div>
            </ScrollArea>
        </div>
    );
}
