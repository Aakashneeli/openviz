# OpenViz Project Overview

> **System Memory Document**
> *This document serves as the primary source of truth for the OpenViz project. It details the architecture, feature set, AI integration, and development standards. AI agents should read this file to understand the context before making changes.*
> 
> **Last Updated**: January 5, 2026

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
└── project_overview.md          # This document
```

**Import Aliases:**
- `@/*` → `frontend/src/*` (frontend-internal imports)
- `@backend/*` → `backend/*` (cross-package imports)

### State Management (`useVizStore.ts`)
The entire application state is centralized in a single Zustand store with DevTools integration. This enables features like global Undo/Redo and seamless serialization.

**State Slices:**
- **Data Slice**: Raw data (`dataset`), inferred schema (`fields`), `uploadStatus`, and `dataProfile`.
- **Encoding Slice**: Array of `ShelfPlacement` objects mapping `Field -> Channel`.
- **Chart Slice**: High-level config (`chartConfig`), generated `vegaSpec`, mark type, title.
- **Dashboard Slice**: `dashboardConfig` for multi-chart layouts, `viewMode` (single/dashboard).
- **AI Slice**: `aiQuery`, `aiLoading`, `aiSuggestions`, `aiInsights`, `aiChatHistory`.
- **UI Slice**: `canvasView`, `leftSidebarOpen`, `rightSidebarOpen`, `selectedFieldId`, `isDragging`.
- **History Slice**: `past` and `future` arrays for undo/redo functionality.

**Key Actions:**
- `loadDataFromFile(file)` - Parse and profile uploaded data
- `addToShelf(field, channel)` - Map field to encoding channel
- `processAIQuery(query)` - Process natural language with intent detection
- `undo()` / `redo()` - History navigation
- `setViewMode('single' | 'dashboard')` - Toggle between views

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
4. **Profiling**: `dataContextService.ts` calculates stats (min, max, mean, unique values) using `Arquero`.
5. **Store Update**: The processed dataset, schema, and `DataProfile` are saved to `useVizStore`.

### 3.2. Visual Encoding (The "Deck")
Instead of writing code, users drag fields from the **Data Shelf** to the **Encoding Deck**.
- **Logic**: When a field is dropped on the "X-Axis" zone, a `ShelfPlacement` is added to the store.
- **Compilation**: `vegaSpecBuilder.ts` listens to store changes. It iterates through all active encodings and constructs a valid Vega-Lite JSON specification.
- **Rendering**: The JSON is passed to `vega-embed` which renders the SVG/Canvas interactions.

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
| `processDataQuestion(...)` | Q&A with Arquero for 100% accuracy |
| `processChartRequest(...)` | Single chart generation with smarter field inference |
| `processModifyRequest(...)` | **ENHANCED** Contextual chart modification handling 7 types of visual changes |
| `processDashboardRequest(...)` | Multi-chart dashboard generation |
| `processModifyDashboardRequest(...)` | **ENHANCED** Bulk operations (add, remove, removeAll, replace) |
| `processExplainRequest(...)` | "Why?" questions with analysis |
| `generateDataInsights(...)` | Heuristic + AI insight generation |
| `generateChartSummary(...)` | Generate AI summary for a chart |
| `generateDashboardSummary(...)` | Generate AI summary for dashboard |

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
- **Code Mode**: Direct access to the Vega-Lite JSON using Monaco Editor.
- **AI Mode**: Conversational interface to manipulate the chart.

### 📊 Dashboard Engine
- **Single View**: Focus on one chart for deep analysis.
- **Dashboard View**: CSS Grid-based layout engine allowing multiple charts to coexist. AI can generate full dashboards ("Give me a KPI summary") by creating multiple chart configurations at once.

### 🎨 Design System
- **Theme**: "Deep Space" Dark Mode (Zinc-950 backgrounds, Indigo-500/Purple-500 accents).
- **Components**: Built on headless Radix UI primitives for accessibility, styled with Tailwind.
- **Glassmorphism**: Sidebars use `bg-black/40 backdrop-blur-md` for depth.
- **Motion**: Fluid transitions for layout shifts and chart updates.

### ⚡ Auto-Chart & History
- **Smart Defaults**: `autoChart.ts` selects appropriate chart types based on field types.
- **Undo/Redo**: Every action pushes to history stack via Zustand middleware.

---

## 6. Type System Summary

### Core Types (`types/index.ts` - 330 lines)
```typescript
// Field Classification
type FieldType = 'nominal' | 'quantitative' | 'temporal' | 'ordinal';

// Encoding Channels
type EncodingChannel = 'x' | 'y' | 'color' | 'size' | 'shape' | 'tooltip' | 'row' | 'column';

// Chart Marks
type MarkType = 'bar' | 'line' | 'point' | 'area' | 'arc' | 'rect' | 'rule' | 'text' | 'tick' | 'auto';

// AI Intent Classification
type AIIntent = 'question' | 'chart' | 'dashboard' | 'modify' | 'modify_dashboard' | 'explain' | 'unknown';

// Key Interfaces
interface FieldInfo { id, name, type, stats, sparklineData }
interface Dataset { id, name, fields, rowCount, data, uploadedAt }
interface ShelfPlacement { id, field, channel, aggregate?, bin?, timeUnit?, sort? }
interface ChartConfig { id, title?, mark, encodings, width, height, interactive?, fixedColor? }
interface DashboardConfig { id, title?, charts, layout, createdAt }
interface DataProfile { rowCount, columnCount, fields, summary?, cleaningSuggestions?, generatedAt }
interface AIQueryResult { query, intent, chartConfig?, dashboardConfig?, textAnswer?, insights?, error? }
interface AIMessage { id, role, content, timestamp, resultType? }
```

---

## 7. Future Roadmap
*(Derived from project enhancements log)*
1. **Templates**: Pre-defined dashboard layouts for common use cases (Sales, SaaS Metrics).
2. **Data Transformations**: Allowing the AI to create *new* calculated fields (e.g., `Profit = Sales - Cost`).
3. **Export Engine**: High-resolution PNG/SVG export and "Share Link" functionality.
4. **Local LLM Support**: Running WebLLM in the browser for offline privacy.

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
| `groqService.ts` | 1082 | AI/LLM integration |
| `useVizStore.ts` | 784 | State management |
| `types/index.ts` | 330 | Type definitions |
| `dataContextService.ts` | 291 | Data profiling |
| `AIChat.tsx` | 233 | Chat UI component |
| `vegaSpecBuilder.ts` | ~200 | Vega spec generation |
