// ============================================
// EncodingShelf - DataViz Studio Drop Zone
// ============================================

import { useDroppable } from '@dnd-kit/core';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVizStore, selectEncodingByChannel } from '@/store/useVizStore';
import { cn } from '@/lib/utils';
import type { EncodingChannel, FieldType } from '@/types';

interface EncodingShelfProps {
    channel: EncodingChannel;
    label: string;
}

const typeConfig: Record<FieldType, { label: string; style: string }> = {
    quantitative: { label: '#', style: 'bg-[hsl(var(--field-q))] shadow-[0_0_10px_hsl(var(--field-q)/0.4)]' },
    nominal: { label: 'A', style: 'bg-[hsl(var(--field-n))] shadow-[0_0_10px_hsl(var(--field-n)/0.4)]' },
    temporal: { label: 'T', style: 'bg-[hsl(var(--field-t))] shadow-[0_0_10px_hsl(var(--field-t)/0.4)]' },
    ordinal: { label: 'O', style: 'bg-[hsl(var(--field-o))] shadow-[0_0_10px_hsl(var(--field-o)/0.4)]' },
};

export function EncodingShelf({ channel, label }: EncodingShelfProps) {
    const encoding = useVizStore(selectEncodingByChannel(channel));
    const { removeFromShelf } = useVizStore();
    const isDragging = useVizStore((s) => s.isDragging);
    const { isOver, setNodeRef } = useDroppable({ id: channel });

    return (
        <div className="group/shelf">
            <div className="flex items-center justify-between mb-1.5 px-0.5">
                <span className={cn(
                    "text-[10px] font-bold uppercase tracking-wider transition-colors",
                    encoding ? "text-foreground" : "text-muted-foreground",
                    isOver && "text-primary"
                )}>
                    {label}
                </span>
            </div>

            <div
                ref={setNodeRef}
                className={cn(
                    "relative min-h-[44px] rounded-lg border transition-all duration-300 flex items-center px-3 overflow-hidden",
                    // Empty state
                    !encoding && "border-dashed border-border bg-card/10 hover:border-primary/30 hover:bg-primary/5",
                    !encoding && isDragging && "border-primary/40 bg-primary/5 shadow-[0_0_15px_-5px_hsl(var(--primary)/0.3)]",
                    !encoding && isOver && "border-primary bg-primary/10 shadow-[0_0_20px_hsl(var(--primary)/0.2)] scale-[1.02]",
                    // Filled state
                    encoding && "border-border bg-card/40 backdrop-blur-sm group-hover/shelf:border-border/80"
                )}
            >
                {!encoding ? (
                    <span className={cn(
                        "text-xs transition-colors duration-200",
                        isDragging ? (isOver ? "text-primary font-medium" : "text-primary/70") : "text-muted-foreground/40 group-hover/shelf:text-muted-foreground/60"
                    )}>
                        {isDragging ? (isOver ? "Drop to encode" : "Drop here") : "Empty"}
                    </span>
                ) : (
                    <div className="flex items-center w-full gap-3 group animate-in fade-in zoom-in-95 duration-200">
                        {/* Field Badge */}
                        <div className={cn(
                            "flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold text-white shadow-sm ring-1 ring-white/10",
                            typeConfig[encoding.field.type].style
                        )}>
                            {typeConfig[encoding.field.type].label}
                        </div>

                        {/* Field Name */}
                        <div className="flex-1 flex flex-col min-w-0">
                            <span className="text-sm font-medium text-foreground truncate leading-tight">
                                {encoding.field.name}
                            </span>
                            {/* Aggregation indicator if needed */}
                            {encoding.aggregate && (
                                <span className="text-[9px] text-muted-foreground uppercase font-semibold">
                                    {encoding.aggregate}
                                </span>
                            )}
                        </div>

                        {/* Remove Button */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFromShelf(channel)}
                            className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mr-1 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0"
                        >
                            <X className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                )}

                {/* Active Indicator Line */}
                {encoding && (
                    <div className={cn(
                        "absolute left-0 top-0 bottom-0 w-1",
                        typeConfig[encoding.field.type].style.split(' ')[0] // use bg color
                    )} />
                )}
            </div>
        </div>
    );
}
