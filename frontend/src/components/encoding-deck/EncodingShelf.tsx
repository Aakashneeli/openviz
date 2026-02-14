import { useDroppable } from '@dnd-kit/core';
import { X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useVizStore, selectEncodingByChannel } from '@/store/useVizStore';
import { cn } from '@/lib/utils';
import type { EncodingChannel, AggregateFunction } from '@backend/types';
import { motion, AnimatePresence } from 'framer-motion';

const AGGREGATION_OPTIONS: { value: AggregateFunction | undefined; label: string; group: 'basic' | 'advanced' }[] = [
    { value: undefined, label: 'None', group: 'basic' },
    { value: 'sum', label: 'Sum', group: 'basic' },
    { value: 'mean', label: 'Mean', group: 'basic' },
    { value: 'count', label: 'Count', group: 'basic' },
    { value: 'min', label: 'Min', group: 'basic' },
    { value: 'max', label: 'Max', group: 'basic' },
    { value: 'median', label: 'Median', group: 'basic' },
    { value: 'distinct', label: 'Distinct', group: 'basic' },
    { value: 'variance', label: 'Variance', group: 'advanced' },
    { value: 'stddev', label: 'Std Dev', group: 'advanced' },
    { value: 'percent_of_total', label: '% of Total', group: 'advanced' },
    { value: 'cumulative_sum', label: 'Cumulative Sum', group: 'advanced' },
];

// Descriptions for encoding channels
const CHANNEL_DESCRIPTIONS: Record<EncodingChannel, string> = {
    x: 'Horizontal position - typically categories or time',
    y: 'Vertical position - typically measures or values',
    color: 'Color encoding - distinguish categories or show intensity',
    size: 'Size encoding - show magnitude differences',
    shape: 'Shape encoding - distinguish categories (scatter only)',
    theta: 'Angle encoding - for pie/donut chart values',
    tooltip: 'Tooltip content - shown on hover',
    row: 'Row facets - split chart into horizontal rows',
    column: 'Column facets - split chart into vertical columns',
};

interface EncodingShelfProps {
    channel: EncodingChannel;
    label: string;
}

export function EncodingShelf({ channel, label }: EncodingShelfProps) {
    const encoding = useVizStore(selectEncodingByChannel(channel));
    const { removeFromShelf, updateShelfConfig } = useVizStore();
    const isDragging = useVizStore((s) => s.isDragging);
    const { isOver, setNodeRef } = useDroppable({ id: channel });

    // Magnetic Animation Variants
    const variants = {
        idle: { scale: 1, borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.02)" },
        dragging: { scale: 1, borderColor: "rgba(99,102,241,0.3)", backgroundColor: "rgba(99,102,241,0.05)" },
        hover: { scale: 1.02, borderColor: "#818cf8", backgroundColor: "rgba(99,102,241,0.15)", boxShadow: "0 0 15px rgba(99,102,241,0.2)" },
        filled: { scale: 1, borderColor: "transparent", backgroundColor: "rgba(255,255,255,0.05)" }
    };

    return (
        <div className="group/shelf flex items-start justify-between gap-2 py-1">
            <div className="w-20 shrink-0 pt-2 flex items-center gap-1">
                <div className={cn("w-1 h-1 rounded-full bg-muted-foreground/30 transition-colors", encoding && "bg-indigo-400 shadow-[0_0_5px_rgba(99,102,241,0.5)]")} />
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span className={cn(
                            "text-[10px] font-medium transition-colors uppercase tracking-wider cursor-help",
                            isOver ? "text-indigo-300 font-bold" : "text-muted-foreground/60"
                        )}>
                            {label}
                        </span>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-[200px]">
                        <p className="text-xs">{CHANNEL_DESCRIPTIONS[channel]}</p>
                    </TooltipContent>
                </Tooltip>
            </div>

            <motion.div
                ref={setNodeRef}
                initial="idle"
                animate={encoding ? "filled" : isOver ? "hover" : isDragging ? "dragging" : "idle"}
                variants={variants}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className={cn(
                    "relative flex-1 min-h-[32px] rounded-lg border flex items-center px-3 overflow-hidden",
                )}
            >
                <AnimatePresence mode='wait'>
                    {!encoding ? (
                        <motion.span
                            key="empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className={cn(
                                "text-[10px] transition-colors truncate italic",
                                isDragging ? (isOver ? "text-indigo-300" : "text-indigo-400/40") : "text-muted-foreground/20"
                            )}
                        >
                            {isDragging ? (isOver ? "Drop to map" : "Drag here...") : "Empty"}
                        </motion.span>
                    ) : (
                        <motion.div
                            key="filled"
                            initial={{ x: 10, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            className="flex items-center w-full gap-2 min-w-0"
                        >
                            <span className="flex-1 text-[11px] font-medium text-slate-200 truncate">
                                {encoding.field.name}
                            </span>

                            {/* Aggregation dropdown - show for quantitative fields on y/size/color channels */}
                            {encoding.field.type === 'quantitative' && ['x', 'y', 'size', 'color', 'theta'].includes(channel) && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button className={cn(
                                            "flex items-center gap-0.5 px-1.5 py-0.5 rounded-[4px] text-[9px] uppercase font-bold tracking-wider border transition-colors",
                                            encoding.aggregate
                                                ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/30"
                                                : "bg-white/5 text-slate-500 border-white/10 hover:bg-white/10 hover:text-slate-300"
                                        )}>
                                            {encoding.aggregate || 'agg'}
                                            <ChevronDown className="w-2 h-2" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-36">
                                        <DropdownMenuLabel className="text-[10px] text-muted-foreground">Basic</DropdownMenuLabel>
                                        {AGGREGATION_OPTIONS.filter(o => o.group === 'basic').map(opt => (
                                            <DropdownMenuItem
                                                key={opt.label}
                                                onClick={() => updateShelfConfig(channel, { aggregate: opt.value })}
                                                className={cn("text-xs", encoding.aggregate === opt.value && "text-indigo-400 font-semibold")}
                                            >
                                                {opt.label}
                                            </DropdownMenuItem>
                                        ))}
                                        <DropdownMenuSeparator />
                                        <DropdownMenuLabel className="text-[10px] text-muted-foreground">Advanced</DropdownMenuLabel>
                                        {AGGREGATION_OPTIONS.filter(o => o.group === 'advanced').map(opt => (
                                            <DropdownMenuItem
                                                key={opt.label}
                                                onClick={() => updateShelfConfig(channel, { aggregate: opt.value })}
                                                className={cn("text-xs", encoding.aggregate === opt.value && "text-indigo-400 font-semibold")}
                                            >
                                                {opt.label}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                            {/* Show static badge for non-quantitative fields with an aggregate */}
                            {encoding.aggregate && (encoding.field.type !== 'quantitative' || !['x', 'y', 'size', 'color', 'theta'].includes(channel)) && (
                                <span className="px-1.5 py-0.5 rounded-[4px] bg-indigo-500/20 text-[9px] text-indigo-300 uppercase font-bold tracking-wider border border-indigo-500/30">
                                    {encoding.aggregate}
                                </span>
                            )}

                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeFromShelf(channel)}
                                className="h-4 w-4 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-full ml-1"
                            >
                                <X className="w-3 h-3" />
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}
