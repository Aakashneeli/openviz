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
    | 'theta'   // For pie/donut chart values
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
    | 'distinct'
    // Advanced aggregations
    | 'variance'
    | 'stddev'
    | 'percent_of_total'
    | 'cumulative_sum';

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
// Vega-Lite Types
// ============================================

export type VegaLiteValueType = 'quantitative' | 'nominal' | 'ordinal' | 'temporal';

export interface VegaLiteFieldDef {
    field: string;
    type: VegaLiteValueType;
    aggregate?: AggregateFunction;
    bin?: boolean | { maxbins: number };
    timeUnit?: TimeUnit;
    sort?: 'ascending' | 'descending' | null;
    axis?: Record<string, unknown>;
    legend?: Record<string, unknown>;
}

export type VegaLiteMark = string | Record<string, unknown>;

export interface VegaLiteSpec {
    $schema: string;
    data: { values: DataRecord[] };
    mark: VegaLiteMark;
    encoding: Record<string, VegaLiteFieldDef | VegaLiteFieldDef[] | unknown>;
    width?: number | 'container';
    height?: number | 'container';
    title?: string;
    [key: string]: unknown;
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
    filterSpec?: FilterSpec;
    comparisonSpec?: ComparisonSpec;
    comparisonResult?: ComparisonResult;
    forecastResult?: ForecastResult;
    /** Signal to clear/delete the current chart in single-chart mode */
    deleteChart?: boolean;
    /** Which AI provider fulfilled this request */
    provider?: string;
}

/** AI intent classification */
export type AIIntent =
    | 'question'           // User asking a data question (e.g., "What's the average?")
    | 'chart'              // User requesting a single chart
    | 'dashboard'          // User requesting a multi-chart dashboard
    | 'modify'             // User modifying current chart (e.g., "Make it a line chart")
    | 'modify_dashboard'   // User modifying current dashboard (e.g., "Add a pie chart")
    | 'explain'            // User asking for explanation (e.g., "Why is sales down?")
    | 'filter'             // User wants to filter data (e.g., "Only show sales > 1000")
    | 'compare'            // User wants to compare groups (e.g., "Compare Q1 vs Q2")
    | 'forecast'           // User wants predictions (e.g., "Forecast next 6 months")
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
    /** User feedback on this message (thumbs up/down) */
    feedback?: 'positive' | 'negative';
    /** Which AI provider generated this response */
    provider?: string;
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
// Calculated Fields
// ============================================

/** A user-created or AI-created derived field */
export interface CalculatedField {
    id: string;
    name: string;
    formula: string;
    resultType: FieldType;
    referencedFields: string[];
    createdBy: 'user' | 'ai';
}

// ============================================
// Cross-Chart Filtering
// ============================================

/** Cross-filter applied from one chart to others in a dashboard */
export interface CrossFilter {
    sourceChartId: string;
    field: string;
    value: string | number | (string | number)[];
    operator: 'eq' | 'in';
}

// ============================================
// Drill-Down Navigation
// ============================================

/** Temporal hierarchy levels for drill-down */
export type TemporalDrillLevel = 'year' | 'quarter' | 'month' | 'week' | 'day';

/** Types of detectable drill hierarchies */
export type DrillHierarchyType = 'temporal' | 'categorical';

/** A single step in the drill path */
export interface DrillLevel {
    field: string;
    value: string | number;
    level: TemporalDrillLevel | string;
    label: string;
}

/** Detected hierarchy for a field */
export interface DrillHierarchy {
    type: DrillHierarchyType;
    sourceField: string;
    availableLevels: string[];
}

// ============================================
// Data Source Tracking (for refresh capability)
// ============================================

/** Tracks where the current dataset was loaded from */
export type DataSourceType = 'file' | 'url' | 'google-sheets' | 'sample';

export interface DataSourceInfo {
    type: DataSourceType;
    /** For URL sources */
    url?: string;
    /** For Google Sheets sources */
    spreadsheetId?: string;
    sheetName?: string;
    spreadsheetTitle?: string;
    /** When data was last fetched */
    lastFetchedAt: Date;
}

// ============================================
// Dashboard Configuration
// ============================================

/** Refresh interval options (in milliseconds) */
export type RefreshInterval = null | 60000 | 300000 | 900000 | 3600000;

/** Dashboard layout configuration */
export interface DashboardConfig {
    id: string;
    title?: string;
    charts: ChartConfig[];
    layout: DashboardLayout;
    createdAt: Date;
    refreshInterval?: RefreshInterval;
}

/** Saved dashboard wrapper with metadata */
export interface SavedDashboard {
    id: string;           // same as DashboardConfig.id
    config: DashboardConfig;
    updatedAt: Date;
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
// Dashboard Templates
// ============================================

/** A chart slot within a dashboard template, referencing an existing ChartTemplate by ID */
export interface DashboardTemplateChartSlot {
    /** References a ChartTemplate.id from chartTemplates.ts */
    chartTemplateId: string;
    /** Suggested title for this chart in the dashboard */
    suggestedTitle: string;
    /** Grid position and span */
    layout: {
        col: number;
        row: number;
        colSpan: number;
        rowSpan: number;
    };
}

/** A pre-built dashboard template with multiple chart slots */
export interface DashboardTemplate {
    id: string;
    name: string;
    description: string;
    category: 'sales' | 'marketing' | 'operations' | 'finance' | 'general';
    /** Chart slots to populate */
    chartSlots: DashboardTemplateChartSlot[];
    /** Number of grid columns (typically 2) */
    cols: number;
    /** Lucide icon name for the gallery */
    icon: string;
    /** Tags for search */
    tags: string[];
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

// ============================================
// Chart Recommendations
// ============================================

export interface ChartRecommendation {
    id: string;
    mark: MarkType;
    xField: string;
    yField: string;
    colorField?: string;
    score: number;
    reason: string;
}

// ============================================
// Data Filtering
// ============================================

export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'notContains' | 'in' | 'notIn' | 'between';

export interface FilterCondition {
    field: string;
    operator: FilterOperator;
    value: unknown;
    /** For 'between' operator */
    valueTo?: unknown;
}

export interface FilterSpec {
    conditions: FilterCondition[];
    logic: 'and' | 'or';
}

// ============================================
// Report Generation
// ============================================

export interface ReportSection {
    type: 'executive_summary' | 'data_overview' | 'chart_narrative' | 'key_findings';
    title: string;
    content: string;
    enabled: boolean;
}

export interface ReportData {
    title: string;
    sections: ReportSection[];
    generatedAt: Date;
    datasetName: string;
}

// ============================================
// Comparison Mode
// ============================================

export type ComparisonType = 'category' | 'time_period' | 'metric';

export interface ComparisonSpec {
    type: ComparisonType;
    groupField: string;
    groupValues: [string, string];
    metricField: string;
    aggregate: AggregateFunction;
}

export interface ComparisonResult {
    spec: ComparisonSpec;
    groupA: { label: string; value: number; breakdown?: Record<string, number> };
    groupB: { label: string; value: number; breakdown?: Record<string, number> };
    difference: number;
    percentChange: number;
    summary: string;
}

// ============================================
// Predictive Analytics (Forecasting)
// ============================================

export interface ForecastPoint {
    x: string | number;
    y: number;
    lower?: number;
    upper?: number;
}

export interface ForecastResult {
    method: 'linear' | 'exponential_smoothing' | 'holts_linear';
    periods: number;
    points: ForecastPoint[];
    accuracy?: number;
    temporalField: string;
    metricField: string;
}

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
