import type { CanvasViewMode } from '@backend/types';
import type { StoreSet, StoreGet } from './types';

// ============================================
// UI Slice
// ============================================

export const createUISlice = (set: StoreSet, get: StoreGet) => ({
    // State defaults
    canvasView: 'chart' as CanvasViewMode,
    selectedFieldId: null as string | null,
    isDragging: false,
    leftSidebarOpen: true,
    rightSidebarOpen: true,

    // Actions

    setCanvasView: (view: CanvasViewMode) => {
        set({ canvasView: view });
    },

    setSelectedField: (fieldId: string | null) => {
        set({ selectedFieldId: fieldId });
    },

    setDragging: (isDragging: boolean) => {
        set({ isDragging });
    },

    toggleLeftSidebar: () => {
        set({ leftSidebarOpen: !(get() as any).leftSidebarOpen });
    },

    toggleRightSidebar: () => {
        set({ rightSidebarOpen: !(get() as any).rightSidebarOpen });
    },
});
