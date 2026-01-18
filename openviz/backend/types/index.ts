// ============================================
// OpenViz Type Definitions
// ============================================

import type { EChartsOption } from 'echarts';

// ============================================
// Field Types & Statistics
// ============================================

/** Type classification for dataset columns */
export type FieldType = 'nominal' | 'quantitative' | 'temporal' | 'ordinal';

/** Semantic type classification for richer field understanding */
export type SemanticType =
    | 'email'
    | 'phone'
    | 'url'
    | 'currency'
    | 'percentage'
    | 'countryCode'
    | 'zipCode'
    | 'generic';

/** Statistics calculated for each field based on its type */
export interface FieldStats {
    count: number;
    nullCount: number;
    // Quantitative field stats
    min?: number;
    max?: number;
    mean?: number;
    median?: number;
    stdDev?: number;
    // Nominal/Ordinal field stats
    uniqueCount?: number;
    topValues?: Array<{ value: string; count: number }>;
    // Temporal field stats
    minDate?: string;
    maxDate?: string;
}

/** Column metadata with type inference and statistics */
export interface FieldInfo {
    id: string;
    name: string;
    type: FieldType;
    /** Optional semantic type for richer understanding (email, phone, url, etc.) */
    semanticType?: SemanticType;
    stats: FieldStats;
    /** Pre-computed sparkline data for quick visualization */
    sparklineData: number[];
}

// ============================================
// Dataset
// ============================================

/** Raw data record type */
export type DataRecord = Record<string, unknown>;

/** Dataset wrapper with metadata and profiled fields */
export interface Dataset {
    id: string;
    name: string;
    fields: FieldInfo[];
    rowCount: number;
    data: DataRecord[];
    uploadedAt: Date;
}

// ============================================
// Encoding & Chart Configuration
// ============================================

/** Vega-Lite encoding channels */
export type EncodingChannel =
    | 'x'
    | 'y'
    | 'color'
    | 'size'
    | 'shape'
    | 'tooltip'
    | 'row'
    | 'column';

/** Aggregation functions */
export type AggregateFunction =
    | 'sum'
    | 'mean'
    | 'count'
    | 'min'
    | 'max'
    | 'median'
    | 'distinct';

/** Time unit for temporal fields */
export type TimeUnit =
    | 'year'
    | 'quarter'
    | 'month'
    | 'week'
    | 'day'
    | 'hours'
    | 'minutes';

/** Field placement on an encoding channel/shelf */
export interface ShelfPlacement {
    id: string;
    field: FieldInfo;
    channel: EncodingChannel;
    aggregate?: AggregateFunction;
    bin?: boolean | { maxbins: number };
    timeUnit?: TimeUnit;
    sort?: 'ascending' | 'descending' | null;
}

/** Chart mark types - includes advanced ECharts visualizations */
export type MarkType =
    // Basic charts
    | 'bar'
    | 'line'
    | 'point'       // scatter
    | 'area'
    | 'arc'         // pie/donut
    // Statistical charts
    | 'boxplot'
    | 'candlestick'
    | 'histogram'   // distribution analysis
    // Hierarchical charts
    | 'treemap'
    | 'sunburst'
    | 'tree'        // org charts, decision trees
    // Relationship charts
    | 'sankey'
    | 'graph'
    // Specialty charts
    | 'radar'
    | 'heatmap'
    | 'funnel'
    | 'gauge'
    // Financial/Advanced charts
    | 'parallel'    // parallel coordinates
    | 'waterfall'   // financial changes
    | 'calendar'    // calendar heatmap
    | 'pictorialBar' // pictorial bar chart
    // Legacy/utility
    | 'rect'
    | 'rule'
    | 'text'
    | 'tick'
    | 'auto';

/** Annotation for highlighting data points on charts */
export interface Annotation {
    type: 'outlier' | 'max' | 'min' | 'trend';
    dataIndex: number;
    value: number;
    label: string;
    coord?: [number | string, number]; // For ECharts positioning
}

/** Complete chart configuration state */
export interface ChartConfig {
    id: string;
    title?: string;
    mark: MarkType;
    encodings: ShelfPlacement[];
    width: number | 'container';
    height: number | 'container';
    interactive?: boolean;
    fixedColor?: string; // For uniform coloring (e.g., "green", "#00ff00")
    annotations?: Annotation[]; // Smart annotations for data insights
}

// ============================================
// ECharts Option (re-export for convenience)
// ============================================

export type { EChartsOption };

// ============================================
// AI Features
// ============================================

/** AI-generated insight about the data */
export interface DataInsight {
    id: string;
    type: 'trend' | 'anomaly' | 'correlation' | 'distribution' | 'summary';
    title: string;
    description: string;
    confidence: number;
    relatedFields: string[];
}

/** AI chart suggestion */
export interface ChartSuggestion {
    id: string;
    title: string;
    description: string;
    config: ChartConfig;
    score: number;
}

/** AI query result */
export interface AIQueryResult {
    query: string;
    intent: AIIntent;
    chartConfig?: ChartConfig;
    dashboardConfig?: DashboardConfig;
    textAnswer?: string;
    insights?: DataInsight[];
    error?: string;
}

/** AI intent classification */
export type AIIntent =
    | 'question'           // User asking a data question (e.g., "What's the average?")
    | 'chart'              // User requesting a single chart
    | 'dashboard'          // User requesting a multi-chart dashboard
    | 'modify'             // User modifying current chart (e.g., "Make it a line chart")
    | 'modify_dashboard'   // User modifying current dashboard (e.g., "Add a pie chart")
    | 'explain'            // User asking for explanation (e.g., "Why is sales down?")
    | 'unknown';

/** AI chat message for conversation history */
export interface AIMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    /** If this message resulted in a chart/dashboard */
    resultType?: 'text' | 'chart' | 'dashboard' | 'error';
    /** Store the generated chart config for Transparency Mode (Peek Code feature) */
    chartConfig?: ChartConfig;
    /** Store the generated ECharts option for Transparency Mode */
    echartsOption?: EChartsOption;
}

// ============================================
// Data Profiling (for AI Context)
// ============================================

/** Simplified field profile for AI context injection */
export interface FieldProfile {
    name: string;
    type: FieldType;
    uniqueCount: number;
    nullCount: number;
    exampleValues: unknown[];
    /** Stats for quantitative fields */
    stats?: {
        min: number;
        max: number;
        mean: number;
        median: number;
        stdDev: number;
    };
    /** Stats for temporal fields */
    dateRange?: {
        min: string;
        max: string;
    };
    /** Top values for categorical fields */
    topValues?: Array<{ value: string; count: number }>;
}

/** Complete data profile for AI context */
export interface DataProfile {
    rowCount: number;
    columnCount: number;
    fields: FieldProfile[];
    /** AI-generated summary of the dataset */
    summary?: string;
    /** Potential data quality issues */
    cleaningSuggestions?: CleaningSuggestion[];
    /** When the profile was generated */
    generatedAt: Date;
}

/** Data cleaning suggestion */
export interface CleaningSuggestion {
    field: string;
    issue: 'missing_values' | 'mixed_types' | 'inconsistent_format' | 'outliers';
    description: string;
    severity: 'low' | 'medium' | 'high';
}

// ============================================
// Dashboard Configuration
// ============================================

/** Dashboard layout configuration */
export interface DashboardConfig {
    id: string;
    title?: string;
    charts: ChartConfig[];
    layout: DashboardLayout;
    createdAt: Date;
}

/** Dashboard grid layout */
export interface DashboardLayout {
    cols: number;
    rows: number;
    /** Position and size of each chart */
    items: DashboardLayoutItem[];
}

/** Position of a chart in the dashboard grid */
export interface DashboardLayoutItem {
    chartId: string;
    col: number;
    row: number;
    colSpan: number;
    rowSpan: number;
}

// ============================================
// Chart & Dashboard Summaries
// ============================================

/** AI-generated summary for a single chart */
export interface ChartSummary {
    id: string;
    chartId: string;
    summary: string;
    keyInsights: string[];
    generatedAt: Date;
    isLoading?: boolean;
}

/** AI-generated summary for an entire dashboard */
export interface DashboardSummary {
    id: string;
    dashboardId: string;
    overview: string;
    chartSummaries: ChartSummary[];
    keyTakeaways: string[];
    generatedAt: Date;
    isLoading?: boolean;
}

// ============================================
// UI State Types
// ============================================

/** Drag item for dnd-kit */
export interface DragItem {
    id: string;
    type: 'field' | 'encoding';
    field: FieldInfo;
    sourceChannel?: EncodingChannel;
}

/** View mode for the canvas */
export type CanvasViewMode = 'chart' | 'code';

/** Theme mode */
export type ThemeMode = 'light' | 'dark' | 'system';

// ============================================
// File Upload Types
// ============================================

/** Supported file types for import */
export type SupportedFileType = 'csv' | 'json' | 'tsv';

/** File upload status */
export interface UploadStatus {
    state: 'idle' | 'uploading' | 'processing' | 'complete' | 'error';
    progress: number;
    error?: string;
}

// ============================================
// Store Action Types (for Zustand)
// ============================================

export interface DataActions {
    loadData: (file: File) => Promise<void>;
    clearData: () => void;
}

export interface EncodingActions {
    addToShelf: (field: FieldInfo, channel: EncodingChannel) => void;
    removeFromShelf: (channel: EncodingChannel) => void;
    updateShelfConfig: (channel: EncodingChannel, config: Partial<ShelfPlacement>) => void;
    clearAllShelves: () => void;
    swapChannels: (from: EncodingChannel, to: EncodingChannel) => void;
}

export interface ChartActions {
    setMark: (mark: MarkType) => void;
    setTitle: (title: string) => void;
    setDimensions: (width: number, height: number) => void;
    resetChart: () => void;
}

export interface AIActions {
    processQuery: (query: string) => Promise<void>;
    applySuggestion: (suggestion: ChartSuggestion) => void;
    generateInsights: () => Promise<void>;
}
