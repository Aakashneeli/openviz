# OpenViz Project Overview

> **System Memory Document**
> *This document serves as the primary source of truth for the OpenViz project. It details the architecture, feature set, AI integration, and development standards. AI agents should read this file to understand the context before making changes.*
>
> **Last Updated**: February 15, 2026

---

## 1. Project Identity

**OpenViz** is a modern, web-based data visualization and analytics platform that bridges the gap between manual chart creation and AI-assisted insights. It empowers users to explore datasets through natural language conversations ("Show me sales by region") or via precision drag-and-drop controls, all powered by the **Vega-Lite** grammar.

### Core Philosophy
- **Zero-Friction**: Users shouldn't need to know data types or chart grammars.
- **Hybrid Control**: Seamless switching between AI automation and manual fine-tuning.
- **Visual Excellence**: Premium, dark-mode-first UI with fluid animations.

---

## 2. Technical Stack & Architecture

### High-Level Stack
| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.2.0 | UI Framework |
| **TypeScript** | 5.9.3 | Type Safety |
| **Vite** | 7.2.4 | Build Tool & Dev Server |
| **Tailwind CSS** | 4.1.18 | Utility-First Styling |
| **Zustand** | 5.0.9 | State Management (with DevTools) |
| **Vega-Lite** | 6.4.1 | High-Level Chart Grammar |
| **react-vega** | 8.0.0 | React Vega Integration |
| **vega-embed** | 7.1.0 | Embedding & Interactivity |
| **react-echarts** | 5.6.0 | **Primary Chart Renderer** (New) |
| **Groq SDK** | 0.37.0 | Ultra-fast AI Inference |
| **Arquero** | 8.0.3 | Data Transformation & Querying |
| **PapaParse** | 5.5.3 | CSV/TSV Parsing |
| **date-fns** | 4.1.0 | Date Parsing & Formatting |
| **@dnd-kit** | 6.3.1 | Drag-and-Drop System |
| **Radix UI** | Various | Accessible UI Primitives |
| **Lucide React** | 0.562.0 | Icon Library |

### Directory Structure
```
openviz/
├── frontend/                    # React + Vite application
│   ├── src/
│   │   ├── components/
│   │   │   ├── ai/              # Chat interface, Query bar
│   │   │   │   ├── AIChat.tsx
│   │   │   │   └── AIQueryBar.tsx
│   │   │   ├── canvas/          # Chart rendering area
│   │   │   │   ├── Canvas.tsx
│   │   │   │   ├── VizPreview.tsx
│   │   │   │   ├── DashboardGrid.tsx
│   │   │   │   └── CodeEditor.tsx
│   │   │   ├── data-shelf/      # Left sidebar field list & dashboard browser
│   │   │   │   ├── DataShelf.tsx
│   │   │   │   └── DashboardList.tsx
│   │   │   ├── encoding-deck/   # Right sidebar channel mapping
│   │   │   ├── layout/          # App shell and structure
│   │   │   └── ui/              # Reusable UI primitives
│   │   ├── store/
│   │   │   └── useVizStore.ts   # Central Zustand store
│   │   ├── hooks/               # Custom React hooks
│   │   ├── lib/
│   │   │   └── utils.ts         # Utility functions
│   │   ├── assets/              # Static assets
│   │   ├── App.tsx              # Root component
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.tsx             # Entry point
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── tsconfig.app.json
│
├── backend/                     # Shared services & logic (bundled by frontend)
│   ├── services/
│   │   ├── groqService.ts       # AI/LLM communication layer
│   │   └── dataContextService.ts # Statistical profiling, query execution
│   ├── types/
│   │   └── index.ts             # Complete TypeScript type definitions
│   ├── utils/
│   │   ├── autoChart.ts         # Heuristics for chart selection
│   │   ├── schemaInference.ts   # Type detection
│   │   └── vegaSpecBuilder.ts   # Vega-Lite JSON builder
│   ├── package.json
│   └── tsconfig.json
│
├── package.json                 # Root workspace scripts
├── .env                         # Environment variables
├── README.md
├── project_overview.md          # This document
└── tsconfig.json                # Root TS config
```

**Import Aliases:**
- `@/*` → `frontend/src/*` (frontend-internal imports)
- `@backend/*` → `backend/*` (cross-package imports)

### State Management (`useVizStore.ts`)
The entire application state is centralized in a single Zustand store with DevTools integration. This enables features like global Undo/Redo and seamless serialization.

**State Slices:**
- **Data Slice**: Raw data (`dataset`), inferred schema (`fields`), `uploadStatus`, and `dataProfile`.
- **Encoding Slice**: Array of `ShelfPlacement` objects mapping `Field -> Channel`.
- **Chart Slice**: High-level config (`chartConfig`), generated `echartsOption`, mark type, title.
- **Dashboard Slice**: `dashboardConfig` for multi-chart layouts, `savedDashboards` array (persisted to localStorage), `viewMode` (single/dashboard), `editingChartId`.
- **AI Slice**: `aiQuery`, `aiLoading`, `aiSuggestions`, `aiInsights`, `aiChatHistory`, `aiFocusedChartId`.
- **UI Slice**: `canvasView`, `leftSidebarOpen`, `rightSidebarOpen`, `selectedFieldId`, `isDragging`.
- **History Slice**: `past` and `future` arrays for undo/redo functionality.

**Key Actions:**
- `loadDataFromFile(file)` - Parse and profile uploaded data
- `addToShelf(field, channel)` - Map field to encoding channel
- `processAIQuery(query)` - Process natural language with intent detection
- `undo()` / `redo()` - History navigation
- `setViewMode('single' | 'dashboard')` - Toggle between views
- `editChartFromDashboard(id)` - Edit specific chart
- `updateChartInDashboard(id)` - Sync edits back to dashboard
- `saveDashboard()` - Auto-save current dashboard to localStorage
- `loadDashboard(id)` - Load saved dashboard from list
- `deleteSavedDashboard(id)` - Permanently remove saved dashboard
- `closeDashboard()` - Save + deactivate dashboard, return to clean single view
- `openChatForChart(chartId)` - Open AI chat scoped to a specific dashboard chart
- `clearChatFocus()` - Return AI chat to general mode

---

## 3. Data Flow & Core Mechanics

### 3.1. The Ingestion Pipeline
1. **Upload**: User drops a CSV/JSON file.
2. **Parsing**: `PapaParse` reads the raw text.
3. **Inference**: `schemaInference.ts` analyzes columns to assign types:
   - `quantitative` (Numbers)
   - `nominal` (Categories, Strings)
   - `temporal` (Dates)
   - `ordinal` (Ranked data)
4. **Semantic Detection**: `detectSemanticType()` identifies richer field semantics:
   - `email`, `phone`, `url`, `currency`, `percentage`, `countryCode`, `zipCode`, `generic`
5. **Profiling**: `dataContextService.ts` calculates stats (min, max, mean, unique values) using `Arquero`.
6. **Store Update**: The processed dataset, schema, and `DataProfile` are saved to `useVizStore`.

### 3.2. Visual Encoding (The "Deck")
Instead of writing code, users drag fields from the **Data Shelf** to the **Encoding Deck**.
- **Logic**: When a field is dropped on the "X-Axis" zone, a `ShelfPlacement` is added to the store.
- **Compilation**: `echartsSpecBuilder.ts` (conceptual) listens to store changes. It iterates through all active encodings and constructs a valid ECharts option object.
- **Rendering**: The option is passed to `echarts-for-react` which renders the Canvas interactions.

---

## 4. AI Features Architecture

OpenViz uses a **Context-Aware RAG** (Retrieval-Augmented Generation) approach, optimized for small data contexts without a vector DB.

### 4.1. The AI Service (`groqService.ts`)
We use **Groq** for ultra-low latency inference, crucial for the "real-time" feel. Supports multi-provider fallback (Groq, OpenAI, Anthropic) via `AIProviderManager`.

**Configuration:**
- **Model**: Llama 4 Maverick 17B (`meta-llama/llama-4-maverick-17b-128e-instruct`)
- **API Key**: `VITE_GROQ_API_KEY` (environment variable)
- **Provider Fallback**: `VITE_AI_PROVIDER_ORDER` (optional, e.g., "groq,anthropic,openai")

**Core Functions:**
| Function | Purpose |
|----------|---------|
| `detectIntent(query, ...)` | LLM-based intent classification with **reasoning** and **disambiguation rules** |
| `processAIQuery(...)` | Main entry point — routes intents, intercepts delete requests |
| `processAIQueryStreaming(...)` | Streaming version — text intents stream via SSE, others fall back to regular |
| `processDataQuestion(...)` | Q&A with Arquero stats, field list, few-shot examples, `json_object` response format |
| `processChartRequest(...)` | Chart generation with **few-shot examples**, vague query defaults, field name enforcement |
| `processModifyRequest(...)` | Chart modification with **preservation rules**, low temperature (0.15), few-shot examples |
| `processDashboardRequest(...)` | Dashboard generation with chart type guide, design rules, retry context hints |
| `processModifyDashboardRequest(...)` | Add/remove/replace charts, **direct delete-by-ID** for focused charts |
| `processFilterRequest(...)` | Parse natural language filter conditions |
| `processCompareRequest(...)` | Compare two groups/periods with grouped bar chart output |
| `processForecastRequest(...)` | Time-series forecasting with linear regression |
| `processExplainRequest(...)` | "Why?" questions with streaming analysis |
| `findFieldFuzzy(name, fields)` | **Shared** scored field matching (7-tier: exact→normalized→startsWith→word→substring) |
| `generateDataInsights(...)` | Heuristic + AI insight generation |
| `generateChartSummary(...)` | Generate AI summary for a chart |
| `formatChartContext(...)` | Helper to describe current chart to AI |
| `formatDashboardContext(...)` | Helper to describe entire dashboard to AI |
| `formatFocusedChartContext(...)` | Detailed context for a specific focused chart in a dashboard |

### 4.2. Intent Classification
The AI detects user intent to route queries appropriately. All responses include **reasoning** for transparency. Intent detection uses LLM classification with explicit **disambiguation rules** and a **fallback regex** pattern matcher.

| Intent | Description | Example |
|--------|-------------|---------|
| `question` | Data Q&A (text answer) | "What is the average age?" |
| `chart` | Create single chart | "Show sales by region" |
| `dashboard` | Create multi-chart view | "Give me a sales overview dashboard" |
| `modify` | Edit current chart (Size, Color, Type, etc.) | "Make it bigger", "Change colors to blue" |
| `modify_dashboard` | Edit current dashboard (Add/Remove/Replace) | "Remove all charts", "Add a pie chart", "Delete this chart" |
| `explain` | Analysis request | "Why are sales down in March?" |
| `filter` | Filter data subset | "Only show sales > 1000", "Filter to USA" |
| `compare` | Compare groups/periods | "Compare Q1 vs Q2", "East vs West sales" |
| `forecast` | Predictions/projections | "Forecast next 6 months" |

**Disambiguation Rules** (applied in order):
1. "delete"/"remove" + dashboard exists → always `modify_dashboard`
2. Specific chart type name without "make it"/"change" → always `chart`
3. "show me"/"visualize" + field refs → `chart` (not question)
4. "What is"/"how much"/"average" → `question` (not chart)
5. No current chart → never `modify`; no dashboard → never `modify_dashboard`
6. "compare"/"vs" → prefer `compare`; "filter"/"where" → prefer `filter`

**Delete Chart Handling:**
- **Dashboard mode**: Delete requests on focused charts are intercepted before intent routing, directly removing the chart by ID (no LLM call). Falls back to LLM-based `modify_dashboard` with remove action for index-based deletion.
- **Single chart mode**: Delete requests return `deleteChart: true` flag, which the store handles by calling `resetChart()` with undo support.

### 4.3. Field Matching (`findFieldFuzzy`)
All AI handlers use a shared scored field matching utility instead of first-match-wins:
| Score | Match Type | Example |
|-------|-----------|---------|
| 100 | Exact (case-insensitive) | "Revenue" = "revenue" |
| 90 | Normalized (ignore separators) | "sales amount" = "Sales_Amount" |
| 80 | Field starts with input | "Rev" → "Revenue" |
| 75 | Input starts with field | "Revenue Total" → "Revenue" |
| 70 | Whole word in field | "sales" → "Total_Sales_Amount" |
| 60 | Substring match | "sale" → "Sales_Amount" |
| 50 | Reverse substring | "Sales_Amount" → "sales" |
| 30-50 | Word-level partial | Scored by proportion of matching words |

### 4.4. Context Injection Strategy
To make the AI "smart" about the user's specific file, we inject a high-density **Data Profile** into the system prompt. The `formatProfileForLLM()` function generates a structured context string with:
- **Field type summary**: Groups fields by type (Numeric, Categorical, Temporal) for quick LLM orientation
- **Field details**: Stats for quantitative fields, date ranges for temporal, example values (up to 5) for categorical
- **Data quality notes**: Cleaning suggestions when applicable

```
Dataset: 1000 rows, 5 columns

Field Type Summary:
  Numeric: Revenue, Units
  Categorical: Region, Category
  Temporal: Date

Field Details:
- "Revenue" (quantitative): min=100, max=5000, mean=2500.00
- "Region" (nominal): 4 unique values (e.g., North, South, East, West, Central)
- "Date" (temporal): 2024-01-01 to 2024-12-31
```
*Note: We DO NOT send the entire dataset to the LLM to preserve privacy and token limits. We only send the metadata/statistics.*

### 4.5. Data Context Service (`dataContextService.ts`)
| Function | Purpose |
|----------|---------|
| `generateDataProfile(data, fields)` | Create comprehensive profile for AI |
| `generateFieldProfile(field, table, data)` | Stats for individual field |
| `detectDataIssues(fields, data)` | Find data quality problems |
| `executeDataQuery(data, query)` | Run structured queries with Arquero |
| `formatProfileForLLM(profile)` | Format profile with field type grouping and example values |

---

## 5. Key Features

### 💻 Hybrid Editor
- **Visual Mode**: Drag-and-drop builder for non-technical users.
- **Code Mode**: Direct access to the ECharts option JSON (View-only for now).
- **AI Mode**: Conversational interface to manipulate the chart.

### 📊 Dashboard Engine
- **Single View**: Focus on one chart for deep analysis.
- **Dashboard View**: Grid-based layout engine allowing up to 20 charts.
- **Auto-Suggest**: "Magic" button to automatically add interesting charts based on data context.
- **Smart Layout**: Auto-scrolls and adjusts grid based on number of charts.
- **Persistence**: Dashboards automatically save to browser localStorage on every change.
- **Dashboard Browser**: Collapsible panel in left sidebar lists all saved dashboards with chart count and last updated timestamp. Only visible when a dataset is loaded.
- **Quick Access**: Click any saved dashboard to instantly reload it with all charts intact.
- **Clean Lifecycle**: `closeDashboard()` saves and deactivates (separate from `setViewMode` which is used for chart editing round-trips). New data upload clears stale dashboards.
- **Breadcrumb Navigation**: When editing a chart from a dashboard, a context bar shows "← Dashboard Name > Editing chart" above the canvas header.

### 🤖 Per-Chart AI Chat (Phase 2.7 - NEW)
- **Chart-Scoped AI**: Each chart in a dashboard has a sparkle button that opens the AI chat focused on that specific chart.
- **Focus Banner**: Amber-colored banner in the chat panel shows the focused chart's name, type, and primary field.
- **Context-Aware Suggestions**: Chat suggestions adapt to the focused chart (e.g., "What insights can you see in Sales Chart?", "Change to a line chart").
- **In-Place Modifications**: AI modifications update the specific chart within the dashboard, not create a new one.
- **Maximized View Support**: When a chart is opened in full single-view editing mode (via "Edit" button), the AI chat automatically scopes to that chart. Modifications update both the live preview and the dashboard simultaneously.
- **Focus Indicator**: Amber pulse dot on the collapsed chat button when a chart is focused.
- **Clear Focus**: X button on the focus banner returns to general chat mode. Focus auto-clears when returning to dashboard grid.

### 🎨 Design System
- **Theme**: "Deep Space" Dark Mode (Zinc-950 backgrounds, Indigo-500/Purple-500 accents).
- **Components**: Built on headless Radix UI primitives for accessibility, styled with Tailwind.
- **Glassmorphism**: Sidebars use `bg-black/40 backdrop-blur-md` for depth.
- **Motion**: Fluid transitions for layout shifts and chart updates.

### ⚡ Smart Chart Controls
- **Dynamic Titles**: Double-click to rename charts instantly.
- **Action Toolbar**: Clear chart, Edit in Single View, Duplicate, and Delete controls.
- **Auto-Aggregation**: Qualitative fields are automatically summed/counted to prevent "hairball" charts.

### ⚡ Auto-Chart & History
- **Smart Defaults**: `autoChart.ts` selects appropriate chart types based on field types.
- **Undo/Redo**: Every action pushes to history stack via Zustand middleware.

### 🔍 Smart Data Profiler 2.0 (Phase 1)
- **Semantic Type Detection**: Automatically identifies field semantics (email, phone, URL, currency, etc.) using regex patterns.
- **Visual Badges**: Data Shelf displays semantic type badges with appropriate icons (Mail, Phone, Link, etc.).
- **Enhanced Field Info**: `FieldInfo` interface includes optional `semanticType` property.

### 👁️ Transparency Mode (Phase 1)
- **"Peek Code" Feature**: AI-generated charts display collapsible ECharts option viewer in chat.
- **Syntax Highlighting**: Custom JSON syntax highlighter without external dependencies.
- **Copy to Clipboard**: One-click copy of generated chart configurations.
- **Collapsible UI**: `CodePreview` component with smooth expand/collapse animations.

### 🎯 Enhanced Data Shelf (Phase 1)
- **Ghost Drag Preview**: Dragged fields show floating overlay with indigo glow effect.
- **Semantic Icons**: Fields display context-aware icons based on detected semantic type.
- **Smooth Animations**: Framer Motion-powered drag interactions with physics-based effects.

### ✨ Smart Annotations (Phase 2.1) - NEW!
- **Automatic Outlier Detection**: Z-score based statistical analysis (threshold: 2σ) identifies anomalies in quantitative data.
- **Extreme Value Markers**: Automatic detection and highlighting of maximum and minimum data points.
- **Visual Annotations**: ECharts markPoint/markLine integration with color-coded pins:
  - 🟢 Green pins for maximum values ("Peak")
  - 🔴 Red inverted pins for minimum values ("Low")
  - 🟠 Orange circles for outliers with Z-score labels
  - 🟣 Purple dashed line showing average value
- **Smart Limiting**: Maximum 5 annotations per chart to prevent visual clutter.
- **UI Toggle**: "Insights" button with Sparkles icon to show/hide annotations dynamically.
- **State Management**: `showAnnotations` boolean in store with `toggleAnnotations()` action.

---

## 6. Type System Summary

### Core Types (`types/index.ts` - 636 lines)
```typescript
// Field Classification
type FieldType = 'nominal' | 'quantitative' | 'temporal' | 'ordinal';

// Semantic Type Classification (Phase 1)
type SemanticType = 'email' | 'phone' | 'url' | 'currency' | 'percentage' | 'countryCode' | 'zipCode' | 'generic';

// Encoding Channels (includes theta for pie/donut)
type EncodingChannel = 'x' | 'y' | 'theta' | 'color' | 'size' | 'shape' | 'tooltip' | 'row' | 'column';

// Chart Marks (Expanded for ECharts)
type MarkType = 'bar' | 'line' | 'point' | 'area' | 'arc' | 'boxplot' | 'candlestick' | 'histogram'
  | 'treemap' | 'sunburst' | 'tree' | 'sankey' | 'graph' | 'radar' | 'heatmap' | 'funnel' | 'gauge'
  | 'parallel' | 'waterfall' | 'calendar' | 'pictorialBar' | 'rect' | 'rule' | 'text' | 'tick' | 'auto';

// AI Intent Classification (expanded with filter, compare, forecast)
type AIIntent = 'question' | 'chart' | 'dashboard' | 'modify' | 'modify_dashboard'
  | 'explain' | 'filter' | 'compare' | 'forecast' | 'unknown';

// Annotation Types (Phase 2.1 - Smart Annotations)
interface Annotation { type: 'outlier' | 'max' | 'min' | 'trend', dataIndex, value, label, coord? }

// Key Interfaces
interface FieldInfo { id, name, type, semanticType?, stats, sparklineData }
interface Dataset { id, name, fields, rowCount, data, uploadedAt }
interface ShelfPlacement { id, field, channel, aggregate?, bin?, timeUnit?, sort? }
interface ChartConfig { id, title?, mark, encodings, width, height, interactive?, fixedColor?, annotations? }
interface DashboardConfig { id, title?, charts, layout, createdAt, refreshInterval? }
interface SavedDashboard { id, config: DashboardConfig, updatedAt: Date }  // localStorage wrapper
interface DataProfile { rowCount, columnCount, fields, summary?, cleaningSuggestions?, generatedAt }
interface AIQueryResult { query, intent, chartConfig?, dashboardConfig?, textAnswer?, insights?, error?,
  filterSpec?, comparisonSpec?, comparisonResult?, forecastResult?, deleteChart?, provider? }
interface AIMessage { id, role, content, timestamp, resultType?, chartConfig?, echartsOption?, feedback?, provider? }
```

---

## 7. Development Roadmap & Status
*(Based on `IMPLEMENTATION_PLAN.md`)*

### ✅ Phase 1: Core Foundation & Trust (Completed Jan 2026)
- **1.1 Smart Data Profiler 2.0**: Semantic type detection (Email, URL, Currency, etc.)
- **1.2 Transparency Mode**: "Peek Code" to view/copy AI-generated ECharts options.
- **1.3 Enhanced Data Shelf**: Semantic badges and ghost-drag interactions.

### 🚧 Phase 2: The "Thinking" Canvas (In Progress - Jan 2026)

#### ✅ 2.3 Smart Annotations (Completed Jan 18, 2026)
**Implementation Details:**
- **Backend Services**: Created `annotationService.ts` with statistical analysis functions
  - `detectOutliers()`: Z-score based outlier detection (configurable threshold)
  - `detectExtremes()`: Max/min value identification
  - `generateAnnotations()`: Combined annotation generation with smart limiting
  - `calculateTrendLine()`: Linear regression for future trend analysis
- **ECharts Integration**: Extended `echartsOptionBuilder.ts` with annotation rendering
  - `buildMarkPoint()`: Converts annotations to visual markers (pins, circles)
  - `buildMarkLine()`: Adds average/trend lines to charts
  - Color-coded markers: Green (max), Red (min), Orange (outliers), Purple (average)
- **AI Integration**: Enhanced `groqService.ts` to auto-generate annotations
  - Automatic detection in `processChartRequest()` for quantitative Y-axis charts
  - X-axis coordinate positioning for accurate placement
  - Graceful error handling (annotations won't break chart creation)
- **State Management**: Added `showAnnotations` boolean to `useVizStore`
  - `toggleAnnotations()` action for dynamic show/hide
  - Integrated with `regenerateSpec()` for live updates
- **UI Components**: "Insights" toggle button in `Canvas.tsx`
  - Sparkles icon with animated pulse effect when active
  - Purple glow styling for active state
  - Tooltip: "Toggle Smart Annotations (outliers, max/min)"

**Files Modified/Created:**
- ✅ `backend/services/annotationService.ts` (210 lines) - NEW
- ✅ `backend/types/index.ts` (+7 lines) - Added `Annotation` interface
- ✅ `backend/utils/echartsOptionBuilder.ts` (+73 lines) - Annotation helpers
- ✅ `backend/services/groqService.ts` (+35 lines) - AI annotation generation
- ✅ `frontend/src/store/useVizStore.ts` (+15 lines) - State + toggle action
- ✅ `frontend/src/components/canvas/Canvas.tsx` (+15 lines) - UI toggle

#### 📅 2.2 Dashboard Templates (Next - Hybrid Approach)
**Status**: Ready to start after Smart Annotations
**Architecture Decision**: Hybrid system (Templates + AI fallback)
- **Template Registry**: Pre-built layouts for common use cases
  - SaaS KPI Dashboard (MRR, churn, growth metrics)
  - Sales Overview (pipeline, deals, quota tracking)
  - HR Headcount (hiring trends, department breakdown)
  - Finance P&L (revenue, expenses, profit margins)
  - Marketing Funnel (conversion rates, CAC, LTV)
- **Smart Matching**: Keyword-based template detection with 0.3 confidence threshold
- **Field Mapping**: Automatic field-to-slot assignment using type constraints
- **AI Fallback**: Use existing AI generation when no template matches

**Implementation Plan:**
1. Create `backend/types/templates.ts` with `DashboardTemplate` and `TemplateSlot` interfaces
2. Build `backend/templates/registry.ts` with 5 core templates
3. Implement `backend/services/templateService.ts` for matching and mapping logic
4. Integrate with `groqService.processDashboardRequest()` (template-first, AI-second)

#### 📅 2.1 Data Painter (Deferred to Sprint 2)
**Status**: Blocked by UX design decisions
**Reason**: Requires design finalization for InsightToast placement, brush styling, and insight formulas

#### ✅ 2.4 PDF Export (Completed Jan 27, 2026)
**Implementation Details:**
- **Export Service**: Created `frontend/src/services/exportService.ts` with PDF generation
  - `exportChartToPDF()`: Exports single chart canvas to PDF
  - `exportDashboardToPDF()`: Exports all charts (2 per page) with title
  - Uses **jsPDF directly** with `canvas.toDataURL()` (bypasses html2canvas)
  - Avoids CSS color parsing issues (`oklab()` not supported by html2canvas)
- **Single Chart Export**: Download button in `Canvas.tsx` header
  - Shows loading spinner during export
  - Captures ECharts canvas element directly
- **Dashboard Export**: "Export PDF" button in `DashboardGrid.tsx` toolbar
  - Exports each chart canvas to PDF pages (2 charts per page)
  - Disabled when no charts present

**Files Created/Modified:**
- ✅ `frontend/src/services/exportService.ts` (150 lines) - NEW (jsPDF-based)
- ✅ `frontend/src/components/canvas/Canvas.tsx` (+25 lines) - PDF export button
- ✅ `frontend/src/components/canvas/DashboardGrid.tsx` (+30 lines) - PDF export

#### ✅ 2.5 AI Dashboard Variety Fix (Completed Jan 27, 2026)
**Problem**: When user asked for "dashboard with variety of charts", the AI created one chart at a time instead of multiple charts at once.

**Root Cause**: Intent detection was triggering `modify_dashboard` (add one chart) instead of `dashboard` (create fresh with multiple charts) when a dashboard already existed.

**Fix Applied:**
- Enhanced intent detection prompt to recognize variety/multiple keywords
- Updated code-level parsing to distinguish fresh dashboard vs modify requests
- Keywords that now trigger fresh dashboard: `variety`, `multiple`, `several`, `different types`, `collection of`

**Files Modified:**
- ✅ `backend/services/groqService.ts` - Enhanced `detectIntent()` prompt and parsing logic

#### ✅ 2.6 Dashboard Persistence & Browser (Completed Jan 28, 2026)
**Problem**: Users lost all dashboard work when closing the view or refreshing the page. No way to manage multiple dashboards.

**Solution**: Implemented automatic localStorage persistence with a dashboard browser panel in the left sidebar.

**Implementation Details:**
- **localStorage Integration**: All dashboards auto-save to browser storage (`openviz-dashboards` key)
  - Auto-save triggers on: create, rename, add chart, remove chart, update chart
  - Revives Date objects on load for accurate timestamps
  - Graceful error handling for storage failures
- **SavedDashboard Type**: New wrapper interface with metadata (id, config, updatedAt)
- **Dashboard Browser Panel**: `DashboardList.tsx` component in left sidebar
  - Collapsible section below Data Shelf with dashboard count badge
  - List view with titles, chart counts, and relative timestamps (e.g., "3h ago", "2d ago")
  - Click-to-load functionality switches to dashboard view instantly
  - Delete with confirmation (requires 2 clicks to prevent accidents)
  - Active dashboard highlighted with indigo accent
  - "New Dashboard" button at top
  - Empty state message when no saved dashboards
- **Improved Close Behavior**: DashboardGrid X button now hides (not deletes) dashboard
  - Close button calls `setViewMode('single')` to preserve dashboard
  - Separate Trash2 button for permanent deletion
  - Deleted dashboards are removed from both active state and localStorage
- **State Management**:
  - Added `savedDashboards: SavedDashboard[]` to store
  - `saveDashboard()` - upserts to array and localStorage
  - `loadDashboard(id)` - loads saved config and switches view
  - `deleteSavedDashboard(id)` - removes from storage and state
  - `selectSavedDashboards` selector for component access

**Files Created/Modified:**
- ✅ `backend/types/index.ts` (+5 lines) - Added `SavedDashboard` interface
- ✅ `frontend/src/store/useVizStore.ts` (+85 lines) - localStorage persistence + new actions
- ✅ `frontend/src/components/data-shelf/DashboardList.tsx` (150 lines) - NEW browser panel
- ✅ `frontend/src/components/layout/AppLayout.tsx` (+3 lines) - Added DashboardList to sidebar
- ✅ `frontend/src/components/canvas/DashboardGrid.tsx` (+2 lines) - Changed close button behavior

**User Benefits:**
- ✅ Dashboards survive page refreshes automatically
- ✅ Work on multiple dashboards and switch between them
- ✅ Visual timeline of recent work with timestamps
- ✅ One-click dashboard access from sidebar
- ✅ Safe deletion with confirmation step

#### ✅ 2.7 Dashboard Flow & Navigation Fixes (Completed Jan 28, 2026)
**Problem**: Dashboard lifecycle was confusing — closing a dashboard and creating a new one broke, stale dashboards from previous data persisted after page reload, and there was no visual indicator of where the user was in the editing flow.

**Fixes Applied:**
- **`closeDashboard()` action**: New dedicated action (separate from `setViewMode`) that saves the dashboard, nullifies `dashboardConfig`, and resets to clean single-chart state. Used by the X button in DashboardGrid.
- **`setViewMode('single')` preserved as lightweight toggle**: Used only during chart editing round-trips — keeps the dashboard in memory while editing a chart from it.
- **Stale dashboard cleanup**: `loadDataFromFile()` now clears `savedDashboards` from both state and localStorage when new data is uploaded, preventing stale dashboards with invalid field references.
- **Data-aware DashboardList**: The dashboard panel returns `null` (hidden) when no dataset is loaded. All hooks are called before this conditional return to comply with React's Rules of Hooks.
- **Breadcrumb navigation bar**: When editing a chart from a dashboard (`editingChartId` is set), Canvas.tsx shows a breadcrumb bar: "← Dashboard Name > Editing chart" with a back button that syncs changes.
- **`createDashboard()` saves previous**: Before creating a new dashboard, any existing active dashboard is saved first. Single-chart state is reset to prevent stale encodings.
- **`removeChartFromDashboard` no longer auto-deletes**: Removing the last chart keeps the dashboard alive (just empty). Users must explicitly delete.

**Files Modified:**
- ✅ `frontend/src/store/useVizStore.ts` - Added `closeDashboard()`, fixed `createDashboard()`, `loadDashboard()`, `syncAndReturnToDashboard()`, `removeChartFromDashboard()`, `loadDataFromFile()`
- ✅ `frontend/src/components/canvas/DashboardGrid.tsx` - Close buttons use `closeDashboard()`, handleManualAdd bypasses close
- ✅ `frontend/src/components/canvas/Canvas.tsx` - Added breadcrumb navigation bar with ArrowLeft back button
- ✅ `frontend/src/components/data-shelf/DashboardList.tsx` - Hidden when no dataset, hooks before conditional return

#### ✅ 2.8 Per-Chart AI Chat Focus (Completed Jan 28, 2026)
**Problem**: The AI chatbot had no concept of which chart the user wanted to interact with. In a dashboard with multiple charts, the AI couldn't target modifications or answer questions about a specific chart.

**Solution**: Added chart-scoped AI chat that works in both the dashboard grid view and the maximized single-chart editing view.

**Implementation Details:**
- **Store State**: Added `aiFocusedChartId: string | null` to track which chart the AI is scoped to
- **New Actions**:
  - `openChatForChart(chartId)` — sets focus, clears chat history for fresh context, opens chat panel
  - `clearChatFocus()` — removes chart focus, returns to general mode
- **Dashboard Grid Integration**: Each chart card has a sparkle (AI) button in the hover toolbar that calls `openChatForChart(chart.id)`
- **Maximized View Integration**: `editChartFromDashboard(chartId)` now also sets `aiFocusedChartId` so the AI is automatically scoped to the chart being edited in full view
- **AI Processing Changes** (`processAIQuery` in store):
  - When `aiFocusedChartId` is set, the focused chart's encodings/mark/title are passed to the AI instead of single-view state
  - AI modifications update the specific chart in `dashboardConfig.charts` (not add a new one)
  - When the chart is maximized (`editingChartId === focusId`), also updates `chartConfig`, `encodings`, and calls `regenerateSpec()` so the live preview updates immediately
  - Includes generated `echartsOption` in chat message for transparency mode
- **Groq Service Changes** (`groqService.ts`):
  - `processAIQuery()` accepts optional `focusedChartId` parameter
  - New `formatFocusedChartContext()` helper generates detailed context string marked "FOCUSED CHART" with chart type, title, all encoding channels, and field descriptions
  - Focused context is used instead of generic chart context when answering questions
- **AI Chat UI** (`AIChat.tsx`):
  - Amber focus banner below header showing chart name, type, and Y-axis field with X button to clear
  - Context-aware suggestions tailored to the focused chart (e.g., "What insights can you see?", "Change to a line chart", "What's the trend for Revenue?")
  - Context-aware empty state with chart-specific welcome message
  - Context-aware placeholder text (e.g., "Ask about 'Sales by Region'...")
  - Amber pulse dot on collapsed chat FAB when a chart is focused
  - Dashboard-level suggestions when in dashboard view without chart focus
- **Focus Lifecycle**:
  - Set on: sparkle button click in dashboard grid, or chart edit/maximize from dashboard
  - Cleared on: X button in focus banner, or `syncAndReturnToDashboard()` (back to grid)
  - Preserved on: chat minimize/reopen (focus persists across chat open/close)

**Files Created/Modified:**
- ✅ `frontend/src/store/useVizStore.ts` (+60 lines) - `aiFocusedChartId` state, `openChatForChart`, `clearChatFocus`, context-aware `processAIQuery`, focused chart update logic for both grid and maximized views
- ✅ `backend/services/groqService.ts` (+45 lines) - `focusedChartId` parameter, `formatFocusedChartContext()` helper
- ✅ `frontend/src/components/ai/AIChat.tsx` (rewritten, 350 lines) - Focus banner, context-aware suggestions/placeholder/empty state, focus indicator dot
- ✅ `frontend/src/components/canvas/DashboardGrid.tsx` (+10 lines) - `onAskAI` prop, sparkle button on chart cards, `openChatForChart` wiring

**User Benefits:**
- ✅ Click sparkle on any chart card to get AI help for that specific chart
- ✅ Maximizing a chart auto-scopes AI to that chart
- ✅ AI modifications target the correct chart (no accidental new charts)
- ✅ Changes apply live in both dashboard grid and maximized view
- ✅ Clear visual indicator of which chart the AI is working on
- ✅ Smart suggestions that reference actual chart fields and titles

#### ✅ 2.9 AI Chat Accuracy & Robustness (Completed Feb 15, 2026)
**Problem**: AI frequently misclassified intent, picked wrong fields, and produced inaccurate charts. Root causes: weak disambiguation, no few-shot examples, first-match-wins field matching, and a minimal dashboard prompt.

**Solution**: Comprehensive overhaul of all AI prompts, field matching, intent detection, and error handling.

**Implementation Details:**
- **Scored Field Matching (`findFieldFuzzy`)**: Replaced first-match-wins algorithm with 7-tier scoring system (exact=100, normalized=90, startsWith=80, inputStartsWith=75, wholeWord=70, contains=60, reverseContains=50, wordPartial=30-50). Shared utility used by all handlers.
- **Intent Disambiguation Rules**: Added explicit priority rules in LLM prompt to resolve ambiguous queries. Dashboard-aware delete detection. Previous intent hints from chat history. Expanded history window from 3→5 messages.
- **Few-Shot Examples**: Added 3 input→output examples each to chart creation, dashboard creation, modify request, and data question prompts.
- **Dashboard Prompt Upgrade**: Replaced ~400-char prompt with comprehensive version including field type summary, chart type guide, design rules, aggregation rules.
- **Modify Preservation Rules**: Added PATCH behavior instructions, few-shot examples showing minimal changes, reduced temperature from 0.3→0.15.
- **Data Question Fixes**: Renamed unused `_fields` parameter, added field list to prompt, added `response_format: { type: 'json_object' }`.
- **Enhanced LLM Context**: `formatProfileForLLM()` now groups fields by type (Numeric/Categorical/Temporal) and always shows example values for categorical fields.
- **Delete Chart Handling**: Dashboard mode uses direct delete-by-ID for focused charts. Single chart mode returns `deleteChart: true` flag handled by store's `resetChart()` with undo support.
- **Actionable Error Messages**: Added specific hints for JSON parse errors, chart creation failures, and modify failures.

**Files Modified:**
- ✅ `backend/services/groqService.ts` (+800 lines) - All prompts, field matching, intent detection, delete handling
- ✅ `backend/services/dataContextService.ts` (+20 lines) - Enhanced `formatProfileForLLM()` with field grouping
- ✅ `backend/types/index.ts` (+2 lines) - Added `deleteChart` flag to `AIQueryResult`
- ✅ `frontend/src/store/useVizStore.ts` (+15 lines) - `deleteChart` handler, improved error messages

### 🔮 Phase 3: Advanced Analytics (Planned)
- **3.1 Client-Side Forecasting**: Exponential smoothing / linear regression in browser.
- **3.2 "What-If" Sliders**: Parameterized dashboard controls.
- **3.3 Local LLM**: WebLLM integration for offline privacy.

### 📅 Future Enhancements
- **Export & Sharing**
  - 📅 PowerPoint Integration: Export dashboards as editable PPTX slides
  - 📅 Image Export (PNG/SVG): High-resolution chart images
  - 📅 Shareable Links: Generate public/private dashboard URLs

---

## 8. How to Use This Document for Coding

- **When Fixing Bugs**: Check the *Architecture* section to see if the bug lies in the Store (Logic) or Component (UI).
- **When Adding Features**: Follow the *Data Flow*. Ensure you update the `useVizStore` types, the Vega spec builder, and the UI components.
- **When Improving AI**: Modify `groqService.ts` to adjust prompts or `dataContextService.ts` to provide richer statistical context.
- **After Every Change**: Update this document to keep it accurate as the system memory.

---

## 9. Quick Reference

### Environment Variables
```env
VITE_GROQ_API_KEY=your_groq_api_key_here
VITE_AI_MODEL=meta-llama/llama-4-maverick-17b-128e-instruct
```

### Common Commands
```bash
npm run dev      # Start development server (localhost:5173)
npm run build    # Build production bundle
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

### File Size Reference
| File | Lines | Purpose |
|------|-------|---------|
| `groqService.ts` | ~3,000 | AI/LLM integration (scored field matching, few-shot prompts, delete handling, disambiguation) |
| `echartsOptionBuilder.ts` | 1,193 | ECharts option generation (19 chart types + annotations) |
| `useVizStore.ts` | ~1,350 | State management (dashboard persistence, AI chat focus, deleteChart handler) |
| `schemaInference.ts` | 456 | Type detection + semantic classification |
| `types/index.ts` | ~636 | Type definitions (expanded AIQueryResult, AIIntent, filter/compare/forecast types) |
| `AIChat.tsx` | ~350 | AI chat with per-chart focus, context-aware UI |
| `dataContextService.ts` | ~310 | Data profiling with Arquero, enhanced formatProfileForLLM |
| `DashboardList.tsx` | ~215 | Dashboard browser panel with animations |
| `annotationService.ts` | 210 | Statistical analysis for annotations |
| `DashboardGrid.tsx` | ~580 | Multi-chart dashboard with per-chart AI button |
| `Canvas.tsx` | ~300 | Single chart view with breadcrumb navigation |
| `CodePreview.tsx` | 133 | Syntax highlighting component |
