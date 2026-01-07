// ============================================
// OpenViz Store - Central State Management
// Using Zustand for lightweight, performant state
// Enhanced with History, Dashboard, and AI Context
// ============================================

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import Papa from 'papaparse';
import type {
    Dataset,
    FieldInfo,
    ShelfPlacement,
    ChartConfig,
    MarkType,
    EncodingChannel,
    VegaLiteSpec,
    DataRecord,
    UploadStatus,
    CanvasViewMode,
    ChartSuggestion,
    DataInsight,
    DataProfile,
    AIMessage,
    DashboardConfig,
    ChartSummary,
    DashboardSummary,
} from '@backend/types';
import { inferSchema } from '@backend/utils/schemaInference';
import { buildVegaLiteSpec } from '@backend/utils/vegaSpecBuilder';
import { getChartSuggestions } from '@backend/utils/autoChart';
import { generateDataProfile } from '@backend/services/dataContextService';

// ============================================
// Store Interface
// ============================================

// ============================================
// History State (for Undo/Redo)
// ============================================

interface HistoryEntry {
    encodings: ShelfPlacement[];
    chartConfig: ChartConfig;
    vegaSpec: VegaLiteSpec | null;
}

interface HistoryState {
    past: HistoryEntry[];
    future: HistoryEntry[];
}

// ============================================
// Main Store Interface
// ============================================

interface VizState {
    // Data
    dataset: Dataset | null;
    uploadStatus: UploadStatus;
    dataProfile: DataProfile | null;

    // Encodings
    encodings: ShelfPlacement[];

    // Chart Configuration
    chartConfig: ChartConfig;

    // Dashboard Configuration (for multi-chart views)
    dashboardConfig: DashboardConfig | null;
    viewMode: 'single' | 'dashboard';

    // Generated Vega-Lite Spec
    vegaSpec: VegaLiteSpec | null;

    // History (Undo/Redo)
    history: HistoryState;

    // UI State
    canvasView: CanvasViewMode;
    selectedFieldId: string | null;
    isDragging: boolean;
    leftSidebarOpen: boolean;
    rightSidebarOpen: boolean;

    // AI State
    aiQuery: string;
    aiChatOpen: boolean; // Added control for chat visibility
    aiLoading: boolean;
    aiSuggestions: ChartSuggestion[];
    aiInsights: DataInsight[];
    aiChatHistory: AIMessage[];

    // Summary State
    chartSummary: ChartSummary | null;
    dashboardSummary: DashboardSummary | null;
    summaryLoading: boolean;
}

interface VizActions {
    // Data Actions
    loadDataFromFile: (file: File) => Promise<void>;
    loadDataFromJson: (data: DataRecord[], name: string) => void;
    clearData: () => void;

    // Encoding Actions
    addToShelf: (field: FieldInfo, channel: EncodingChannel) => void;
    removeFromShelf: (channel: EncodingChannel) => void;
    updateShelfConfig: (
        channel: EncodingChannel,
        config: Partial<Pick<ShelfPlacement, 'aggregate' | 'bin' | 'timeUnit' | 'sort'>>
    ) => void;
    clearAllShelves: () => void;
    swapChannels: (from: EncodingChannel, to: EncodingChannel) => void;

    // Chart Actions
    setMark: (mark: MarkType) => void;
    setTitle: (title: string) => void;
    setDimensions: (width: number | 'container', height: number | 'container') => void;
    resetChart: () => void;

    // UI Actions
    setCanvasView: (view: CanvasViewMode) => void;
    setSelectedField: (fieldId: string | null) => void;
    setDragging: (isDragging: boolean) => void;

    // AI Actions
    setAIQuery: (query: string) => void;
    processAIQuery: (query: string) => Promise<void>;
    applySuggestion: (suggestion: ChartSuggestion) => void;
    generateInsights: () => Promise<void>;
    addChatMessage: (message: AIMessage) => void;
    clearChatHistory: () => void;
    setAIChatOpen: (isOpen: boolean) => void;
    toggleAIChat: () => void;

    // Summary Actions
    generateChartSummary: () => Promise<void>;
    generateDashboardSummary: () => Promise<void>;
    clearSummaries: () => void;

    // History Actions (Undo/Redo)
    undo: () => void;
    redo: () => void;
    canUndo: () => boolean;
    canRedo: () => boolean;
    pushToHistory: () => void;

    // Dashboard Actions
    setDashboardConfig: (config: DashboardConfig | null) => void;
    setViewMode: (mode: 'single' | 'dashboard') => void;

    // Sidebar Actions
    toggleLeftSidebar: () => void;
    toggleRightSidebar: () => void;

    // Spec Actions
    updateSpecFromJson: (spec: VegaLiteSpec) => void;
    regenerateSpec: () => void;
}

// ============================================
// Initial State
// ============================================

const initialChartConfig: ChartConfig = {
    id: uuidv4(),
    mark: 'auto',
    encodings: [],
    width: 'container',
    height: 400,
    interactive: true,
};

const initialState: VizState = {
    // Data
    dataset: null,
    uploadStatus: { state: 'idle', progress: 0 },
    dataProfile: null,

    // Chart/Encoding
    encodings: [],
    chartConfig: initialChartConfig,
    vegaSpec: null,

    // Dashboard
    dashboardConfig: null,
    viewMode: 'single',

    // History
    history: { past: [], future: [] },

    // UI
    canvasView: 'chart',
    selectedFieldId: null,
    isDragging: false,
    leftSidebarOpen: true,
    rightSidebarOpen: true,

    // AI
    aiQuery: '',
    aiLoading: false,
    aiSuggestions: [],
    aiInsights: [],
    aiChatHistory: [],
    aiChatOpen: false,

    // Summaries
    chartSummary: null,
    dashboardSummary: null,
    summaryLoading: false,
};

// ============================================
// Store Creation
// ============================================

export const useVizStore = create<VizState & VizActions>()(
    devtools(
        (set, get) => ({
            ...initialState,

            // ----------------------------------------
            // Data Actions
            // ----------------------------------------

            loadDataFromFile: async (file: File) => {
                set({
                    uploadStatus: { state: 'uploading', progress: 0 }
                });

                try {
                    const extension = file.name.split('.').pop()?.toLowerCase();
                    let data: DataRecord[] = [];

                    if (extension === 'csv' || extension === 'tsv') {
                        data = await parseCSV(file);
                    } else if (extension === 'json') {
                        data = await parseJSON(file);
                    } else {
                        throw new Error(`Unsupported file type: ${extension}`);
                    }

                    set({
                        uploadStatus: { state: 'processing', progress: 50 }
                    });

                    // Infer schema
                    const fields = inferSchema(data);

                    const dataset: Dataset = {
                        id: uuidv4(),
                        name: file.name,
                        fields,
                        rowCount: data.length,
                        data,
                        uploadedAt: new Date(),
                    };

                    set({
                        dataset,
                        dataProfile: generateDataProfile(data, fields),
                        uploadStatus: { state: 'complete', progress: 100 },
                        encodings: [],
                        vegaSpec: null,
                    });

                    // Generate AI suggestions after loading
                    const suggestions = getChartSuggestions([]).map((s) => ({
                        id: uuidv4(),
                        title: `Suggested: ${s.mark} chart`,
                        description: s.reason,
                        config: { ...initialChartConfig, mark: s.mark },
                        score: s.score,
                    }));

                    set({ aiSuggestions: suggestions });

                } catch (error) {
                    set({
                        uploadStatus: {
                            state: 'error',
                            progress: 0,
                            error: error instanceof Error ? error.message : 'Unknown error',
                        },
                    });
                }
            },

            loadDataFromJson: (data: DataRecord[], name: string) => {
                const fields = inferSchema(data);

                const dataset: Dataset = {
                    id: uuidv4(),
                    name,
                    fields,
                    rowCount: data.length,
                    data,
                    uploadedAt: new Date(),
                };

                set({
                    dataset,
                    uploadStatus: { state: 'complete', progress: 100 },
                    encodings: [],
                    vegaSpec: null,
                });
            },

            clearData: () => {
                set({
                    dataset: null,
                    uploadStatus: { state: 'idle', progress: 0 },
                    encodings: [],
                    vegaSpec: null,
                    aiSuggestions: [],
                    aiInsights: [],
                });
            },

            // ----------------------------------------
            // Encoding Actions
            // ----------------------------------------

            addToShelf: (field: FieldInfo, channel: EncodingChannel) => {
                const { encodings, dataset } = get();

                // Remove any existing placement in this channel
                const filteredEncodings = encodings.filter(e => e.channel !== channel);

                // Remove this field from any other channel
                const withoutField = filteredEncodings.filter(
                    e => e.field.id !== field.id
                );

                const newPlacement: ShelfPlacement = {
                    id: uuidv4(),
                    field,
                    channel,
                };

                const newEncodings = [...withoutField, newPlacement];

                set({ encodings: newEncodings });

                // Regenerate spec
                if (dataset) {
                    get().regenerateSpec();
                }
            },

            removeFromShelf: (channel: EncodingChannel) => {
                const { encodings, dataset } = get();
                const newEncodings = encodings.filter(e => e.channel !== channel);

                set({ encodings: newEncodings });

                if (dataset) {
                    get().regenerateSpec();
                }
            },

            updateShelfConfig: (channel, config) => {
                const { encodings, dataset } = get();
                const newEncodings = encodings.map(e =>
                    e.channel === channel ? { ...e, ...config } : e
                );

                set({ encodings: newEncodings });

                if (dataset) {
                    get().regenerateSpec();
                }
            },

            clearAllShelves: () => {
                set({ encodings: [], vegaSpec: null });
            },

            swapChannels: (from: EncodingChannel, to: EncodingChannel) => {
                const { encodings, dataset } = get();
                const newEncodings = encodings.map(e => {
                    if (e.channel === from) return { ...e, channel: to };
                    if (e.channel === to) return { ...e, channel: from };
                    return e;
                });

                set({ encodings: newEncodings });

                if (dataset) {
                    get().regenerateSpec();
                }
            },

            // ----------------------------------------
            // Chart Actions
            // ----------------------------------------

            setMark: (mark: MarkType) => {
                const { chartConfig, dataset } = get();
                set({
                    chartConfig: { ...chartConfig, mark },
                });

                if (dataset) {
                    get().regenerateSpec();
                }
            },

            setTitle: (title: string) => {
                const { chartConfig } = get();
                set({
                    chartConfig: { ...chartConfig, title },
                });
                get().regenerateSpec();
            },

            setDimensions: (width, height) => {
                const { chartConfig } = get();
                set({
                    chartConfig: { ...chartConfig, width, height },
                });
                get().regenerateSpec();
            },

            resetChart: () => {
                set({
                    chartConfig: { ...initialChartConfig, id: uuidv4() },
                    encodings: [],
                    vegaSpec: null,
                    chartSummary: null,
                    aiInsights: [],
                });
            },

            // ----------------------------------------
            // UI Actions
            // ----------------------------------------

            setCanvasView: (view: CanvasViewMode) => {
                set({ canvasView: view });
            },

            setSelectedField: (fieldId: string | null) => {
                set({ selectedFieldId: fieldId });
            },

            setDragging: (isDragging: boolean) => {
                set({ isDragging });
            },

            // ----------------------------------------
            // AI Actions
            // ----------------------------------------

            setAIQuery: (query: string) => {
                set({ aiQuery: query });
            },

            processAIQuery: async (query: string) => {
                const { dataset, dataProfile, encodings, aiChatHistory } = get();

                if (!dataset || !dataProfile) {
                    console.error('No dataset or data profile loaded');
                    return;
                }

                set({ aiLoading: true, aiQuery: query });

                // Add user message to chat history
                const userMessage: AIMessage = {
                    id: uuidv4(),
                    role: 'user',
                    content: query,
                    timestamp: new Date(),
                };
                get().addChatMessage(userMessage);

                try {
                    // Use the enhanced AI service
                    const { processAIQuery } = await import('@backend/services/groqService');
                    const { dashboardConfig, chartConfig } = get();

                    const result = await processAIQuery(
                        query,
                        dataProfile,
                        dataset.fields,
                        dataset.data,
                        encodings,
                        aiChatHistory,
                        dashboardConfig,
                        chartConfig?.mark || 'bar'
                    );

                    // Handle based on intent
                    if (result.intent === 'question' && result.textAnswer) {
                        // Text answer for data questions
                        const assistantMessage: AIMessage = {
                            id: uuidv4(),
                            role: 'assistant',
                            content: result.textAnswer,
                            timestamp: new Date(),
                            resultType: 'text',
                        };
                        get().addChatMessage(assistantMessage);
                    } else if (result.chartConfig) {
                        // Chart creation or modification
                        get().pushToHistory(); // Save for undo
                        set({
                            chartConfig: result.chartConfig,
                            encodings: result.chartConfig.encodings,
                        });
                        get().regenerateSpec();

                        const assistantMessage: AIMessage = {
                            id: uuidv4(),
                            role: 'assistant',
                            content: result.textAnswer || `Created ${result.chartConfig.mark} chart`,
                            timestamp: new Date(),
                            resultType: 'chart',
                        };
                        get().addChatMessage(assistantMessage);
                    } else if (result.dashboardConfig) {
                        // Dashboard creation
                        set({
                            dashboardConfig: result.dashboardConfig,
                            viewMode: 'dashboard',
                        });

                        const assistantMessage: AIMessage = {
                            id: uuidv4(),
                            role: 'assistant',
                            content: result.textAnswer || 'Created dashboard',
                            timestamp: new Date(),
                            resultType: 'dashboard',
                        };
                        get().addChatMessage(assistantMessage);
                    } else if (result.error) {
                        const errorMessage: AIMessage = {
                            id: uuidv4(),
                            role: 'assistant',
                            content: `Error: ${result.error}`,
                            timestamp: new Date(),
                            resultType: 'error',
                        };
                        get().addChatMessage(errorMessage);
                    }

                    if (result.insights) {
                        set({ aiInsights: result.insights });
                    }

                } catch (error) {
                    console.error('AI Query Error:', error);
                    const errorMessage: AIMessage = {
                        id: uuidv4(),
                        role: 'assistant',
                        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        timestamp: new Date(),
                        resultType: 'error',
                    };
                    get().addChatMessage(errorMessage);
                } finally {
                    set({ aiLoading: false });
                }
            },

            applySuggestion: (suggestion: ChartSuggestion) => {
                set({
                    chartConfig: suggestion.config,
                    encodings: suggestion.config.encodings,
                });
                get().regenerateSpec();
            },

            generateInsights: async () => {
                set({ aiLoading: true });

                try {
                    const { generateDataInsights } = await import('@backend/services/groqService');
                    const { dataset } = get();

                    if (!dataset) {
                        throw new Error('No dataset loaded');
                    }

                    const insights = await generateDataInsights(dataset.data, dataset.fields);
                    set({ aiInsights: insights });

                } catch (error) {
                    console.error('Generate Insights Error:', error);
                } finally {
                    set({ aiLoading: false });
                }
            },

            addChatMessage: (message: AIMessage) => {
                set((state) => ({ aiChatHistory: [...state.aiChatHistory, message] }));
            },

            clearChatHistory: () => set({ aiChatHistory: [] }),

            setAIChatOpen: (isOpen) => set({ aiChatOpen: isOpen }),

            toggleAIChat: () => set((state) => ({ aiChatOpen: !state.aiChatOpen })),

            // ----------------------------------------
            // Summary Actions
            // ----------------------------------------

            generateChartSummary: async () => {
                const { dataset, dataProfile, chartConfig, encodings } = get();

                if (!dataset || !dataProfile || encodings.length === 0) {
                    console.error('Cannot generate summary: no chart configured');
                    return;
                }

                set({ summaryLoading: true });

                try {
                    const { generateChartSummary } = await import('@backend/services/groqService');
                    const configWithEncodings = { ...chartConfig, encodings };
                    const result = await generateChartSummary(configWithEncodings, dataProfile, dataset.data);

                    const summary: ChartSummary = {
                        id: uuidv4(),
                        chartId: chartConfig.id,
                        summary: result.summary,
                        keyInsights: result.keyInsights,
                        generatedAt: new Date(),
                    };

                    set({ chartSummary: summary });
                } catch (error) {
                    console.error('Chart Summary Error:', error);
                } finally {
                    set({ summaryLoading: false });
                }
            },

            generateDashboardSummary: async () => {
                const { dataset, dataProfile, dashboardConfig } = get();

                if (!dataset || !dataProfile || !dashboardConfig) {
                    console.error('Cannot generate summary: no dashboard configured');
                    return;
                }

                set({ summaryLoading: true });

                try {
                    const { generateDashboardSummary } = await import('@backend/services/groqService');
                    const result = await generateDashboardSummary(dashboardConfig, dataProfile, dataset.data);

                    // Check if the result is an error - look for the specific error message
                    if (result.overview.includes('Failed to generate')) {
                        console.error('Dashboard summary generation failed:', result.overview);
                        // Don't update the summary if it's an error - keep existing summary
                        return;
                    }

                    const chartSummaries: ChartSummary[] = result.chartSummaries.map(cs => ({
                        id: uuidv4(),
                        chartId: cs.chartId,
                        summary: cs.summary,
                        keyInsights: [],
                        generatedAt: new Date(),
                    }));

                    const summary: DashboardSummary = {
                        id: uuidv4(),
                        dashboardId: dashboardConfig.id,
                        overview: result.overview,
                        chartSummaries,
                        keyTakeaways: result.keyTakeaways,
                        generatedAt: new Date(),
                    };

                    set({ dashboardSummary: summary });
                } catch (error) {
                    console.error('Dashboard Summary Error:', error);
                    // Don't update state on error - keep existing summary
                } finally {
                    set({ summaryLoading: false });
                }
            },

            clearSummaries: () => {
                set({ chartSummary: null, dashboardSummary: null });
            },

            // ----------------------------------------
            // History Actions (Undo/Redo)
            // ----------------------------------------

            pushToHistory: () => {
                const { encodings, chartConfig, vegaSpec, history } = get();
                const entry: HistoryEntry = { encodings, chartConfig, vegaSpec };

                set({
                    history: {
                        past: [...history.past, entry].slice(-50), // Keep max 50 entries
                        future: [], // Clear redo stack on new action
                    }
                });
            },

            undo: () => {
                const { history, encodings, chartConfig, vegaSpec } = get();
                if (history.past.length === 0) return;

                const previous = history.past[history.past.length - 1];
                const currentEntry: HistoryEntry = { encodings, chartConfig, vegaSpec };

                set({
                    encodings: previous.encodings,
                    chartConfig: previous.chartConfig,
                    vegaSpec: previous.vegaSpec,
                    history: {
                        past: history.past.slice(0, -1),
                        future: [currentEntry, ...history.future],
                    }
                });
            },

            redo: () => {
                const { history, encodings, chartConfig, vegaSpec } = get();
                if (history.future.length === 0) return;

                const next = history.future[0];
                const currentEntry: HistoryEntry = { encodings, chartConfig, vegaSpec };

                set({
                    encodings: next.encodings,
                    chartConfig: next.chartConfig,
                    vegaSpec: next.vegaSpec,
                    history: {
                        past: [...history.past, currentEntry],
                        future: history.future.slice(1),
                    }
                });
            },

            canUndo: () => get().history.past.length > 0,
            canRedo: () => get().history.future.length > 0,

            // ----------------------------------------
            // Dashboard Actions
            // ----------------------------------------

            setDashboardConfig: (config: DashboardConfig | null) => {
                set({ dashboardConfig: config });
            },

            setViewMode: (mode: 'single' | 'dashboard') => {
                set({ viewMode: mode });
            },

            // ----------------------------------------
            // Sidebar Actions
            // ----------------------------------------

            toggleLeftSidebar: () => {
                set({ leftSidebarOpen: !get().leftSidebarOpen });
            },

            toggleRightSidebar: () => {
                set({ rightSidebarOpen: !get().rightSidebarOpen });
            },

            // ----------------------------------------
            // Spec Actions
            // ----------------------------------------

            updateSpecFromJson: (spec: VegaLiteSpec) => {
                set({ vegaSpec: spec });
                // TODO: Parse spec back to encodings for bi-directional editing
            },

            regenerateSpec: () => {
                const { dataset, chartConfig, encodings } = get();

                if (!dataset || encodings.length === 0) {
                    set({ vegaSpec: null });
                    return;
                }

                const configWithEncodings: ChartConfig = {
                    ...chartConfig,
                    encodings,
                };

                const spec = buildVegaLiteSpec(configWithEncodings, dataset.data);
                set({ vegaSpec: spec });

                // Update suggestions based on current encodings
                const suggestions = getChartSuggestions(encodings).map((s) => ({
                    id: uuidv4(),
                    title: `${s.mark.charAt(0).toUpperCase() + s.mark.slice(1)} Chart`,
                    description: s.reason,
                    config: { ...chartConfig, mark: s.mark, encodings },
                    score: s.score,
                }));

                set({ aiSuggestions: suggestions });
            },
        }),
        { name: 'openviz-store' }
    )
);

// ============================================
// Helper Functions
// ============================================

async function parseCSV(file: File): Promise<DataRecord[]> {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: (results) => {
                resolve(results.data as DataRecord[]);
            },
            error: (error) => {
                reject(error);
            },
        });
    });
}

async function parseJSON(file: File): Promise<DataRecord[]> {
    const text = await file.text();
    const parsed = JSON.parse(text);

    // Handle both array and object with data property
    if (Array.isArray(parsed)) {
        return parsed;
    } else if (parsed.data && Array.isArray(parsed.data)) {
        return parsed.data;
    } else {
        throw new Error('Invalid JSON format. Expected an array or object with data property.');
    }
}

// ============================================
// Selectors (for optimized re-renders)
// ============================================

// Stable empty array to avoid creating new references
const EMPTY_FIELDS: FieldInfo[] = [];
const EMPTY_MESSAGES: AIMessage[] = [];

// Data Selectors
export const selectDataset = (state: VizState) => state.dataset;
export const selectFields = (state: VizState) => state.dataset?.fields ?? EMPTY_FIELDS;
export const selectDataProfile = (state: VizState) => state.dataProfile;
export const selectUploadStatus = (state: VizState) => state.uploadStatus;

// Encoding Selectors
export const selectEncodings = (state: VizState) => state.encodings;
export const selectEncodingByChannel = (channel: EncodingChannel) => (state: VizState) =>
    state.encodings.find(e => e.channel === channel);
export const selectIsFieldUsed = (fieldId: string) => (state: VizState) =>
    state.encodings.some(e => e.field.id === fieldId);

// Chart Selectors
export const selectVegaSpec = (state: VizState) => state.vegaSpec;
export const selectChartConfig = (state: VizState) => state.chartConfig;
export const selectCanvasView = (state: VizState) => state.canvasView;

// Dashboard Selectors
export const selectDashboardConfig = (state: VizState) => state.dashboardConfig;
export const selectViewMode = (state: VizState) => state.viewMode;

// History Selectors
export const selectCanUndo = (state: VizState) => state.history.past.length > 0;
export const selectCanRedo = (state: VizState) => state.history.future.length > 0;

// AI Selectors
export const selectAILoading = (state: VizState) => state.aiLoading;
export const selectAISuggestions = (state: VizState) => state.aiSuggestions;
export const selectAIChatHistory = (state: VizState) => state.aiChatHistory ?? EMPTY_MESSAGES;
export const selectAIInsights = (state: VizState) => state.aiInsights;

// Summary Selectors
export const selectChartSummary = (state: VizState) => state.chartSummary;
export const selectDashboardSummary = (state: VizState) => state.dashboardSummary;
export const selectSummaryLoading = (state: VizState) => state.summaryLoading;

// UI Selectors
export const selectLeftSidebarOpen = (state: VizState) => state.leftSidebarOpen;
export const selectRightSidebarOpen = (state: VizState) => state.rightSidebarOpen;
export const selectFieldById = (id: string) => (state: VizState) =>
    state.dataset?.fields.find(f => f.id === id);

