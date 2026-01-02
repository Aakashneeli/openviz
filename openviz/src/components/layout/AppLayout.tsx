// ============================================
// AppLayout - OpenViz Main Layout
// ============================================

import { DndContext, DragOverlay, closestCenter, defaultDropAnimationSideEffects } from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent, DropAnimation } from '@dnd-kit/core';
import { useState } from 'react';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, Settings2 } from 'lucide-react';
import { DataShelf } from '@/components/data-shelf/DataShelf';
import { EncodingDeck } from '@/components/encoding-deck/EncodingDeck';
import { Canvas } from '@/components/canvas/Canvas';
import { TopBar } from '@/components/layout/TopBar';
import { DraggableField } from '@/components/data-shelf/DraggableField';
import { AIChat } from '@/components/ai/AIChat';
import { useVizStore } from '@/store/useVizStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { FieldInfo, EncodingChannel } from '@/types';

const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
        styles: { active: { opacity: '0.5' } },
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
            <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden selection:bg-primary/20 relative">
                <TopBar />

                <div className="flex flex-1 overflow-hidden relative">
                    {/* 1. LEFT PANEL: Data Shelf */}
                    <aside
                        className={cn(
                            "flex-shrink-0 border-r border-border bg-card/30 backdrop-blur-sm transition-all duration-300 ease-in-out relative z-30 flex flex-col",
                            leftOpen ? "w-72 opacity-100" : "w-0 opacity-0 overflow-hidden border-none"
                        )}
                    >
                        <div className="h-full w-72 flex flex-col overflow-hidden relative">
                            <div className="absolute top-2 right-2 z-10">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setLeftOpen(false)}
                                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                >
                                    <PanelLeftClose className="h-3 w-3" />
                                </Button>
                            </div>
                            <DataShelf />
                        </div>
                    </aside>

                    {/* 2. MIDDLE PANEL: Encoding Deck */}
                    <aside
                        className={cn(
                            "flex-shrink-0 border-r border-border bg-card/30 backdrop-blur-sm transition-all duration-300 ease-in-out relative z-30 flex flex-col",
                            rightOpen ? "w-80 opacity-100" : "w-0 opacity-0 overflow-hidden border-none"
                        )}
                    >
                        <div className="h-full w-80 flex flex-col overflow-hidden relative">
                            <div className="absolute top-2 right-2 z-10">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setRightOpen(false)}
                                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                >
                                    <PanelRightClose className="h-3 w-3" />
                                </Button>
                            </div>
                            <EncodingDeck />
                        </div>
                    </aside>

                    {/* 3. RIGHT PANEL: Canvas (Flex Grow) */}
                    <main className="flex-1 min-w-0 relative flex flex-col bg-background/50 z-0 overflow-hidden">

                        {/* Open Buttons Overlay */}
                        <div className="absolute top-4 left-4 z-50 flex gap-2">
                            {/* Data Open Button */}
                            {!leftOpen && (
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setLeftOpen(true)}
                                    className="h-8 w-8 bg-card border-border shadow-lg hover:bg-accent"
                                    title="Open Data Shelf"
                                >
                                    <PanelLeftOpen className="h-4 w-4" />
                                </Button>
                            )}
                            {/* Encoding Open Button */}
                            {!rightOpen && (
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setRightOpen(true)}
                                    className="h-8 w-8 bg-card border-border shadow-lg hover:bg-accent"
                                    title="Open Encoding Deck"
                                >
                                    <Settings2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>

                        {/* Scrollable Canvas Content */}
                        <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                            <div className="min-w-[800px] min-h-full">
                                <Canvas />
                            </div>
                        </div>
                    </main>
                </div>

                {/* Floating AI Chat - Bottom Left */}
                {/* Relying on fixed positioning inside AIChat.tsx, but placing it here for DOM order */}
                <AIChat />

                <DragOverlay dropAnimation={dropAnimation}>
                    {activeField && <DraggableField field={activeField} isOverlay />}
                </DragOverlay>
            </div>
        </DndContext>
    );
}
