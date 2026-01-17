// ============================================
// AppLayout - Luminous Flow Architecture
// ============================================

import { DndContext, DragOverlay, closestCenter, defaultDropAnimationSideEffects } from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent, DropAnimation } from '@dnd-kit/core';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, LayoutTemplate } from 'lucide-react';
import { DataShelf } from '@/components/data-shelf/DataShelf';
import { EncodingDeck } from '@/components/encoding-deck/EncodingDeck';
import { Canvas } from '@/components/canvas/Canvas';
import { CommandBar } from '@/components/layout/CommandBar';
import { DraggableField } from '@/components/data-shelf/DraggableField';
import { AIChat } from '@/components/ai/AIChat';
import { useVizStore } from '@/store/useVizStore';
import { Button } from '@/components/ui/button';
import type { FieldInfo, EncodingChannel } from '@backend/types';

const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
        styles: { active: { opacity: '0.6', scale: '1.05' } },
    }),
};

export function AppLayout() {
    const [activeField, setActiveField] = useState<FieldInfo | null>(null);
    const [leftOpen, setLeftOpen] = useState(true);
    const [rightOpen, setRightOpen] = useState(true);
    const { addToShelf, setDragging } = useVizStore();

    const handleDragStart = (event: DragStartEvent) => {
        const fieldData = event.active.data.current?.field as FieldInfo | undefined;
        if (fieldData) {
            setActiveField(fieldData);
            setDragging(true);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveField(null);
        setDragging(false);

        if (over && active.data.current?.field) {
            const field = active.data.current.field as FieldInfo;
            const channel = over.id as EncodingChannel;
            const validChannels: EncodingChannel[] = ['x', 'y', 'color', 'size', 'shape', 'row', 'column'];

            if (validChannels.includes(channel)) {
                addToShelf(field, channel);
            }
        }
    };

    const handleDragCancel = () => {
        setActiveField(null);
        setDragging(false);
    };

    return (
        <DndContext
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
        >
            <div className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden font-sans selection:bg-purple-500/30">
                {/* Command Bar Layer */}
                <div className="relative z-20 shrink-0">
                    <CommandBar />
                </div>

                {/* Floating Dock Grid */}
                <div className="relative z-10 flex-1 p-3 pt-0 flex gap-3 overflow-hidden">

                    {/* LEFT DOCK: Explorer */}
                    <AnimatePresence mode='wait' initial={false}>
                        {leftOpen && (
                            <motion.aside
                                initial={{ width: 0, opacity: 0 }}
                                animate={{ width: 280, opacity: 1 }}
                                exit={{ width: 0, opacity: 0 }}
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                className="h-full shrink-0"
                            >
                                <div className="h-full w-[280px] rounded-xl glass-panel flex flex-col overflow-hidden relative group border-border">
                                    <div className="h-10 shrink-0 px-4 flex items-center justify-between border-b border-white/5">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Data Explorer</span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setLeftOpen(false)}
                                            className="h-6 w-6 text-muted-foreground hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <ChevronLeft className="h-3 w-3" />
                                        </Button>
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <DataShelf />
                                    </div>
                                </div>
                            </motion.aside>
                        )}
                    </AnimatePresence>

                    {/* CENTER STAGE: Canvas */}
                    <main className="flex-1 relative h-full min-w-0 flex flex-col">
                        {/* Toggle Controls */}
                        <div className="absolute top-4 left-4 z-50 flex gap-2 pointer-events-none">
                            <div className="pointer-events-auto">
                                {!leftOpen && (
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => setLeftOpen(true)}
                                        className="h-8 w-8 rounded-lg bg-black/40 border-white/10 backdrop-blur-md hover:bg-white/10 hover:border-white/20 shadow-lg text-muted-foreground hover:text-white transition-all"
                                    >
                                        <LayoutTemplate className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Right panel toggle - positioned at edge when collapsed */}
                        {!rightOpen && (
                            <div className="absolute top-1/2 -translate-y-1/2 right-0 z-50">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setRightOpen(true)}
                                    title="Open Visual Mapping"
                                    className="h-10 w-6 rounded-l-lg rounded-r-none bg-indigo-500/20 border-l border-t border-b border-indigo-500/30 border-r-0 backdrop-blur-md hover:bg-indigo-500/40 hover:border-indigo-500/50 shadow-lg text-indigo-400 hover:text-white transition-all"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                            </div>
                        )}

                        {/* Canvas Container */}
                        <div className="flex-1 rounded-xl border border-white/5 bg-transparent overflow-hidden relative">
                            {/* Canvas Background Glow */}
                            <div className="absolute inset-0 bg-gradient-to-t from-purple-900/5 via-transparent to-transparent pointer-events-none" />
                            <Canvas />
                        </div>
                    </main>

                    {/* RIGHT DOCK: Properties */}
                    <AnimatePresence mode='wait' initial={false}>
                        {rightOpen && (
                            <motion.aside
                                initial={{ width: 0, opacity: 0 }}
                                animate={{ width: 320, opacity: 1 }}
                                exit={{ width: 0, opacity: 0 }}
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                className="h-full shrink-0"
                            >
                                <div className="h-full w-[320px] rounded-xl glass-panel flex flex-col overflow-hidden relative group border-border">
                                    <div className="h-10 shrink-0 px-4 flex items-center justify-between border-b border-white/5">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setRightOpen(false)}
                                            className="h-6 w-6 text-muted-foreground hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <ChevronRight className="h-3 w-3" />
                                        </Button>
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Visual Mapping</span>
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <EncodingDeck />
                                    </div>
                                </div>
                            </motion.aside>
                        )}
                    </AnimatePresence>
                </div>

                {/* Floating AI - Bottom right corner */}
                <div className="fixed bottom-6 right-6 z-50">
                    <AIChat />
                </div>

                <DragOverlay dropAnimation={dropAnimation}>
                    {activeField && <DraggableField field={activeField} isOverlay />}
                </DragOverlay>
            </div>
        </DndContext>
    );
}
