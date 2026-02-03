# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**OpenViz** is an AI-powered data visualization platform that allows users to create charts through:
- Natural language queries ("Show sales by region as a bar chart")
- Drag-and-drop field-to-channel mapping
- Direct ECharts JSON specification editing

The platform uses **ECharts** for rendering, **Vega-Lite** concepts for encoding grammar, **Groq/Llama 4** for AI features, and **Zustand** for state management.

## Commands

### Development
```bash
# Start development server (runs from frontend/)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint

# Install all dependencies
npm run install:all
```

### Working with Frontend/Backend
The project uses a monorepo structure where `backend/` contains shared services bundled by the frontend:

```bash
# Frontend development (from frontend/)
cd frontend
npm run dev

# TypeScript compilation check
cd frontend && tsc -b
```

## Architecture

### Monorepo Structure
```
openviz/
├── frontend/           # React 19 + Vite app
│   ├── src/
│   │   ├── components/
│   │   │   ├── ai/              # AI chat UI (AIChat.tsx, AIQueryBar.tsx)
│   │   │   ├── canvas/          # Chart rendering (Canvas.tsx, VizPreview.tsx, DashboardGrid.tsx)
│   │   │   ├── data-shelf/      # Left sidebar with draggable fields
│   │   │   ├── encoding-deck/   # Right sidebar with encoding channels
│   │   │   ├── layout/          # App shell components
│   │   │   └── ui/              # Radix UI primitives
│   │   ├── store/
│   │   │   └── useVizStore.ts   # Central Zustand store (~784 lines)
│   │   └── hooks/               # Custom React hooks
│   └── vite.config.ts
│
├── backend/           # Shared services (bundled by frontend, not a separate server)
│   ├── services/
│   │   ├── groqService.ts          # AI/LLM integration (~1082 lines)
│   │   └── dataContextService.ts   # Data profiling (~291 lines)
│   ├── types/
│   │   └── index.ts                # TypeScript definitions (~330 lines)
│   └── utils/
│       ├── autoChart.ts            # Chart type heuristics
│       ├── schemaInference.ts      # Data type detection
│       ├── echartsOptionBuilder.ts # ECharts option generation
│       └── vegaSpecBuilder.ts      # Legacy Vega-Lite builder
```

### Import Aliases
- `@/*` → `frontend/src/*` (frontend-internal imports)
- `@backend/*` → `backend/*` (cross-package imports from frontend)

Both are configured in `frontend/vite.config.ts` and `frontend/tsconfig.json`.

### State Management (Zustand)

All application state lives in `frontend/src/store/useVizStore.ts` with DevTools integration.

**State Slices:**
- **Data**: `dataset`, `dataProfile`, `uploadStatus`
- **Encodings**: `encodings` (array of `ShelfPlacement` mapping fields to channels)
- **Chart**: `chartConfig`, `echartsOption`, mark type, title
- **Dashboard**: `dashboardConfig`, `savedDashboards` (persisted to localStorage), `viewMode` (single/dashboard), `editingChartId`
- **AI**: `aiQuery`, `aiLoading`, `aiChatHistory`, `aiInsights`, `aiSuggestions`, `aiFocusedChartId`
- **UI**: `canvasView`, `leftSidebarOpen`, `rightSidebarOpen`, `selectedFieldId`, `isDragging`
- **History**: `past`/`future` arrays for undo/redo

**Critical State Flow:**
1. User uploads file → `loadDataFromFile()` → PapaParse → schema inference → `dataset` updated
2. User drags field → `addToShelf(field, channel)` → `encodings` updated
3. Store changes → `buildEChartsOption()` reacts → `echartsOption` updated
4. `echartsOption` → `VizPreview.tsx` renders with `echarts-for-react`

### Data Processing Pipeline

**Upload → Rendering:**
1. **Parse**: `PapaParse` reads CSV/JSON
2. **Infer Schema**: `schemaInference.ts` detects field types:
   - `quantitative` (numbers)
   - `nominal` (categories)
   - `temporal` (dates)
   - `ordinal` (ranked)
   - Plus semantic types: `email`, `phone`, `url`, `currency`, etc.
3. **Profile**: `dataContextService.ts` calculates statistics (min, max, mean, unique counts) using **Arquero**
4. **Store**: Data + metadata saved to Zustand store
5. **Build Spec**: `echartsOptionBuilder.ts` converts encodings → ECharts option
6. **Render**: `VizPreview.tsx` passes option to ECharts

### AI System Architecture

**AI Provider:** Groq API with Llama 4 Maverick 17B (`meta-llama/llama-4-maverick-17b-128e-instruct`)

**Intent Classification:**
The AI detects user intent to route queries appropriately:
- `question` → Answer with data statistics
- `chart` → Generate single chart
- `dashboard` → Create multi-chart layout
- `modify` → Edit current chart (size, color, type, etc.)
- `modify_dashboard` → Edit dashboard (add/remove charts)
- `explain` → Provide analysis/reasoning
- `unknown` → Fallback

**Context Injection:**
- AI receives **DataProfile** (field metadata, stats) but NOT raw data (for privacy/token limits)
- Current chart/dashboard state is serialized and passed as context
- Uses fuzzy field matching for semantic understanding ("sales" matches "Revenue_Amount")

**Key AI Functions** (in `groqService.ts`):
- `detectIntent()` → Classify query intent with reasoning
- `processChartRequest()` → Generate single chart with field validation
- `processDashboardRequest()` → Create multi-chart dashboard
- `processModifyRequest()` → Handle 7 types of visual modifications
- `processDataQuestion()` → Answer questions using Arquero stats
- `generateDataInsights()` → AI-powered data insights

### Component Communication

**Drag-and-Drop Flow:**
1. `DraggableField.tsx` (Data Shelf) → uses `@dnd-kit/core`
2. User drags field → `onDragStart` sets `isDragging: true`
3. Drop on `EncodingShelf.tsx` → `addToShelf(field, channel)`
4. Store updates → `echartsOption` regenerated → chart re-renders

**AI Query Flow:**
1. User types in `AIQueryBar.tsx` or `AIChat.tsx`
2. `processAIQuery(query)` called
3. `groqService.detectIntent()` classifies intent
4. Route to appropriate handler (chart/dashboard/modify/etc.)
5. Result saved to store → UI updates + chat message added

**View Mode Switching:**
- `viewMode: 'single'` → Shows one chart in `Canvas.tsx` with encoding controls
- `viewMode: 'dashboard'` → Shows grid of charts in `DashboardGrid.tsx`
- Switching preserves state via `editingChartId` for round-trip editing

**Dashboard Persistence (localStorage):**
- Dashboards are saved to `localStorage` key `openviz-dashboards` as `SavedDashboard[]`
- Auto-save triggers on: create, rename, add/remove/update chart
- `closeDashboard()` saves then nullifies `dashboardConfig` (returns to clean single view)
- `setViewMode('single')` is a lightweight toggle that keeps the dashboard in memory (used during chart editing)
- `loadDataFromFile()` clears all saved dashboards (old dashboards reference stale fields)
- `DashboardList.tsx` in the left sidebar shows saved dashboards only when a dataset is loaded

**AI Chat Context Focus:**
- `aiFocusedChartId` tracks which dashboard chart the AI chat is scoped to
- `openChatForChart(chartId)` sets focus, clears chat history, and opens the chat panel
- Each chart card in `DashboardGrid` has a sparkle button that calls `openChatForChart`
- When focused, `processAIQuery` passes that chart's encodings/mark/title to the AI instead of single-view state
- AI modifications with a focused chart update that specific chart in the dashboard (not add a new one)
- `formatFocusedChartContext()` in `groqService.ts` generates detailed context for the LLM
- `AIChat.tsx` shows an amber banner with the focused chart name, context-aware suggestions, and tailored placeholder text
- Clearing focus (X button on banner) returns to general chat mode

## Type System

All types are defined in `backend/types/index.ts`. Key types:

```typescript
// Field classification
type FieldType = 'nominal' | 'quantitative' | 'temporal' | 'ordinal'
type SemanticType = 'email' | 'phone' | 'url' | 'currency' | 'percentage' | 'countryCode' | 'zipCode' | 'generic'

// Encoding
type EncodingChannel = 'x' | 'y' | 'color' | 'size' | 'shape' | 'tooltip' | 'row' | 'column'
type MarkType = 'bar' | 'line' | 'point' | 'area' | 'arc' | 'rect' | 'rule' | 'text' | 'tick' | 'auto'

// Core data structures
interface FieldInfo { id, name, type, semanticType?, stats, sparklineData }
interface Dataset { id, name, fields, rowCount, data, uploadedAt }
interface ShelfPlacement { id, field, channel, aggregate?, bin?, timeUnit?, sort? }
interface ChartConfig { id, title?, mark, encodings, width, height, interactive?, fixedColor? }
interface DashboardConfig { id, title?, charts, layout, createdAt }
interface SavedDashboard { id, config: DashboardConfig, updatedAt: Date }

// AI types
type AIIntent = 'question' | 'chart' | 'dashboard' | 'modify' | 'modify_dashboard' | 'explain' | 'unknown'
interface AIMessage { id, role, content, timestamp, resultType?, chartConfig?, echartsOption? }
```

## Important Patterns

### When Adding New Features

1. **Start with types**: Add to `backend/types/index.ts`
2. **Update store**: Add state/actions to `useVizStore.ts`
3. **Implement logic**: Add services to `backend/services/` or `backend/utils/`
4. **Create UI**: Add components to appropriate `frontend/src/components/` subfolder
5. **Wire up**: Connect UI to store actions

### When Modifying AI Behavior

1. **Prompts**: Modify system prompts in `groqService.ts` functions
2. **Context**: Adjust `formatChartContext()` or `formatDashboardContext()` helpers
3. **Intent**: Update intent detection in `detectIntent()` if adding new query types
4. **Validation**: Field matching uses fuzzy logic in `processChartRequest()`

### When Changing Chart Rendering

1. **ECharts Options**: Modify `echartsOptionBuilder.ts` to change how encodings → ECharts
2. **Preview Component**: `VizPreview.tsx` renders the ECharts instance
3. **Dashboard Grid**: `DashboardGrid.tsx` handles multi-chart layout

### Environment Variables

Required in `frontend/.env` (or root `.env` with `envDir` pointing to root):

```env
VITE_GROQ_API_KEY=your_groq_api_key_here
VITE_AI_MODEL=meta-llama/llama-4-maverick-17b-128e-instruct  # optional
```

## Common Tasks

### Debugging State Issues
Use Redux DevTools with Zustand:
```typescript
// Store is configured with devtools({ name: 'openviz-store' })
// Open Redux DevTools in browser to inspect state changes
```

### Testing AI Queries
AI queries are processed through intent classification. To debug:
1. Check `detectIntent()` output in console
2. Verify `DataProfile` is being generated correctly
3. Ensure field names match between query and dataset (fuzzy matching handles some variance)

### Modifying Chart Types
Auto-chart logic in `backend/utils/autoChart.ts` uses heuristics:
- Nominal X + Quantitative Y → Bar
- Temporal X + Quantitative Y → Line
- Quantitative X + Quantitative Y → Scatter
- Update `getChartSuggestions()` to change recommendations

### Working with Data Profiling
`dataContextService.ts` uses **Arquero** for stats:
```typescript
// Get field statistics
const profile = generateDataProfile(data, fields)

// Execute custom queries
const result = executeDataQuery(data, {
  aggregations: [{ field: 'sales', function: 'sum' }]
})
```

## Design System

**Styling**: Tailwind CSS 4 with utility-first approach
**UI Components**: Radix UI primitives (Dialog, DropdownMenu, Tooltip, etc.)
**Icons**: Lucide React
**Theme**: Dark mode with deep blacks (`#09090b`) and violet/purple accents
**Animations**: Framer Motion for drag-and-drop and transitions

## Important Notes

- **No Backend Server**: Despite the `backend/` folder name, this is NOT a Node.js server. All code is bundled by Vite and runs in the browser.
- **Data Privacy**: Raw datasets are NEVER sent to the AI. Only metadata/statistics are shared.
- **Undo/Redo**: Automatically managed via history middleware in store
- **Chart Library**: Switched from Vega-Lite to **ECharts** for primary rendering (Vega utilities still exist but are legacy)
- **State Persistence**: Dashboards are persisted to `localStorage`. Cleared on new data upload.

## Critical Rules

### React Hooks Order
**NEVER place an early `return` before hook calls in a component.** All `useState`, `useEffect`, `useMemo`, `useRef`, and store selectors (`useVizStore(...)`) must be called unconditionally at the top of the component — before any conditional returns. React requires hooks to run in the same order every render.

```typescript
// WRONG — will crash React
function MyComponent() {
    const data = useVizStore(selectData);
    if (!data) return null;          // ← early return BEFORE useState
    const [open, setOpen] = useState(false); // ← React error: hook order changed
}

// CORRECT — hooks first, then conditional return
function MyComponent() {
    const data = useVizStore(selectData);
    const [open, setOpen] = useState(false); // ← all hooks called first
    if (!data) return null;          // ← safe to return after all hooks
}
```

## References

- [Project Overview](./project_overview.md) - Comprehensive system memory document
- [README](./README.md) - User-facing documentation
- [ECharts Documentation](https://echarts.apache.org/en/index.html)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)
- [Groq API Docs](https://console.groq.com/docs)
