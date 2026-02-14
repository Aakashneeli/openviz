import type {
    ShelfPlacement,
    ChartConfig,
    EChartsOption,
} from '@backend/types';
import type { StoreSet, StoreGet } from './types';

// ============================================
// History Entry Type
// ============================================

interface HistoryEntry {
    encodings: ShelfPlacement[];
    chartConfig: ChartConfig;
    echartsOption: EChartsOption | null;
}

interface HistoryState {
    past: HistoryEntry[];
    future: HistoryEntry[];
}

// ============================================
// History Slice
// ============================================

export const createHistorySlice = (set: StoreSet, get: StoreGet) => ({
    // State defaults
    history: { past: [], future: [] } as HistoryState,

    // Actions

    pushToHistory: () => {
        const state = get() as any;
        const { encodings, chartConfig, echartsOption, history } = state;
        const entry: HistoryEntry = { encodings, chartConfig, echartsOption };

        set({
            history: {
                past: [...history.past, entry].slice(-50), // Keep max 50 entries
                future: [], // Clear redo stack on new action
            }
        });
    },

    undo: () => {
        const state = get() as any;
        const { history, encodings, chartConfig, echartsOption } = state;
        if (history.past.length === 0) return;

        const previous = history.past[history.past.length - 1];
        const currentEntry: HistoryEntry = { encodings, chartConfig, echartsOption };

        set({
            encodings: previous.encodings,
            chartConfig: previous.chartConfig,
            echartsOption: previous.echartsOption,
            history: {
                past: history.past.slice(0, -1),
                future: [currentEntry, ...history.future],
            }
        });
    },

    redo: () => {
        const state = get() as any;
        const { history, encodings, chartConfig, echartsOption } = state;
        if (history.future.length === 0) return;

        const next = history.future[0];
        const currentEntry: HistoryEntry = { encodings, chartConfig, echartsOption };

        set({
            encodings: next.encodings,
            chartConfig: next.chartConfig,
            echartsOption: next.echartsOption,
            history: {
                past: [...history.past, currentEntry],
                future: history.future.slice(1),
            }
        });
    },

    canUndo: () => (get() as any).history.past.length > 0,
    canRedo: () => (get() as any).history.future.length > 0,
});
