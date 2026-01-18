# OpenViz Project Overview

> **System Memory Document**
> *This document serves as the primary source of truth for the OpenViz project. It details the architecture, feature set, AI integration, and development standards. AI agents should read this file to understand the context before making changes.*
>
> **Last Updated**: January 18, 2026

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
│   │   │   ├── data-shelf/      # Left sidebar field list
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
- **Dashboard Slice**: `dashboardConfig` for multi-chart layouts, `viewMode` (single/dashboard), `editingChartId`.
- **AI Slice**: `aiQuery`, `aiLoading`, `aiSuggestions`, `aiInsights`, `aiChatHistory`.
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
We use **Groq** for ultra-low latency inference, crucial for the "real-time" feel.

**Configuration:**
- **Model**: Llama 4 Maverick 17B (`meta-llama/llama-4-maverick-17b-128e-instruct`)
- **API Key**: `VITE_GROQ_API_KEY` (environment variable)

**Core Functions:**
| Function | Purpose |
|----------|---------|
| `detectIntent(query, ...)` | LLM-based intent intent classification with **reasoning** |
| `processAIQuery(...)` | Main entry point for all AI queries |
| `processDataQuestion(...)` | Q&A with Arquero stats + **Available Chart/Dashboard Context** |
| `processChartRequest(...)` | Single chart generation with **Fuzzy Field Matching** & **Validation** |
| `processModifyRequest(...)` | Contextual chart modification handling 7 types of visual changes |
| `processDashboardRequest(...)` | Multi-chart dashboard generation |
| `processModifyDashboardRequest(...)` | **ENHANCED** Bulk operations with **Duplicate Avoidance** |
| `processExplainRequest(...)` | "Why?" questions with analysis |
| `generateDataInsights(...)` | Heuristic + AI insight generation |
| `generateChartSummary(...)` | Generate AI summary for a chart |
| `generateDashboardSummary(...)` | Generate AI summary for dashboard |
| `formatChartContext(...)` | **NEW** helper to describe current chart to AI |
| `formatDashboardContext(...)` | **NEW** helper to describe entire dashboard to AI |

### 4.2. Intent Classification
The AI detects user intent to route queries appropriately. All responses now include **reasoning** for transparency.

| Intent | Description | Example |
|--------|-------------|---------|
| `question` | Data Q&A (text answer) | "What is the average age?" |
| `chart` | Create single chart | "Show sales by region" |
| `dashboard` | Create multi-chart view | "Give me a sales overview dashboard" |
| `modify` | Edit current chart (Size, Color, Type, etc.) | "Make it bigger", "Change colors to blue" |
| `modify_dashboard` | Edit current dashboard (Single/Bulk) | "Remove all charts", "Add a pie chart" |
| `explain` | Analysis request | "Why are sales down in March?" |
| `unknown` | Fallback | General queries |

### 4.3. Context Injection Strategy
To make the AI "smart" about the user's specific file, we inject a high-density **Data Profile** into the system prompt:
```typescript
{
    "rowCount": 1000,
    "columnCount": 5,
    "fields": [
        { 
            "name": "Revenue", 
            "type": "quantitative", 
            "stats": { "min": 100, "max": 5000, "mean": 2500 } 
        },
        { 
            "name": "Region", 
            "type": "nominal", 
            "uniqueCount": 4,
            "topValues": [{"value": "North", "count": 400}] 
        }
    ],
    "generatedAt": "2026-01-04T10:00:00Z"
}
```
*Note: We DO NOT send the entire dataset to the LLM to preserve privacy and token limits. We only send the metadata/statistics.*

### 4.4. Data Context Service (`dataContextService.ts`)
| Function | Purpose |
|----------|---------|
| `generateDataProfile(data, fields)` | Create comprehensive profile for AI |
| `generateFieldProfile(field, table, data)` | Stats for individual field |
| `detectDataIssues(fields, data)` | Find data quality problems |
| `executeDataQuery(data, query)` | Run structured queries with Arquero |
| `formatProfileForLLM(profile)` | Format profile as context string |

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

### Core Types (`types/index.ts` - 395 lines)
```typescript
// Field Classification
type FieldType = 'nominal' | 'quantitative' | 'temporal' | 'ordinal';

// Semantic Type Classification (Phase 1)
type SemanticType = 'email' | 'phone' | 'url' | 'currency' | 'percentage' | 'countryCode' | 'zipCode' | 'generic';

// Encoding Channels
type EncodingChannel = 'x' | 'y' | 'color' | 'size' | 'shape' | 'tooltip' | 'row' | 'column';

// Chart Marks (Expanded for ECharts)
type MarkType = 'bar' | 'line' | 'point' | 'area' | 'arc' | 'boxplot' | 'candlestick' | 'histogram'
  | 'treemap' | 'sunburst' | 'tree' | 'sankey' | 'graph' | 'radar' | 'heatmap' | 'funnel' | 'gauge'
  | 'parallel' | 'waterfall' | 'calendar' | 'pictorialBar' | 'rect' | 'rule' | 'text' | 'tick' | 'auto';

// AI Intent Classification
type AIIntent = 'question' | 'chart' | 'dashboard' | 'modify' | 'modify_dashboard' | 'explain' | 'unknown';

// Annotation Types (Phase 2.1 - Smart Annotations)
interface Annotation { type: 'outlier' | 'max' | 'min' | 'trend', dataIndex, value, label, coord? }

// Key Interfaces
interface FieldInfo { id, name, type, semanticType?, stats, sparklineData }
interface Dataset { id, name, fields, rowCount, data, uploadedAt }
interface ShelfPlacement { id, field, channel, aggregate?, bin?, timeUnit?, sort? }
interface ChartConfig { id, title?, mark, encodings, width, height, interactive?, fixedColor?, annotations? }
interface DashboardConfig { id, title?, charts, layout, createdAt }
interface DataProfile { rowCount, columnCount, fields, summary?, cleaningSuggestions?, generatedAt }
interface AIQueryResult { query, intent, chartConfig?, dashboardConfig?, textAnswer?, insights?, error? }
interface AIMessage { id, role, content, timestamp, resultType?, chartConfig?, echartsOption? }
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

### 🔮 Phase 3: Advanced Analytics (Planned)
- **3.1 Client-Side Forecasting**: Exponential smoothing / linear regression in browser.
- **3.2 "What-If" Sliders**: Parameterized dashboard controls.
- **3.3 Local LLM**: WebLLM integration for offline privacy.

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
| `groqService.ts` | 1,991 | AI/LLM integration (expanded with annotations) |
| `echartsOptionBuilder.ts` | 1,193 | ECharts option generation (19 chart types + annotations) |
| `useVizStore.ts` | 1,120 | State management (with annotations toggle) |
| `schemaInference.ts` | 456 | Type detection + semantic classification |
| `types/index.ts` | 395 | Type definitions (includes Annotation interface) |
| `dataContextService.ts` | 291 | Data profiling with Arquero |
| `AIChat.tsx` | 233 | Chat UI component |
| `annotationService.ts` | 210 | Statistical analysis for annotations (NEW) |
| `CodePreview.tsx` | 133 | Syntax highlighting component (NEW) |
