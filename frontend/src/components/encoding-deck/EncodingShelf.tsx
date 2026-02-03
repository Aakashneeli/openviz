import { useDroppable } from '@dnd-kit/core';
import { X } from 'lucide-react'; // Added icon for nested feel
import { Button } from '@/components/ui/button';
import { useVizStore, selectEncodingByChannel } from '@/store/useVizStore';
import { cn } from '@/lib/utils';
import type { EncodingChannel } from '@backend/types';
import { motion, AnimatePresence } from 'framer-motion';

interface EncodingShelfProps {
    channel: EncodingChannel;
    label: string;
}

export function EncodingShelf({ channel, label }: EncodingShelfProps) {
    const encoding = useVizStore(selectEncodingByChannel(channel));
    const { removeFromShelf } = useVizStore();
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
                <span className={cn(
                    "text-[10px] font-medium transition-colors uppercase tracking-wider",
                    isOver ? "text-indigo-300 font-bold" : "text-muted-foreground/60"
                )}>
                    {label}
                </span>
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

                            {encoding.aggregate && (
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
