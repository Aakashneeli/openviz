// ============================================
// DraggableField - DataViz Studio Pill Style
// ============================================

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useVizStore, selectIsFieldUsed } from '@/store/useVizStore';
import { cn } from '@/lib/utils';
import type { FieldInfo, FieldType } from '@/types';

interface DraggableFieldProps {
    field: FieldInfo;
    isOverlay?: boolean;
}

const typeConfig: Record<FieldType, { label: string; style: string }> = {
    quantitative: { label: '#', style: 'bg-[hsl(var(--field-q))] shadow-[0_0_8px_hsl(var(--field-q)/0.4)]' },
    nominal: { label: 'A', style: 'bg-[hsl(var(--field-n))] shadow-[0_0_8px_hsl(var(--field-n)/0.4)]' },
    temporal: { label: 'T', style: 'bg-[hsl(var(--field-t))] shadow-[0_0_8px_hsl(var(--field-t)/0.4)]' },
    ordinal: { label: 'O', style: 'bg-[hsl(var(--field-o))] shadow-[0_0_8px_hsl(var(--field-o)/0.4)]' },
};

export function DraggableField({ field, isOverlay }: DraggableFieldProps) {
    const isUsed = useVizStore(selectIsFieldUsed(field.id));

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        isDragging,
    } = useDraggable({
        id: field.id,
        data: { field, type: 'field' },
    });

    const style = {
        transform: CSS.Translate.toString(transform),
    };

    const config = typeConfig[field.type];

    // If drag overlay, show a slightly different style (Ghost/Glass)
    if (isOverlay) {
        return (
            <div className="flex items-center w-64 gap-3 p-3 rounded-lg bg-card/90 border border-primary/50 shadow-2xl cursor-grabbing ring-1 ring-primary/50 backdrop-blur-md">
                <div className={cn("flex items-center justify-center w-6 h-6 rounded text-xs font-bold text-white shadow-sm ring-1 ring-white/10", config.style)}>
                    {config.label}
                </div>
                <span className="text-sm font-medium text-foreground">{field.name}</span>
            </div>
        );
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={cn(
                "field-pill group relative overflow-hidden",
                isDragging && "opacity-30 grayscale",
                isUsed && "opacity-75"
            )}
        >
            <div className={cn("field-badge transition-all duration-300 group-hover:shadow-[0_0_12px_rgba(255,255,255,0.3)]", config.style)}>
                {config.label}
            </div>

            <span className={cn(
                "flex-1 text-sm font-medium truncate transition-colors",
                isUsed ? "text-muted-foreground" : "text-foreground group-hover:text-primary-foreground"
            )}>
                {field.name}
            </span>

            {/* Hover shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-shimmer pointer-events-none" />
        </div>
    );
}
