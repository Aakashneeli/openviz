# OpenViz Implementation Tasks

> **Generated**: January 28, 2026
> **Based on**: OpenViz_Product_Analysis_Report.md
> **Timeline**: Ongoing/Flexible
> **Last Updated**: February 3, 2026

---

## Quick Status

### Completed Tasks (2/26)
| # | Task | Priority |
|---|------|----------|
| 1 | API Key Security (Cloudflare Worker Proxy) | P0 |
| 2 | PNG/SVG Image Export | P0 |

### Next Up
| # | Task | Priority |
|---|------|----------|
| 4 | Error Boundaries | P0 |
| 5 | Toast Notifications | P0 |
| 7 | Empty States (Onboarding) | P0 |
| 8 | Sample Datasets | P0 |

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
| P0 - Critical | 9 | 2 | 0 |
| P1 - High | 7 | 0 | 0 |
| P2 - Medium | 6 | 0 | 0 |
| Architecture | 4 | 0 | 0 |
| **Total** | **26** | **2** | **0** |

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
- [ ] **Status**: Not Started
- **Priority**: P0
- **Effort**: Medium (1-2 days)

**Problem**: Enterprise users need PPTX export for presentations

**Implementation**:
1. Install `pptxgenjs` library
2. Create export function that converts chart to slide
3. Support single chart and full dashboard export
4. Add template options (title slide, chart slides)

**Files to Create**:
- `frontend/src/services/pptxExportService.ts` - PowerPoint generation

**Files to Modify**:
- `frontend/src/services/exportService.ts` - Add `exportToPPTX()`
- `frontend/src/components/canvas/Canvas.tsx` - Add PPTX to export menu
- `frontend/src/components/canvas/DashboardGrid.tsx` - Dashboard to PPTX

---

### Task 4: Error Handling - Error Boundaries
- [ ] **Status**: Not Started
- **Priority**: P0
- **Effort**: Low (half day)

**Problem**: No graceful error recovery, app can crash on errors

**Implementation**:
1. Create `ErrorBoundary` component with fallback UI
2. Wrap major sections: Canvas, AIChat, DataShelf, EncodingDeck
3. Add "Retry" and "Report Bug" buttons in fallback
4. Log errors to console (or analytics service later)

**Files to Create**:
- `frontend/src/components/ui/ErrorBoundary.tsx`
- `frontend/src/components/ui/ErrorFallback.tsx`

**Files to Modify**:
- `frontend/src/App.tsx` - Wrap top-level with ErrorBoundary
- `frontend/src/components/layout/AppLayout.tsx` - Wrap sections

---

### Task 5: Error Handling - Toast Notifications
- [ ] **Status**: Not Started
- **Priority**: P0
- **Effort**: Low (half day)

**Problem**: No feedback for errors or success actions

**Implementation**:
1. Install `sonner` or use Radix Toast primitive
2. Create toast utility functions: `toast.success()`, `toast.error()`, `toast.info()`
3. Add toasts for: file upload success/error, AI query failure, export complete, save success
4. Position at bottom-right, auto-dismiss after 4s

**Files to Create**:
- `frontend/src/components/ui/Toaster.tsx` - Toast container
- `frontend/src/lib/toast.ts` - Toast utility functions

**Files to Modify**:
- `frontend/src/App.tsx` - Add Toaster component
- `frontend/src/store/useVizStore.ts` - Add toasts to key actions

---

### Task 6: Error Handling - AI Retry Logic
- [ ] **Status**: Not Started
- **Priority**: P0
- **Effort**: Low (half day)

**Problem**: AI calls can fail silently without retry

**Implementation**:
1. Add exponential backoff retry (3 attempts: 1s, 2s, 4s)
2. Show "Retrying..." status in AI chat
3. On final failure, show friendly error with manual retry option
4. Add "AI temporarily unavailable" fallback message

**Files to Modify**:
- `backend/services/groqService.ts` - Add retry wrapper
- `frontend/src/store/useVizStore.ts` - Handle retry states
- `frontend/src/components/ai/AIChat.tsx` - Show retry status

---

### Task 7: Onboarding - Empty States
- [ ] **Status**: Not Started
- **Priority**: P0
- **Effort**: Low (1 day)

**Problem**: New users see blank panels with no guidance

**Implementation**:
1. Design empty state for DataShelf: "Drop a CSV or Excel file here to get started"
2. Design empty state for Canvas: Show preview image + "Upload data to create charts"
3. Design empty state for Dashboard: "Add your first chart" with + button
4. Add file format hints and max size info

**Files to Modify**:
- `frontend/src/components/data-shelf/DataShelf.tsx` - Empty state
- `frontend/src/components/canvas/Canvas.tsx` - Empty state
- `frontend/src/components/canvas/DashboardGrid.tsx` - Empty state
- `frontend/src/components/encoding-deck/EncodingDeck.tsx` - Hints when no data

---

### Task 8: Onboarding - Sample Datasets
- [ ] **Status**: Not Started
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

**Files to Create**:
- `frontend/public/samples/sales_data.csv`
- `frontend/public/samples/stock_prices.csv`
- `frontend/public/samples/website_analytics.csv`
- `frontend/src/data/sampleDatasets.ts` - Sample data definitions

**Files to Modify**:
- `frontend/src/components/data-shelf/DataShelf.tsx` - Add sample selector

---

### Task 9: Onboarding - Contextual Tooltips
- [ ] **Status**: Not Started
- **Priority**: P0
- **Effort**: Low (half day)

**Problem**: Features aren't self-explanatory

**Implementation**:
1. Add Radix Tooltip to key UI elements
2. Add tooltips to: encoding channels, chart type icons, AI chat button, export buttons
3. Use consistent styling with dark background
4. Show on hover with 300ms delay

**Files to Modify**:
- `frontend/src/components/encoding-deck/EncodingShelf.tsx` - Channel tooltips
- `frontend/src/components/encoding-deck/ChartTypeSelector.tsx` - Chart type descriptions
- `frontend/src/components/ai/AIChat.tsx` - AI feature hints
- `frontend/src/components/canvas/Canvas.tsx` - Action button tooltips

---

## P1 - High Priority (Competitive Differentiators)

### Task 10: Cross-Chart Filtering
- [ ] **Status**: Not Started
- **Priority**: P1
- **Effort**: High (2-3 days)

**Problem**: Charts in dashboards are isolated - clicking one doesn't filter others

**Implementation**:
1. Add `CrossFilter` type and `crossFilters` array to `DashboardConfig`
2. Add `crossFilterEnabled` toggle to dashboard settings
3. Implement click handler on charts to set filter
4. Filter other charts when cross-filter is active
5. Show "Filtering by: X" badge with clear button
6. Support clicking same value to toggle off

**Types to Add** (`backend/types/index.ts`):
```typescript
interface CrossFilter {
  sourceChartId: string;
  field: string;
  value: string | number | string[];
  operator: 'eq' | 'in';
}
```

**Files to Modify**:
- `backend/types/index.ts` - Add CrossFilter type
- `frontend/src/store/useVizStore.ts` - Add cross-filter state + actions
- `frontend/src/components/canvas/DashboardGrid.tsx` - Click handlers, filter badge
- `frontend/src/components/canvas/VizPreview.tsx` - Chart click events
- `backend/utils/echartsOptionBuilder.ts` - Apply filters to chart data

---

### Task 11: Calculated Fields
- [ ] **Status**: Not Started
- **Priority**: P1
- **Effort**: High (3-4 days)

**Problem**: Users can't create derived metrics (profit margin, YoY change)

**Implementation**:
1. Add "New Calculated Field" button in DataShelf
2. Create formula input dialog with field picker
3. Support basic arithmetic: `+`, `-`, `*`, `/`, `()`
4. Support functions: `SUM()`, `AVG()`, `IF()`, `CONCAT()`
5. Parse formula and compute using Arquero
6. Add calculated field to field list (marked with fx icon)
7. Allow AI to create calculated fields via NL

**Types to Add**:
```typescript
interface CalculatedField {
  id: string;
  name: string;
  formula: string;
  resultType: FieldType;
  referencedFields: string[];
  createdBy: 'user' | 'ai';
}
```

**Files to Create**:
- `frontend/src/components/data-shelf/CalculatedFieldDialog.tsx`
- `backend/services/formulaParser.ts` - Parse and evaluate formulas
- `backend/utils/formulaFunctions.ts` - Built-in functions

**Files to Modify**:
- `backend/types/index.ts` - Add CalculatedField type
- `frontend/src/store/useVizStore.ts` - Add calculated fields state
- `frontend/src/components/data-shelf/DataShelf.tsx` - Add create button
- `backend/services/groqService.ts` - AI formula creation intent

---

### Task 12: Google Sheets Connector
- [ ] **Status**: Not Started
- **Priority**: P1
- **Effort**: High (2-3 days)

**Problem**: File upload only limits use cases

**Implementation**:
1. Set up Google OAuth 2.0 flow
2. Create Sheets picker UI to select spreadsheet
3. Fetch data via Google Sheets API
4. Parse and profile like file upload
5. Store connection for refresh capability

**Files to Create**:
- `frontend/src/services/googleSheetsService.ts` - OAuth + API calls
- `frontend/src/components/data-shelf/GoogleSheetsConnector.tsx` - UI

**Files to Modify**:
- `frontend/src/components/data-shelf/DataShelf.tsx` - Add connector option
- `frontend/src/store/useVizStore.ts` - Add data source type
- `frontend/.env` - Add `VITE_GOOGLE_CLIENT_ID`

---

### Task 13: URL/API Data Source
- [ ] **Status**: Not Started
- **Priority**: P1
- **Effort**: Medium (1-2 days)

**Problem**: Can't fetch data from URLs or REST APIs

**Implementation**:
1. Add "Import from URL" option in DataShelf
2. Support JSON and CSV URLs
3. Add optional headers for authenticated APIs
4. Parse response and profile data
5. Store URL for refresh capability

**Files to Create**:
- `frontend/src/components/data-shelf/URLImportDialog.tsx`
- `frontend/src/services/urlDataService.ts`

**Files to Modify**:
- `frontend/src/components/data-shelf/DataShelf.tsx` - Add URL option
- `frontend/src/store/useVizStore.ts` - Add URL data source handling

---

### Task 14: Scheduled Refresh
- [ ] **Status**: Not Started
- **Priority**: P1
- **Effort**: Medium (1-2 days)

**Problem**: Dashboards are static snapshots

**Implementation**:
1. Add `refreshInterval` to DashboardConfig (null, 1min, 5min, 15min, 1hr)
2. Add refresh interval selector in dashboard settings
3. Implement auto-refresh using setInterval
4. Show "Last updated: X ago" timestamp
5. Show spinner during refresh
6. Re-fetch data from source (URL, Sheets) and regenerate charts

**Files to Modify**:
- `backend/types/index.ts` - Add refreshInterval to DashboardConfig
- `frontend/src/store/useVizStore.ts` - Add refresh logic
- `frontend/src/components/canvas/DashboardGrid.tsx` - Interval selector, timestamp, spinner

---

### Task 15: Dashboard JSON Export/Import
- [ ] **Status**: Not Started
- **Priority**: P1
- **Effort**: Low (half day)

**Problem**: Can't backup or share dashboards

**Implementation**:
1. Add "Export JSON" button in dashboard header
2. Export `dashboardConfig` + `dataset` as JSON file
3. Add "Import Dashboard" option in DataShelf
4. Parse JSON and restore state
5. Validate schema before import

**Files to Modify**:
- `frontend/src/components/canvas/DashboardGrid.tsx` - Export button
- `frontend/src/components/data-shelf/DataShelf.tsx` - Import option
- `frontend/src/services/exportService.ts` - Add JSON export/import

---

### Task 16: Shareable Dashboard Links
- [ ] **Status**: Not Started
- **Priority**: P1
- **Effort**: Medium (1 day)

**Problem**: Can't share dashboards with others without backend

**Implementation**:
1. Compress dashboard state using `lz-string`
2. Encode compressed state in URL query param
3. Add "Copy share link" button
4. On page load, check for `?state=` param and restore
5. Show warning for large datasets (URL length limits)

**Files to Create**:
- `frontend/src/services/shareService.ts` - Compress, encode, decode

**Files to Modify**:
- `frontend/src/components/canvas/DashboardGrid.tsx` - Share button
- `frontend/src/App.tsx` - Check URL params on mount
- `frontend/src/store/useVizStore.ts` - Add `loadFromShareURL()` action

---

## P2 - Medium Priority

### Task 17: AI Streaming Responses
- [ ] **Status**: Not Started
- **Priority**: P2
- **Effort**: Medium (1-2 days)

**Problem**: AI responses appear all at once after delay

**Implementation**:
1. Use Groq streaming API (`stream: true`)
2. Update proxy to forward SSE stream
3. Show response character-by-character in chat
4. Add typing indicator during stream

**Files to Modify**:
- `cloudflare-worker/src/index.ts` - Handle streaming
- `backend/services/groqService.ts` - Add streaming function
- `frontend/src/store/useVizStore.ts` - Handle streaming state
- `frontend/src/components/ai/AIChat.tsx` - Render streaming text

---

### Task 18: AI Feedback Loop
- [ ] **Status**: Not Started
- **Priority**: P2
- **Effort**: Low (half day)

**Problem**: No way to know if AI responses are helpful

**Implementation**:
1. Add 👍/👎 buttons on AI messages
2. Store feedback in localStorage (or send to analytics later)
3. Use feedback to improve prompts over time
4. Show "Thanks for feedback!" toast

**Files to Modify**:
- `frontend/src/components/ai/AIChat.tsx` - Add feedback buttons
- `frontend/src/store/useVizStore.ts` - Store feedback
- `backend/types/index.ts` - Add feedback field to AIMessage

---

### Task 19: AI Provider Fallback
- [ ] **Status**: Not Started
- **Priority**: P2
- **Effort**: High (2-3 days)

**Problem**: If Groq is down, AI features completely fail

**Implementation**:
1. Create `AIProvider` interface abstraction
2. Implement `GroqProvider`, `ClaudeProvider`, `OpenAIProvider`
3. Add fallback logic: try Groq -> if fails, try Claude -> if fails, try OpenAI
4. Show which provider was used in response
5. Add provider config to settings

**Files to Create**:
- `backend/services/aiProvider.ts` - Interface + factory
- `backend/services/providers/groqProvider.ts`
- `backend/services/providers/claudeProvider.ts`
- `backend/services/providers/openaiProvider.ts`

**Files to Modify**:
- `backend/services/groqService.ts` - Use provider abstraction

---

### Task 20: Chart Templates Gallery
- [ ] **Status**: Not Started
- **Priority**: P2
- **Effort**: Medium (1-2 days)

**Problem**: Users start from scratch every time

**Implementation**:
1. Create template definitions with pre-set encodings
2. Build template browser UI with categories (Sales, Marketing, Operations)
3. Allow applying template to current data
4. Auto-map fields by type when applying template
5. Add "Save as Template" for user-created charts

**Files to Create**:
- `frontend/src/components/canvas/TemplateGallery.tsx`
- `frontend/src/data/chartTemplates.ts` - Template definitions

**Files to Modify**:
- `frontend/src/components/canvas/Canvas.tsx` - Add template button
- `frontend/src/store/useVizStore.ts` - Template application logic

---

### Task 21: Advanced Aggregations
- [ ] **Status**: Not Started
- **Priority**: P2
- **Effort**: Medium (1-2 days)

**Problem**: Only basic aggregations (sum, mean, count) available

**Implementation**:
1. Add new aggregation functions to EncodingShelf dropdown
2. Implement using Arquero:
   - `cumulative_sum` - Running totals
   - `percent_of_total` - Composition analysis
   - `moving_average` - Trend smoothing (7-day window)
   - `percentile` - Distribution analysis
   - `rank` - Leaderboards
   - `variance`, `stddev` - Dispersion

**Files to Modify**:
- `backend/types/index.ts` - Extend AggregateFunction type
- `backend/utils/echartsOptionBuilder.ts` - Implement aggregations
- `frontend/src/components/encoding-deck/EncodingShelf.tsx` - Add to dropdown

---

### Task 22: Drill-Down Functionality
- [ ] **Status**: Not Started
- **Priority**: P2
- **Effort**: High (2-3 days)

**Problem**: Can't explore data hierarchies (Year -> Quarter -> Month)

**Implementation**:
1. Detect hierarchical fields automatically (temporal, geographic)
2. Add drill-down click handler on chart axes
3. Show breadcrumb trail: "2024 > Q3 > August"
4. Add "drill up" button
5. Support temporal: year > quarter > month > week > day
6. Support geographic: country > state > city

**Types to Add**:
```typescript
interface DrillPath {
  field: string;
  value: string | number;
  level: number;
}
```

**Files to Create**:
- `frontend/src/components/canvas/DrillBreadcrumb.tsx`
- `backend/services/drillService.ts` - Hierarchy detection

**Files to Modify**:
- `frontend/src/store/useVizStore.ts` - Drill state
- `frontend/src/components/canvas/VizPreview.tsx` - Drill click handlers
- `backend/utils/echartsOptionBuilder.ts` - Apply drill filters

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

---

## Task Summary by Priority

| Priority | Tasks | Estimated Effort |
|----------|-------|------------------|
| **P0** | 9 tasks (Security, Export, Errors, Onboarding) | ~5-6 days |
| **P1** | 7 tasks (Cross-filter, Calc fields, Connectors, Sharing) | ~10-12 days |
| **P2** | 6 tasks (AI enhancements, Templates, Aggregations, Drill-down) | ~7-9 days |
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
| `frontend/src/store/useVizStore.ts` | 1, 5, 6, 10, 11, 14, 16, 17, 18, 22, 23 |
| `frontend/src/components/canvas/Canvas.tsx` | 2, 3, 7, 9, 20 |
| `frontend/src/components/canvas/DashboardGrid.tsx` | 7, 10, 14, 15, 16 |
| `frontend/src/components/canvas/VizPreview.tsx` | 2, 10, 22 |
| `frontend/src/components/data-shelf/DataShelf.tsx` | 7, 8, 11, 12, 13, 15 |
| `frontend/src/components/ai/AIChat.tsx` | 6, 17, 18 |
| `backend/services/groqService.ts` | 1, 6, 11, 17, 19, 26 |
| `backend/types/index.ts` | 10, 11, 14, 18, 21, 22 |
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
| 2026-02-03 | Task 2 (PNG/SVG Export) completed - Export dropdown with resolution options (1x, 2x, 3x) |
| 2026-02-03 | Task 1 (API Key Security) completed - Cloudflare Worker proxy with rate limiting, retry logic |
| 2026-01-28 | Initial task list created from Product Analysis Report |
