# OpenViz Implementation Tasks

> **Generated**: January 28, 2026
> **Based on**: OpenViz_Product_Analysis_Report.md
> **Timeline**: Ongoing/Flexible
> **Last Updated**: February 15, 2026

---

## Quick Status

### Completed Tasks (24/28)
| # | Task | Priority |
|---|------|----------|
| 1 | API Key Security (Cloudflare Worker Proxy) | P0 |
| 2 | PNG/SVG Image Export | P0 |
| 3 | PowerPoint Export | P0 |
| 4 | Error Boundaries | P0 |
| 5 | Toast Notifications | P0 |
| 9 | Contextual Tooltips | P0 |
| 7 | Empty States (Onboarding) | P0 |
| 8 | Sample Datasets | P0 |
| 6 | AI Retry Logic | P0 |
| 15 | Dashboard JSON Export/Import | P1 |
| 16 | Shareable Dashboard Links | P1 |
| 18 | AI Feedback Loop | P2 |
| 21 | Advanced Aggregations | P2 |
| 10 | Cross-Chart Filtering | P1 |
| 11 | Calculated Fields | P1 |
| 13 | URL/API Data Source | P1 |
| 12 | Google Sheets Connector | P1 |
| 14 | Scheduled Refresh | P1 |
| 17 | AI Streaming Responses | P2 |
| 19 | AI Provider Fallback | P2 |
| 20 | Chart Templates Gallery | P2 |
| 22 | Drill-Down Navigation | P2 |
| 27 | Dashboard Templates | P2 |
| 28 | AI Chat Accuracy & Robustness | P1 |

### Next Up
| # | Task | Priority |
|---|------|----------|
| 23 | Split Monolithic Store | Architecture |

---

## Summary

This document outlines all implementation tasks for OpenViz based on the Product Analysis Report. Tasks are organized by priority (P0 > P1 > P2 > Architecture) and include effort estimates, key files, and implementation notes.

### Scope Decisions
- **Include**: API security, exports, error handling, onboarding, cross-filtering, calculated fields, connectors, refresh, sharing, AI enhancements, templates, aggregations, drill-down, architecture improvements
- **Skip**: Keyboard shortcuts, testing setup (for now)
- **Backend**: Cloudflare Workers for API proxy

---

## Progress Tracker

| Priority | Total | Done | In Progress |
|----------|-------|------|-------------|
| P0 - Critical | 9 | 9 | 0 |
| P1 - High | 9 | 9 | 0 |
| P2 - Medium | 6 | 6 | 0 |
| Architecture | 4 | 0 | 0 |
| **Total** | **28** | **24** | **0** |

---

## P0 - Critical (Must-Fix Before Launch)

### Task 1: API Key Security (Backend Proxy)
- [x] **Status**: Completed
- **Priority**: P0 (Blocker)
- **Effort**: Medium (1-2 days)

**Problem**: Groq API key exposed in frontend bundle via `VITE_GROQ_API_KEY`

**Implementation**:
1. Create Cloudflare Worker to proxy AI requests
2. Move `GROQ_API_KEY` to Worker secrets
3. Add rate limiting (100 requests/hour per IP)
4. Update `groqService.ts` to call Worker endpoint instead of Groq directly
5. Add retry logic with exponential backoff

**Files to Create**:
- `cloudflare-worker/src/index.ts` - Worker proxy code
- `cloudflare-worker/wrangler.toml` - Worker config

**Files to Modify**:
- `backend/services/groqService.ts` - Change API calls to use proxy
- `frontend/.env` - Remove `VITE_GROQ_API_KEY`, add `VITE_AI_PROXY_URL`

---

### Task 2: Export - PNG/SVG Images
- [x] **Status**: Completed
- **Priority**: P0
- **Effort**: Low (half day)

**Problem**: Users can create charts but only PDF export works

**Implementation**:
1. Add export button dropdown in `Canvas.tsx` toolbar
2. Use ECharts `getDataURL()` for PNG/SVG export
3. Create download function with proper filename
4. Add resolution options (1x, 2x, 3x) for PNG

**Files to Modify**:
- `frontend/src/components/canvas/Canvas.tsx` - Add export dropdown
- `frontend/src/components/canvas/VizPreview.tsx` - Expose chart ref for export
- `frontend/src/services/exportService.ts` - Add `exportToPNG()`, `exportToSVG()`

**Code Pattern**:
```typescript
const exportChart = (format: 'png' | 'svg', pixelRatio = 2) => {
  const chart = echartsRef.current?.getEchartsInstance();
  if (!chart) return;
  const url = chart.getDataURL({ type: format, pixelRatio, backgroundColor: '#fff' });
  downloadFile(url, `chart.${format}`);
};
```

---

### Task 3: Export - PowerPoint
- [x] **Status**: Completed
- **Priority**: P0
- **Effort**: Medium (1-2 days)

**Problem**: Enterprise users need PPTX export for presentations

**Implementation**:
1. Installed `pptxgenjs` library
2. Created `pptxExportService.ts` with `exportChartToPPTX()` and `exportDashboardToPPTX()`
3. Single chart export: title slide (optional) + chart slide with centered image
4. Dashboard export: title slide with chart count + one slide per chart with slide numbers
5. Dark theme slides matching OpenViz branding (deep navy background, white text)
6. Added PPTX option to Canvas.tsx export dropdown and DashboardGrid.tsx export dropdown

**Files Created**:
- `frontend/src/services/pptxExportService.ts` - PowerPoint generation with single chart and dashboard export

**Files Modified**:
- `frontend/src/components/canvas/Canvas.tsx` - Added PPTX to export dropdown menu
- `frontend/src/components/canvas/DashboardGrid.tsx` - Changed "Export PDF" button to Export dropdown with PDF and PPTX options

---

### Task 4: Error Handling - Error Boundaries
- [x] **Status**: Completed
- **Priority**: P0
- **Effort**: Low (half day)

**Problem**: No graceful error recovery, app can crash on errors

**Implementation**:
1. Create `ErrorBoundary` component with fallback UI
2. Wrap major sections: Canvas, AIChat, DataShelf, EncodingDeck
3. Add "Retry" and "Report Bug" buttons in fallback
4. Log errors to console (or analytics service later)

**Files Created**:
- `frontend/src/components/ui/ErrorBoundary.tsx` - React error boundary class component with reset capability
- `frontend/src/components/ui/ErrorFallback.tsx` - Graceful error UI with retry/report bug buttons

**Files Modified**:
- `frontend/src/App.tsx` - Wrap top-level with ErrorBoundary
- `frontend/src/components/layout/AppLayout.tsx` - Wrapped DataShelf, DashboardList, Canvas, EncodingDeck, AIChat

---

### Task 5: Error Handling - Toast Notifications
- [x] **Status**: Completed
- **Priority**: P0
- **Effort**: Low (half day)

**Problem**: No feedback for errors or success actions

**Implementation**:
1. Install `sonner` or use Radix Toast primitive
2. Create toast utility functions: `toast.success()`, `toast.error()`, `toast.info()`
3. Add toasts for: file upload success/error, AI query failure, export complete, save success
4. Position at bottom-right, auto-dismiss after 4s

**Files Created**:
- `frontend/src/components/ui/Toaster.tsx` - Sonner Toaster with dark theme styling
- `frontend/src/lib/toast.ts` - Toast utility wrapper with success, error, info, warning, loading, promise methods

**Files Modified**:
- `frontend/src/App.tsx` - Added Toaster component
- `frontend/src/store/useVizStore.ts` - Added toasts for file load success/error, AI query errors
- `frontend/src/components/canvas/Canvas.tsx` - Added toasts for PDF/PNG/SVG export
- `frontend/src/components/canvas/DashboardGrid.tsx` - Added toasts for dashboard PDF export

---

### Task 6: Error Handling - AI Retry Logic
- [x] **Status**: Completed
- **Priority**: P0
- **Effort**: Low (half day)

**Problem**: AI calls can fail silently without retry

**Implementation**:
1. Add exponential backoff retry (3 attempts: 1s, 2s, 4s) - Already implemented in groqService.ts
2. Show "Retrying..." status in AI chat - Automatic via backend retry
3. On final failure, show friendly error with manual retry option
4. Add "AI temporarily unavailable" fallback message

**Files Modified**:
- `backend/services/groqService.ts` - Already had retry wrapper with exponential backoff (MAX_RETRIES=3, delays: 1s, 2s, 4s)
- `frontend/src/store/useVizStore.ts` - Added `lastFailedQuery` state, `retryLastQuery` action, user-friendly error messages (network, rate limit, timeout detection)
- `frontend/src/components/ai/AIChat.tsx` - Added "Retry" button on error messages with RefreshCw icon

---

### Task 7: Onboarding - Empty States
- [x] **Status**: Completed
- **Priority**: P0
- **Effort**: Low (1 day)

**Problem**: New users see blank panels with no guidance

**Implementation**:
1. Design empty state for DataShelf: "Drop a CSV or Excel file here to get started"
2. Design empty state for Canvas: Show preview image + "Upload data to create charts"
3. Design empty state for Dashboard: "Add your first chart" with + button
4. Add file format hints and max size info

**Files Modified**:
- `frontend/src/components/data-shelf/DataShelf.tsx` - Enhanced empty state with upload CTA and format hints
- `frontend/src/components/canvas/VizPreview.tsx` - Improved empty states for no-data and no-chart scenarios with step indicators
- `frontend/src/components/canvas/DashboardGrid.tsx` - Already had excellent empty state with AI options (unchanged)
- `frontend/src/components/encoding-deck/EncodingDeck.tsx` - Added empty state when no data is loaded

---

### Task 8: Onboarding - Sample Datasets
- [x] **Status**: Completed
- **Priority**: P0
- **Effort**: Low (half day)

**Problem**: Users need example data to explore features

**Implementation**:
1. Create 3 sample CSV files:
   - `sales_data.csv` - Revenue, Region, Product, Date (business analytics)
   - `stock_prices.csv` - Date, Open, Close, Volume (time series)
   - `website_analytics.csv` - Page, Visitors, Bounce Rate, Conversions (marketing)
2. Add "Try sample data" dropdown in DataShelf
3. Load sample directly (no file upload needed)

**Files Created**:
- `frontend/public/samples/sales_data.csv` - 52 rows of regional sales data with Revenue, Units, Profit by Product/Category
- `frontend/public/samples/stock_prices.csv` - 66 rows of OHLCV stock data for 3 symbols (TECH, FINA, HEAL)
- `frontend/public/samples/website_analytics.csv` - 56 rows of website metrics by Page and Source
- `frontend/src/data/sampleDatasets.ts` - Sample data definitions with metadata, descriptions, and suggested charts

**Files Modified**:
- `frontend/src/components/data-shelf/DataShelf.tsx` - Added "Try Sample Data" dropdown with loading state, icons per category

---

### Task 9: Onboarding - Contextual Tooltips
- [x] **Status**: Completed
- **Priority**: P0
- **Effort**: Low (half day)

**Problem**: Features aren't self-explanatory

**Implementation**:
1. Add Radix Tooltip to key UI elements
2. Add tooltips to: encoding channels, chart type icons, AI chat button, export buttons
3. Use consistent styling with dark background
4. Show on hover with 300ms delay

**Files Modified**:
- `frontend/src/App.tsx` - Added TooltipProvider with 300ms delay
- `frontend/src/components/encoding-deck/EncodingShelf.tsx` - Channel tooltips with descriptions for all 8 channels
- `frontend/src/components/encoding-deck/ChartTypeSelector.tsx` - Upgraded from title to Radix tooltips with descriptions
- `frontend/src/components/canvas/Canvas.tsx` - Tooltips on Insights, Export, Clear buttons

---

## P1 - High Priority (Competitive Differentiators)

### Task 10: Cross-Chart Filtering
- [x] **Status**: Completed
- **Priority**: P1
- **Effort**: High (2-3 days)

**Problem**: Charts in dashboards are isolated - clicking one doesn't filter others

**Implementation**:
1. Added `CrossFilter` type to `backend/types/index.ts` with sourceChartId, field, value, operator
2. Added `crossFilters` array and `crossFilterEnabled` boolean to Zustand store with `setCrossFilter`, `clearCrossFilters`, `toggleCrossFilter` actions
3. Implemented click handler on ECharts instances in dashboard - supports bar, line, pie/arc chart clicks
4. Cross-filter applies data filtering to all OTHER charts (not the source chart)
5. "Filtering by: field = value" badge bar with individual remove (X) and "Clear All" buttons
6. Clicking same value on same chart toggles filter off
7. Cross-filter toggle button in dashboard toolbar (cyan highlight when active)
8. "SOURCE" badge on the chart that initiated the filter
9. Cross-filters cleared when dashboard is closed, deleted, or source chart is removed

**Files Modified**:
- `backend/types/index.ts` - Added `CrossFilter` interface
- `frontend/src/store/useVizStore.ts` - Added cross-filter state, actions, selectors; clear on close/delete/remove chart
- `frontend/src/components/canvas/DashboardGrid.tsx` - Click handlers on ECharts, filter badge bar, toggle button, source indicator

---

### Task 11: Calculated Fields
- [x] **Status**: Completed
- **Priority**: P1
- **Effort**: High (3-4 days)

**Problem**: Users can't create derived metrics (profit margin, YoY change)

**Implementation**:
1. Added `CalculatedField` type to `backend/types/index.ts`
2. Created `backend/services/formulaParser.ts` - Full formula parser with tokenizer, recursive descent parser, and evaluator
3. Supports arithmetic: `+`, `-`, `*`, `/`, `()` and comparisons: `>`, `<`, `>=`, `<=`, `=`, `!=`
4. Supports 14 functions: `SUM`, `AVG`, `MIN`, `MAX`, `COUNT`, `IF`, `CONCAT`, `ABS`, `ROUND`, `SQRT`, `LOG`, `UPPER`, `LOWER`, `LEN`
5. Field references via `[Field Name]` brackets or direct name matching
6. Created `CalculatedFieldDialog.tsx` with formula input, real-time validation, clickable field picker, function help, and examples
7. Added `addCalculatedField()` and `removeCalculatedField()` store actions that compute values, add to dataset, and create FieldInfo
8. Calculated fields shown in DataShelf with violet fx badge and removable via hover X button
9. "New Calculated Field" button in DataShelf when data is loaded
10. Cleared on new data upload

**Files Created**:
- `backend/services/formulaParser.ts` - Tokenizer, parser, evaluator with `parseFormula()`, `evaluateFormula()`, `validateFormula()`
- `frontend/src/components/data-shelf/CalculatedFieldDialog.tsx` - Dialog UI with field picker, function help, examples, validation

**Files Modified**:
- `backend/types/index.ts` - Added `CalculatedField` interface
- `frontend/src/store/useVizStore.ts` - Added `calculatedFields` state, `addCalculatedField`, `removeCalculatedField` actions
- `frontend/src/components/data-shelf/DataShelf.tsx` - Added "New Calculated Field" button, fx badge, remove button

---

### Task 12: Google Sheets Connector
- [x] **Status**: Completed
- **Priority**: P1
- **Effort**: High (2-3 days)

**Problem**: File upload only limits use cases

**Implementation**:
1. Created `googleSheetsService.ts` with Google Identity Services (GIS) token-based OAuth 2.0
2. Supports: paste Google Sheets URL or spreadsheet ID → authenticate → select sheet → import data
3. Uses Sheets API v4 REST endpoints for reading data (no Google Picker needed)
4. Token caching with 55-min expiry, automatic GIS script loading
5. Created `GoogleSheetsConnector.tsx` dialog with 2-step flow: connect → select sheet
6. Shows spreadsheet title, sheet list with row counts, error handling
7. Added `DataSourceInfo` type to track data source for refresh capability
8. Added `dataSource` state + `setDataSource` action to store (cleared on new data upload)
9. Green Google Sheets button in DataShelf empty state and loaded-state toolbar
10. Graceful fallback when `VITE_GOOGLE_CLIENT_ID` is not configured (shows setup instructions)

**Files Created**:
- `frontend/src/services/googleSheetsService.ts` - GIS OAuth, token management, Sheets API v4 calls, URL parsing
- `frontend/src/components/data-shelf/GoogleSheetsConnector.tsx` - 2-step dialog (connect → select sheet)

**Files Modified**:
- `backend/types/index.ts` - Added `DataSourceType`, `DataSourceInfo` interfaces
- `frontend/src/store/useVizStore.ts` - Added `dataSource` state, `setDataSource` action, `selectDataSource` selector
- `frontend/src/components/data-shelf/DataShelf.tsx` - Added Google Sheets button in empty and loaded states

---

### Task 13: URL/API Data Source
- [x] **Status**: Completed
- **Priority**: P1
- **Effort**: Medium (1-2 days)

**Problem**: Can't fetch data from URLs or REST APIs

**Implementation**:
1. Created `urlDataService.ts` with `fetchDataFromURL()` supporting JSON and CSV with auto-detection
2. JSON support includes nested path navigation (e.g., `data.results`), auto-detection of common array keys (`data`, `results`, `items`, `records`, `rows`)
3. Created `URLImportDialog.tsx` with URL input, format selector (Auto/JSON/CSV), advanced options (JSON path, custom headers)
4. Custom headers support for authenticated API endpoints
5. "Import from URL" button added in DataShelf empty state (cyan globe icon) and in loaded state (toolbar icon)
6. Error handling with user-friendly messages for HTTP errors, parse failures, CORS issues
7. Reuses existing `loadDataFromFile()` for schema inference and data profiling

**Files Created**:
- `frontend/src/services/urlDataService.ts` - URL fetching, format detection, JSON path extraction, CSV parsing
- `frontend/src/components/data-shelf/URLImportDialog.tsx` - Dialog with URL input, format picker, advanced options (headers, JSON path)

**Files Modified**:
- `frontend/src/components/data-shelf/DataShelf.tsx` - Added "Import from URL" button in empty and loaded states, globe icon in toolbar

---

### Task 14: Scheduled Refresh
- [x] **Status**: Completed
- **Priority**: P1
- **Effort**: Medium (1-2 days)

**Problem**: Dashboards are static snapshots

**Implementation**:
1. Added `RefreshInterval` type (null | 60000 | 300000 | 900000 | 3600000) and `refreshInterval` to `DashboardConfig`
2. Added `isRefreshing`, `lastRefreshedAt` state, `setRefreshInterval()`, `refreshDashboardData()` actions to store
3. Refresh button with spinning icon in dashboard toolbar (visible when data source is URL or Google Sheets)
4. Auto-refresh dropdown selector (Off, 1min, 5min, 15min, 1hr) with amber highlight when active
5. "Last updated: Xm ago" timestamp with 30-second auto-update
6. `refreshDashboardData()` re-fetches from URL (via `urlDataService`) or Google Sheets (via `googleSheetsService`) and updates dataset in-place without clearing dashboard
7. Updated `URLImportDialog` to set `dataSource` after import (enables refresh for URL imports)
8. Auto-refresh uses `setInterval` with cleanup on unmount/interval change

**Files Modified**:
- `backend/types/index.ts` - Added `RefreshInterval` type, `refreshInterval` to `DashboardConfig`
- `frontend/src/store/useVizStore.ts` - Added `isRefreshing`, `lastRefreshedAt` state, `setRefreshInterval`, `refreshDashboardData` actions, selectors
- `frontend/src/components/canvas/DashboardGrid.tsx` - Refresh button, interval dropdown, timestamp display, auto-refresh useEffect
- `frontend/src/components/data-shelf/URLImportDialog.tsx` - Sets `dataSource` after URL import for refresh capability

---

### Task 15: Dashboard JSON Export/Import
- [x] **Status**: Completed
- **Priority**: P1
- **Effort**: Low (half day)

**Problem**: Can't backup or share dashboards

**Implementation**:
1. Added `exportDashboardToJSON()` and `importDashboardFromJSON()` to exportService.ts
2. Export includes versioned format with dashboard config + full dataset
3. Import validates structure (dashboard, dataset, charts array, fields, data) and revives Date objects
4. Added "Dashboard JSON" option to DashboardGrid export dropdown
5. Added "Import Dashboard" button in DataShelf empty state
6. Added `importDashboard()` action to store that sets dataset, dashboard, and generates data profile

**Files Modified**:
- `frontend/src/services/exportService.ts` - Added `exportDashboardToJSON()`, `importDashboardFromJSON()` with schema validation
- `frontend/src/components/canvas/DashboardGrid.tsx` - Added JSON export to export dropdown
- `frontend/src/components/data-shelf/DataShelf.tsx` - Added "Import Dashboard" button with file input
- `frontend/src/store/useVizStore.ts` - Added `importDashboard()` action

---

### Task 16: Shareable Dashboard Links
- [x] **Status**: Completed
- **Priority**: P1
- **Effort**: Medium (1 day)

**Problem**: Can't share dashboards with others without backend

**Implementation**:
1. Installed `lz-string` for URL-safe compression
2. Created `shareService.ts` with compress/decompress, URL generation, clipboard copy
3. Added "Share" button to DashboardGrid toolbar that copies share link to clipboard
4. App.tsx checks for `?state=` param on mount and auto-loads shared dashboard
5. Warns when URL exceeds 32KB (browser limit risk)
6. Clears URL param after loading to keep URL clean

**Files Created**:
- `frontend/src/services/shareService.ts` - LZ-string compression, URL generation, clipboard copy, URL parsing

**Files Modified**:
- `frontend/src/components/canvas/DashboardGrid.tsx` - Added Share button with copy-to-clipboard
- `frontend/src/App.tsx` - Added useEffect to check URL params on mount and auto-load shared dashboard

---

## P2 - Medium Priority

### Task 17: AI Streaming Responses
- [x] **Status**: Completed
- **Priority**: P2
- **Effort**: Medium (1-2 days)

**Problem**: AI responses appear all at once after delay

**Implementation**:
1. Created `callAIStreamingDirect()` (Groq SDK) and `callAIStreamingProxy()` (SSE) async generators in groqService
2. Created `streamAIChatResponse()` export for streaming with full message array support
3. Created `processDataQuestionStreaming()` — Phase 1: non-streamed JSON call for query plan, Phase 2: real streaming for natural language answer
4. Created `processExplainRequestStreaming()` — streams explanation text directly
5. Created `processAIQueryStreaming()` export — routes text intents (question, explain) through streaming, others through regular processing
6. Updated store `processAIQuery` to use streaming version with `onChunk` callback that updates `aiStreamingText` and chat history in real-time
7. First chunk lazily creates the message placeholder (no empty bubble while loading)
8. Streaming cursor (blinking line) already rendered in AIChat when `streamingMessageId === msg.id`
9. Error handling: cleans up partial streaming message and shows error bubble
10. Filter text responses simplified to immediate display (no more fake typewriter)

**Files Modified**:
- `backend/services/groqService.ts` - Added streaming infrastructure: `callAIStreamingDirect`, `callAIStreamingProxy`, `streamAIChatResponse`, `processDataQuestionStreaming`, `processExplainRequestStreaming`, `processAIQueryStreaming`
- `frontend/src/store/useVizStore.ts` - Updated `processAIQuery` to use real streaming via `onChunk` callback, simplified filter text display

---

### Task 18: AI Feedback Loop
- [x] **Status**: Completed
- **Priority**: P2
- **Effort**: Low (half day)

**Problem**: No way to know if AI responses are helpful

**Implementation**:
1. Added thumbs up/down buttons on all non-error assistant messages in AIChat
2. Feedback stored in AIMessage state (`feedback: 'positive' | 'negative'`)
3. Persisted to localStorage under `openviz-ai-feedback` key with timestamp and content snippet
4. Visual feedback: selected state shows green (positive) or red (negative) highlight + "Thanks!" text
5. Added `setMessageFeedback()` action to Zustand store

**Files Modified**:
- `backend/types/index.ts` - Added `feedback?: 'positive' | 'negative'` to AIMessage
- `frontend/src/store/useVizStore.ts` - Added `setMessageFeedback()` action with localStorage persistence
- `frontend/src/components/ai/AIChat.tsx` - Added ThumbsUp/ThumbsDown buttons on assistant messages

---

### Task 19: AI Provider Fallback
- [x] **Status**: Completed
- **Priority**: P2
- **Effort**: High (2-3 days)

**Problem**: If Groq is down, AI features completely fail

**Implementation** (Completed):
1. Created `AIProvider` interface abstraction with `chat()` and `streamChat()` async generator methods
2. Implemented `GroqProvider` (Groq SDK), `OpenAICompatibleProvider` (fetch-based REST), `AnthropicProvider` (Messages API)
3. `AIProviderManager` with ordered fallback chain: tries each provider in sequence, falls back on failure
4. Provider order configurable via `VITE_AI_PROVIDER_ORDER` env var (comma-separated)
5. Each AI response/message shows which provider was used ("via Groq", "via Claude", etc.)
6. Chat header dynamically shows available providers instead of hardcoded "Powered by LLaMA 3"
7. Streaming fallback: tries first chunk from each provider before committing to that stream
8. Updated `groqService.ts` to use provider manager for both regular and streaming calls
9. Updated store to propagate `provider` field through all message creation paths

**Files Created**:
- `backend/services/aiProvider.ts` - Provider interface, GroqProvider, OpenAICompatibleProvider, AnthropicProvider, AIProviderManager singleton

**Files Modified**:
- `backend/services/groqService.ts` - Uses provider manager for `callAI()` and streaming; removed direct Groq client; re-exports provider utilities
- `backend/types/index.ts` - Added `provider?: string` to AIMessage and AIQueryResult
- `frontend/src/components/ai/AIChat.tsx` - Shows provider names in header + per-message attribution
- `frontend/src/store/useVizStore.ts` - Passes `result.provider` to all assistant messages

**Environment Variables**:
- `VITE_GROQ_API_KEY` - Groq API key
- `VITE_OPENAI_API_KEY` - OpenAI API key
- `VITE_ANTHROPIC_API_KEY` - Anthropic API key
- `VITE_AI_PROVIDER_ORDER` - Custom fallback order (e.g., "groq,anthropic,openai")

---

### Task 20: Chart Templates Gallery
- [x] **Status**: Completed
- **Priority**: P2
- **Effort**: Medium (1-2 days)

**Problem**: Users start from scratch every time

**Implementation** (Completed):
1. Created 17 chart template definitions across 5 categories (General, Sales, Marketing, Operations, Finance)
2. Template slot system: each template declares expected field types per encoding channel with preferred name patterns
3. Auto-mapping engine: `scoreFieldForSlot()` scores fields by type compatibility + name pattern matching, `autoMapFields()` assigns best-fit fields
4. `canApplyTemplate()` checks if all required slots can be filled with available data fields
5. TemplateGallery dialog with category filter chips, search bar, 2-column template grid with compatibility indicators
6. Detail panel shows field mapping preview (slot → auto-mapped field) before applying
7. `applyTemplate` store action: pushes to undo history, sets mark type + title + encodings, calls `regenerateSpec()`
8. Templates button in Canvas toolbar (visible when dataset is loaded)

**Templates included**: Category Comparison, Trend Over Time, Proportion Breakdown, Correlation Plot, Heatmap Grid, Sales by Region, Revenue Trend, Sales Pipeline, Campaign Performance, Engagement Radar, Conversion Funnel, Throughput Timeline, Quality Distribution, Budget vs Actual, Expense Breakdown, Revenue Waterfall

**Files Created**:
- `frontend/src/data/chartTemplates.ts` - Template types, 17 template definitions, auto-mapping engine
- `frontend/src/components/canvas/TemplateGallery.tsx` - Template browser dialog with search, categories, field mapping preview

**Files Modified**:
- `frontend/src/components/canvas/Canvas.tsx` - Added Templates button + TemplateGallery dialog
- `frontend/src/store/useVizStore.ts` - Added `applyTemplate` action

---

### Task 21: Advanced Aggregations
- [x] **Status**: Completed
- **Priority**: P2
- **Effort**: Medium (1-2 days)

**Problem**: Only basic aggregations (sum, mean, count) available

**Implementation**:
1. Extended `AggregateFunction` type with `variance`, `stddev`, `percent_of_total`, `cumulative_sum`
2. Implemented all new aggregation calculations in `processDataWithAggregation()`
3. Added post-processing for `cumulative_sum` to compute running totals across sorted groups
4. Added interactive aggregation dropdown to EncodingShelf for quantitative fields on x/y/size/color/theta channels
5. Dropdown shows Basic (sum, mean, count, min, max, median, distinct) and Advanced (variance, stddev, % of total, cumulative sum) sections
6. Fixed missing `theta` channel in CHANNEL_DESCRIPTIONS

**Files Modified**:
- `backend/types/index.ts` - Extended AggregateFunction with 4 new types
- `backend/utils/echartsOptionBuilder.ts` - Implemented variance, stddev, percent_of_total, cumulative_sum calculations
- `frontend/src/components/encoding-deck/EncodingShelf.tsx` - Added aggregation dropdown with basic/advanced sections

---

### Task 22: Drill-Down Functionality
- [x] **Status**: Completed
- **Priority**: P2
- **Effort**: High (2-3 days)

**Problem**: Can't explore data hierarchies (Year -> Quarter -> Month)

**Implementation** (Completed):
1. Added `TemporalDrillLevel`, `DrillLevel`, `DrillHierarchy` types to `backend/types/index.ts`
2. Created `backend/services/drillService.ts` with temporal hierarchy detection, drill data transformation, level navigation
3. Detects initial temporal level based on date range (>2yr→year, >6mo→quarter, >2mo→month, >2wk→week, else day)
4. `getDrillData()` filters data by drill path and creates virtual drill column with sorted temporal labels
5. Added `drillPath`, `drillHierarchies`, `drillActiveField` state + `drillDown`, `drillUp`, `drillReset` actions to store
6. `regenerateSpec()` applies drill transformation: replaces temporal x-axis with drill field, filters data by path
7. Hierarchies auto-detected on data load (`loadDataFromFile`, `loadDataFromJson`)
8. Created `DrillBreadcrumb.tsx` with "All > 2024 > Q3 > Aug" trail, drill-up button, reset button, current level indicator
9. Updated `VizPreview.tsx` with click-to-drill handler on ECharts, "Click to drill down" hint, pointer cursor when drillable
10. Drill state clears when x-axis encoding changes or new data loads

**Files Created**:
- `backend/services/drillService.ts` - Hierarchy detection, temporal drill data transformation, level navigation utilities
- `frontend/src/components/canvas/DrillBreadcrumb.tsx` - Breadcrumb trail with drill-up/reset controls

**Files Modified**:
- `backend/types/index.ts` - Added `TemporalDrillLevel`, `DrillLevel`, `DrillHierarchy` types
- `frontend/src/store/useVizStore.ts` - Added drill state, actions, selectors; hierarchy detection on data load; drill transform in regenerateSpec
- `frontend/src/components/canvas/VizPreview.tsx` - Drill click handler, breadcrumb display, drill-available indicator

---

## Architecture Improvements

### Task 23: Split Monolithic Store
- [ ] **Status**: Not Started
- **Priority**: Architecture
- **Effort**: High (2-3 days)

**Problem**: `useVizStore.ts` is ~1,700 lines and hard to maintain

**Implementation**:
1. Create slice files using Zustand slice pattern
2. Split into:
   - `dataStore.ts` - dataset, dataProfile, uploadStatus
   - `chartStore.ts` - chartConfig, encodings, echartsOption
   - `dashboardStore.ts` - dashboardConfig, savedDashboards
   - `aiStore.ts` - aiQuery, aiChatHistory, aiFocusedChartId
   - `uiStore.ts` - sidebars, viewMode, isDragging
   - `historyStore.ts` - past, future, undo/redo
3. Compose slices in `stores/index.ts`
4. Update all imports across codebase

**Files to Create**:
- `frontend/src/stores/dataStore.ts`
- `frontend/src/stores/chartStore.ts`
- `frontend/src/stores/dashboardStore.ts`
- `frontend/src/stores/aiStore.ts`
- `frontend/src/stores/uiStore.ts`
- `frontend/src/stores/historyStore.ts`
- `frontend/src/stores/index.ts`

**Files to Modify**:
- All files importing from `useVizStore`

---

### Task 24: Service Abstraction Layer
- [ ] **Status**: Not Started
- **Priority**: Architecture
- **Effort**: Included in Task 19

**Problem**: Direct Groq SDK calls make switching providers difficult

**Implementation**:
1. Create `AIProvider` interface with common methods
2. Implement provider-specific classes
3. Create factory function for provider instantiation
4. Update all AI calls to use abstraction

**See Task 19** - Combined with AI Provider Fallback

---

### Task 25: Lazy Loading
- [ ] **Status**: Not Started
- **Priority**: Architecture
- **Effort**: Medium (1 day)

**Problem**: Large initial bundle with all features loaded upfront

**Implementation**:
1. Lazy load heavy components:
   - `CodeEditor` (Monaco)
   - `DashboardGrid`
   - `AIChat`
   - `ReportGenerator`
   - `TemplateGallery`
2. Add Suspense boundaries with loading skeletons
3. Consider route-based splitting if adding routing

**Files to Modify**:
- `frontend/src/App.tsx` - Add Suspense
- `frontend/src/components/layout/AppLayout.tsx` - Lazy imports
- `frontend/src/components/canvas/Canvas.tsx` - Lazy DashboardGrid

**Files to Create**:
- `frontend/src/components/ui/LoadingSkeleton.tsx`

---

### Task 26: Caching Layer
- [ ] **Status**: Not Started
- **Priority**: Architecture
- **Effort**: Medium (1-2 days)

**Problem**: Repeated AI calls for similar queries, no caching

**Implementation**:
1. Create `QueryCache` class with TTL support
2. Cache AI responses by query + context hash
3. Cache data profiling results by dataset hash
4. Use IndexedDB for large dataset caching
5. Add cache invalidation on data change

**Files to Create**:
- `frontend/src/lib/cache.ts` - QueryCache implementation
- `frontend/src/lib/storage.ts` - IndexedDB wrapper

**Files to Modify**:
- `backend/services/groqService.ts` - Add caching
- `backend/services/dataContextService.ts` - Cache profiles

### Task 27: Dashboard Templates
- [x] **Status**: Complete
- **Priority**: P2
- **Effort**: Medium (1-2 days)

**Problem**: Users can apply chart templates for single charts, but there's no equivalent for quickly creating a multi-chart dashboard from a template.

**Implementation**:
1. Add `DashboardTemplate` and `DashboardTemplateChartSlot` types
2. Add `getChartTemplateById()` helper to chartTemplates.ts
3. Create 7 dashboard templates referencing existing chart template IDs (Sales Overview, Sales Pipeline, Marketing Dashboard, Executive Summary, Correlation Explorer, Operations Monitor, Financial Report)
4. Add `applyDashboardTemplate()` store action that auto-maps fields per chart, skips inapplicable charts, and compacts layout
5. Create `DashboardTemplateGallery.tsx` dialog with search, category filter, layout preview, per-chart applicability, and apply button
6. Wire gallery into DashboardGrid empty state ("From Template" button) and Add Chart dropdown

**Files Created**:
- `frontend/src/data/dashboardTemplates.ts` - 7 template definitions + applicability helpers
- `frontend/src/components/canvas/DashboardTemplateGallery.tsx` - Gallery dialog UI

**Files Modified**:
- `backend/types/index.ts` - DashboardTemplate types
- `frontend/src/data/chartTemplates.ts` - getChartTemplateById() export
- `frontend/src/store/useVizStore.ts` - applyDashboardTemplate action
- `frontend/src/components/canvas/DashboardGrid.tsx` - "From Template" button in empty state + Add Chart dropdown

### Task 28: AI Chat Accuracy & Robustness
- [x] **Status**: Completed
- **Priority**: P1
- **Effort**: Medium (1 day)

**Problem**: AI chat frequently misclassifies intent, picks wrong fields, and produces inaccurate charts due to weak prompts, simplistic field matching, and inconsistent guidance across request types.

**Implementation**:
1. **Scored Field Matching** — Replaced first-match-wins `findField()` with shared `findFieldFuzzy()` utility using 7-tier scoring: exact (100), normalized ignoring separators (90), startsWith (80), input-starts-with-field (75), whole-word boundary (70), contains substring (60), reverse contains (50), word-level partial (30-50). Replaced all 4 local findField implementations.
2. **Enhanced LLM Context** — Added field type grouping summary (Numeric/Categorical/Temporal) at top of `formatProfileForLLM()`. Always shows example values for categorical fields (up to 5 top values) for better field name matching.
3. **Improved Intent Detection** — Added DISAMBIGUATION RULES section with 9 explicit priority rules (including delete→modify_dashboard). Added previous intent hint from last assistant message. Expanded chat history window from 3→5 messages. Improved fallback modify regex to catch mid-sentence patterns (bigger, smaller, resize, recolor, sort by).
4. **Improved Chart Creation Prompt** — Fixed system message from generic "JSON generator" to "expert data visualization assistant". Added 3 few-shot examples (bar, line, histogram). Strengthened field name copy rules. Added IF REQUEST IS VAGUE default behavior.
5. **Upgraded Dashboard Prompt** — Replaced minimal ~400-char prompt with comprehensive version matching chart creation quality. Added field type summary, chart type guide, dashboard design rules, aggregation rules, retry context hints.
6. **Improved Modify Request** — Added system message emphasizing preservation. Reduced temperature 0.3→0.15 for deterministic output. Added PRESERVATION RULE section + 3 few-shot examples (bigger, chart type change, add color).
7. **Improved Data Question Prompt** — Used previously unused `fields` parameter. Added field list + exact field name instruction for generated queries. Added 3 few-shot examples. Added `response_format: { type: 'json_object' }` for reliable parsing.
8. **Better Error Messages** — Added actionable hints in catch blocks (chart: specify fields, modify: try simpler change, dashboard: specify fields). Added JSON parse error detection in useVizStore with rephrasing suggestion.
9. **Delete Chart — Dashboard Mode** — Delete/remove requests on focused dashboard charts now route to `modify_dashboard` instead of `modify`. Added 5 layers of protection: hard override in processAIQuery when focusedChartId is set + delete keyword detected, direct delete-by-ID shortcut in processModifyDashboardRequest (no LLM call needed), disambiguation rule in intent prompt, intent validation override (modify→modify_dashboard when delete keywords + dashboard), fallback regex with hasDashboard parameter.
10. **Delete Chart — Single Chart Mode** — Added `deleteChart` flag to `AIQueryResult` type. Delete requests in single chart mode (no dashboard) are intercepted before intent routing, returning `deleteChart: true` immediately. Store handles this by calling `resetChart()` with undo support. Delete detection requires both a delete keyword AND a target word to avoid false positives.

**Files Modified**:
- `backend/services/groqService.ts` — All prompts, field matching, error messages, delete routing (+260 lines)
- `backend/services/dataContextService.ts` — LLM context formatting with type grouping and examples
- `backend/types/index.ts` — Added `deleteChart` flag to `AIQueryResult`
- `frontend/src/store/useVizStore.ts` — JSON/parse error detection, deleteChart handler with resetChart + undo

---

## Task Summary by Priority

| Priority | Tasks | Estimated Effort |
|----------|-------|------------------|
| **P0** | 9 tasks (Security, Export, Errors, Onboarding) | ~5-6 days |
| **P1** | 7 tasks (Cross-filter, Calc fields, Connectors, Sharing) | ~10-12 days |
| **P2** | 7 tasks (AI enhancements, Templates, Aggregations, Drill-down, Dashboard Templates) | ~8-10 days |
| **Arch** | 4 tasks (Store split, Lazy loading, Caching) | ~5-6 days |

**Total Estimated Effort**: ~27-33 days (ongoing/flexible timeline)

---

## Recommended Implementation Order

### Phase 1: Foundation (Week 1-2)
1. Task 1: API Key Security (blocker)
2. Task 2: PNG/SVG Export
3. Task 4: Error Boundaries
4. Task 5: Toast Notifications
5. Task 7: Empty States
6. Task 8: Sample Datasets

### Phase 2: Polish & Export (Week 3-4)
7. Task 3: PowerPoint Export
8. Task 6: AI Retry Logic
9. Task 9: Contextual Tooltips
10. Task 15: Dashboard JSON Export/Import

### Phase 3: Competitive Features (Week 5-8)
11. Task 10: Cross-Chart Filtering
12. Task 11: Calculated Fields
13. Task 16: Shareable Links
14. Task 20: Chart Templates

### Phase 4: Connectors & AI (Week 9-12)
15. Task 12: Google Sheets Connector
16. Task 13: URL/API Data Source
17. Task 14: Scheduled Refresh
18. Task 17: AI Streaming
19. Task 18: AI Feedback

### Phase 5: Advanced & Architecture (Ongoing)
20. Task 19: AI Provider Fallback
21. Task 21: Advanced Aggregations
22. Task 22: Drill-Down
23. Task 23: Split Store
24. Task 25: Lazy Loading
25. Task 26: Caching Layer

---

## Files Reference (Most Impacted)

| File | Task IDs |
|------|----------|
| `frontend/src/store/useVizStore.ts` | 1, 5, 6, 10, 11, 14, 16, 17, 18, 22, 23, 28 |
| `frontend/src/components/canvas/Canvas.tsx` | 2, 3, 7, 9, 20 |
| `frontend/src/components/canvas/DashboardGrid.tsx` | 7, 10, 14, 15, 16 |
| `frontend/src/components/canvas/VizPreview.tsx` | 2, 10, 22 |
| `frontend/src/components/data-shelf/DataShelf.tsx` | 7, 8, 11, 12, 13, 15 |
| `frontend/src/components/ai/AIChat.tsx` | 6, 17, 18 |
| `backend/services/groqService.ts` | 1, 6, 11, 17, 19, 26, 28 |
| `backend/services/dataContextService.ts` | 28 |
| `backend/types/index.ts` | 10, 11, 14, 18, 21, 22, 28 |
| `backend/utils/echartsOptionBuilder.ts` | 10, 21, 22 |
| `frontend/src/services/exportService.ts` | 2, 3, 15 |

---

## Quick Reference: What's Skipped

The following items from the Product Analysis Report were explicitly skipped:
- **Keyboard shortcuts** - Can add later, not critical for MVP
- **Testing setup** - Unit/integration/E2E tests deferred

---

## Changelog

| Date | Change |
|------|--------|
| 2026-02-15 | Task 28 (AI Chat Accuracy & Robustness) completed - Scored field matching (7-tier findFieldFuzzy), enhanced LLM context with type grouping, intent disambiguation rules, few-shot examples for chart/dashboard/modify/question prompts, reduced modify temperature, improved error messages with actionable hints, delete chart routing fix for dashboard mode (5-layer protection with direct delete-by-ID shortcut), delete chart support in single chart mode (deleteChart flag + resetChart with undo) |
| 2026-02-14 | Task 27 (Dashboard Templates) completed - 7 pre-built dashboard templates (Sales, Marketing, Finance, Operations, General), DashboardTemplateGallery dialog with search/filter/layout preview, applyDashboardTemplate store action with auto-field mapping and layout compaction, wired into DashboardGrid empty state and Add Chart dropdown |
| 2026-02-14 | Task 22 (Drill-Down Navigation) completed - Temporal hierarchy detection (year→quarter→month→week→day), DrillBreadcrumb component with trail/up/reset, click-to-drill on VizPreview, drill data transformation in regenerateSpec, auto-clear on encoding/data change |
| 2026-02-14 | Task 20 (Chart Templates Gallery) completed - 17 templates across 5 categories, auto-field mapping by type+name patterns, TemplateGallery dialog with search/filter/preview, applyTemplate store action with undo support |
| 2026-02-14 | Task 19 (AI Provider Fallback) completed - AIProvider interface, GroqProvider/OpenAICompatibleProvider/AnthropicProvider, AIProviderManager with ordered fallback chain, streaming fallback, per-message provider attribution in UI, configurable provider order via env var |
| 2026-02-14 | Task 17 (AI Streaming Responses) completed - Real streaming via Groq SDK async generators, streamAIChatResponse, processAIQueryStreaming with onChunk callback, lazy message creation, streaming cursor in AIChat |
| 2026-02-14 | Task 14 (Scheduled Refresh) completed - Auto-refresh with interval selector (1m/5m/15m/1hr), refresh button, timestamp display, URL and Google Sheets re-fetch |
| 2026-02-14 | Task 12 (Google Sheets Connector) completed - GIS OAuth 2.0, Sheets API v4, 2-step connect+select dialog, DataSourceInfo tracking |
| 2026-02-14 | Task 13 (URL/API Data Source) completed - Fetch JSON/CSV from URLs with format auto-detection, custom headers, and JSON path navigation |
| 2026-02-14 | Task 11 (Calculated Fields) completed - Formula parser with 14 functions, dialog with field picker/validation, fx badge in DataShelf |
| 2026-02-14 | Task 10 (Cross-Chart Filtering) completed - Click-to-filter across dashboard charts with toggle, badge bar, and auto-cleanup |
| 2026-02-05 | Task 21 (Advanced Aggregations) completed - variance, stddev, % of total, cumulative sum with interactive dropdown in EncodingShelf |
| 2026-02-05 | Task 18 (AI Feedback Loop) completed - Thumbs up/down on AI messages with localStorage persistence |
| 2026-02-05 | Task 16 (Shareable Dashboard Links) completed - lz-string compression, Share button, auto-load from URL params |
| 2026-02-05 | Task 15 (Dashboard JSON Export/Import) completed - Export/import dashboard + dataset as JSON with schema validation |
| 2026-02-05 | Task 3 (PowerPoint Export) completed - pptxgenjs-based PPTX export for single charts and dashboards with dark theme slides |
| 2026-02-05 | Task 6 (AI Retry Logic) completed - User-friendly error messages, lastFailedQuery state, Retry button in AIChat |
| 2026-02-05 | Task 8 (Sample Datasets) completed - 3 sample CSV files with "Try Sample Data" dropdown in DataShelf |
| 2026-02-05 | Task 7 (Empty States) completed - Enhanced DataShelf, VizPreview, EncodingDeck with helpful empty states |
| 2026-02-04 | Task 9 (Contextual Tooltips) completed - Radix tooltips on encoding channels, chart types, action buttons |
| 2026-02-04 | Task 5 (Toast Notifications) completed - Sonner-based toast system with file/AI/export notifications |
| 2026-02-04 | Task 4 (Error Boundaries) completed - ErrorBoundary and ErrorFallback components with retry/report functionality |
| 2026-02-03 | Task 2 (PNG/SVG Export) completed - Export dropdown with resolution options (1x, 2x, 3x) |
| 2026-02-03 | Task 1 (API Key Security) completed - Cloudflare Worker proxy with rate limiting, retry logic |
| 2026-01-28 | Initial task list created from Product Analysis Report |
