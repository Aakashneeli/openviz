// ============================================
// DraggableField - Luminous Chip
// ============================================

import { useDraggable } from '@dnd-kit/core';
import { useVizStore, selectIsFieldUsed } from '@/store/useVizStore';
import { cn } from '@/lib/utils';
import type { FieldInfo, FieldType } from '@/types';
import { Hash, Type, Calendar, ArrowUpWideNarrow } from 'lucide-react';
import { motion } from 'framer-motion';

interface DraggableFieldProps {
    field: FieldInfo;
    isOverlay?: boolean;
}

const typeIcons: Record<FieldType, React.ElementType> = {
    quantitative: Hash,
    nominal: Type,
    temporal: Calendar,
    ordinal: ArrowUpWideNarrow,
};

// Duotone Colors (Text / Icon)
const typeStyles: Record<FieldType, { icon: string; text: string; border: string }> = {
    quantitative: { icon: 'text-emerald-400', text: 'text-emerald-100', border: 'border-emerald-500/20' },
    nominal: { icon: 'text-blue-400', text: 'text-blue-100', border: 'border-blue-500/20' },
    temporal: { icon: 'text-amber-400', text: 'text-amber-100', border: 'border-amber-500/20' },
    ordinal: { icon: 'text-orange-400', text: 'text-orange-100', border: 'border-orange-500/20' },
};

export function DraggableField({ field, isOverlay }: DraggableFieldProps) {
    const isUsed = useVizStore(selectIsFieldUsed(field.id));

    const {
        attributes,
        listeners,
        setNodeRef,
        isDragging,
    } = useDraggable({
        id: field.id,
        data: { field, type: 'field' },
    });

    const Icon = typeIcons[field.type];
    const { icon, text, border } = typeStyles[field.type];

    // Overlay style (Dragged item - Physics enabled via framer-motion in global overlay if needed, 
    // but here we style the preview)
    if (isOverlay) {
        return (
            <motion.div
                initial={{ scale: 1.05, rotate: -2 }}
                animate={{ scale: 1.1, rotate: 0 }}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.3)] bg-background/90 backdrop-blur-md border border-indigo-500/50 cursor-grabbing z-50",
                )}
            >
                <Icon className={cn("w-3.5 h-3.5", icon)} />
                <span className={cn("text-xs font-semibold", text)}>{field.name}</span>
            </motion.div>
        );
    }

    return (
        <motion.div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            layoutId={field.id}
            whileHover={{ scale: 1.02, x: 2 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
                "group relative flex items-center gap-2 px-3 py-1.5 rounded-full select-none cursor-grab active:cursor-grabbing border bg-white/5 transition-all",
                border,
                isUsed && "opacity-50 grayscale",
                isDragging && "opacity-0"
            )}
        >
            <div className={cn("absolute inset-0 rounded-full  opacity-0 group-hover:opacity-100 transition-opacity bg-white/5")} />

            <Icon className={cn("w-3.5 h-3.5 shrink-0 transition-colors", icon)} />
            <span className={cn(
                "text-xs font-medium truncate max-w-[140px]",
                text
            )}>
                {field.name}
            </span>
        </motion.div>
    );
}
