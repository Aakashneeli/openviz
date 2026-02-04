# AI Features Implementation — Detailed Report

## Overview

Five AI-powered features were implemented across the OpenViz codebase. This document details every file created or modified, what was changed, and known build errors.

---

## Feature 1: Proactive Chart Recommendations

### What it does
When a user uploads a dataset, the system automatically analyzes all valid field pairs, scores them on type compatibility, cardinality, variance, and correlation, then presents the top 5 as clickable recommendation cards. Clicking "Apply" sets up the chart config and encodings instantly.

### Files Created

#### `backend/services/recommendationService.ts` (~170 lines)
- `scoreTypeCompatibility(xField, yField)` — Rates how well two field types pair (e.g., nominal x quantitative = 1.0, quantitative x quantitative = 0.8)
- `scoreCardinality(xField, yField)` — Penalizes too many or too few categories (sweet spot: 3-15 unique values)
- `scoreVariance(yField)` — Higher coefficient of variation = more interesting chart
- `scoreCorrelation(xField, yField, data)` — Pearson correlation for quantitative pairs (sampled at 200 rows)
- `selectMarkType(xField, yField)` — Reuses autoChart logic: temporal->line, quant x quant->scatter, nominal x quant->bar
- `generateReason(xField, yField, mark)` — Human-readable explanation
- `scoreChartCandidate(x, y, data)` — Weighted score: type 25%, cardinality 30%, variance 20%, correlation 15%, uniqueness 10%
- `generateRecommendations(fields, data, limit=5)` — Entry point, returns deduplicated top N

#### `frontend/src/components/recommendations/RecommendationPanel.tsx` (~85 lines)
- Renders only when: dataset is loaded, no encodings exist, recommendations array is non-empty
- Shows up to 5 cards with mark type icon, reason text, field names, "Apply" button, dismiss (X) button
- Styled with indigo gradient border, consistent with OpenViz dark theme

### Files Modified

#### `frontend/src/store/useVizStore.ts`
- **State added**: `chartRecommendations: ChartRecommendation[]`, `recommendationsLoading: boolean`
- **Actions added**:
  - `generateRecommendations()` — Dynamic imports `recommendationService`, calls `generateRecommendations()`, stores result
  - `applyRecommendation(rec)` — Finds fields by name, builds encodings array, sets chartConfig mark and title, calls `regenerateSpec()`
  - `dismissRecommendation(id)` — Filters out by ID
- **Modified**: `loadDataFromFile()` — Added `get().generateRecommendations()` call at the end after profiling
- **Selectors added**: `selectChartRecommendations`, `selectRecommendationsLoading`

#### `frontend/src/components/canvas/Canvas.tsx`
- Imported `RecommendationPanel`
- Mounted `<RecommendationPanel />` above the chart preview area inside the chart tab

#### `backend/types/index.ts`
- Added `ChartRecommendation` interface: `id, mark, xField, yField, colorField?, score, reason`

---

## Feature 2: Natural Language Data Filtering

### What it does
Users type filter requests in natural language (e.g., "Only show sales > 1000", "Filter to USA"). The AI parses the request into structured `FilterCondition[]` with fuzzy field matching. Data is filtered client-side and the chart re-renders with filtered data. An amber badge shows the filter status with row counts.

### Files Created

#### `backend/services/filterService.ts` (~90 lines)
- `evaluateCondition(record, condition)` — Switch on operator: eq, neq, gt, gte, lt, lte, contains, notContains, in, notIn, between
- `applyFilters(data, spec)` — Iterates conditions with and/or logic, returns filtered `DataRecord[]`
- `getFilterSummary(spec, originalCount, filteredCount)` — Human-readable summary string

### Files Modified

#### `backend/types/index.ts`
- Added `FilterOperator` type: `'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'notContains' | 'in' | 'notIn' | 'between'`
- Added `FilterCondition` interface: `field, operator, value, valueTo?`
- Added `FilterSpec` interface: `conditions: FilterCondition[], logic: 'and' | 'or'`
- Added `'filter'` to `AIIntent` union type
- Added `filterSpec?` to `AIQueryResult`

#### `backend/services/groqService.ts`
- **`detectIntent()` system prompt**: Added intent #7 "filter" with keywords: filter, only show, where, greater than, less than, exclude, between, remove rows
- **`detectIntent()` JSON format**: Updated to include `filter` in allowed intents
- **Intent mapping logic**: Added `if (intentStr.includes('filter')) finalIntent = 'filter'` (checked before other intents)
- **`fallbackIntentDetection()`**: Added regex `/\b(filter|only show|where|exclude|between|greater than|less than|remove rows)\b/i`
- **`processAIQuery()` switch**: Added `case 'filter': return processFilterRequest(...)`
- **New function `processFilterRequest()`** (~70 lines):
  - Sends field list with types/ranges/values to LLM
  - LLM returns JSON with conditions array + logic
  - Fuzzy matches field names (exact -> includes -> reverse includes)
  - Returns `AIQueryResult` with `filterSpec`

#### `frontend/src/store/useVizStore.ts`
- **State added**: `activeFilters: FilterSpec | null`, `filteredData: DataRecord[] | null`
- **Actions added**:
  - `applyFilter(spec)` — Dynamic imports `filterService`, calls `applyFilters()`, stores result, calls `regenerateSpec()`
  - `clearFilters()` — Resets to null, calls `regenerateSpec()`
- **Modified `regenerateSpec()`**: Changed `dataset.data` to `filteredData ?? dataset.data`
- **Modified `processAIQuery()` result handler**: Added check for `result.filterSpec` -> calls `applyFilter()` + adds chat message
- **Selectors added**: `selectActiveFilters`, `selectFilteredData`

#### `frontend/src/components/canvas/Canvas.tsx`
- Added amber filter badge below tabs: shows `Filter` icon, filtered/total row count, clear (X) button
- Wired to `clearFilters()` action

---

## Feature 3: Report Generation

### What it does
A "Report" button in the Canvas header and Dashboard toolbar opens a modal. Clicking "Generate Report" calls the LLM to produce an executive summary, chart narratives, and key findings. The report is displayed as formatted text and can be downloaded as a `.md` file.

### Files Created

#### `backend/services/reportService.ts` (~180 lines)
- `generateDataOverview(dataProfile)` — Pure computation: markdown table of fields, types, stats, data quality notes
- `generateExecutiveSummary(dataProfile, charts, generateNarrative)` — LLM call: 3-5 sentence summary with chart descriptions and field stats as context
- `generateChartNarrative(chartConfig, dataProfile, data, generateNarrative)` — LLM call per chart: 2-3 sentences about the specific chart with sample data
- `generateKeyFindings(dataProfile, data, generateNarrative)` — LLM call: 3-5 bullet points with specific numbers
- `generateFullReport(dataProfile, data, charts, datasetName, generateNarrative)` — Orchestrator: calls all above in sequence, returns `ReportData`
- `compileToMarkdown(report)` — Converts `ReportData` to markdown string with headers, sections, timestamp

#### `frontend/src/components/report/ReportGenerator.tsx` (~100 lines)
- Full-screen modal (fixed overlay with backdrop blur)
- Three states: empty (with "Generate Report" button), loading (spinner), rendered (formatted sections)
- Header with "Download .md" button and close button
- Renders each enabled section with title and content

### Files Modified

#### `backend/types/index.ts`
- Added `ReportSection` interface: `type, title, content, enabled`
- Added `ReportData` interface: `title, sections: ReportSection[], generatedAt: Date, datasetName`

#### `backend/services/groqService.ts`
- **New export `generateNarrative(prompt)`** (~15 lines): Generic LLM call with data analyst system prompt, temperature 0.3, used by reportService

#### `frontend/src/store/useVizStore.ts`
- **State added**: `reportData: ReportData | null`, `reportLoading: boolean`, `showReportModal: boolean`
- **Actions added**:
  - `generateReport()` — Async: imports reportService + groqService, collects charts (from single view or dashboard), calls `generateFullReport()`, sets state
  - `downloadReport()` — Creates markdown Blob, triggers download with dataset name
  - `setShowReportModal(show)` — Toggle modal visibility
- **Selectors added**: `selectReportData`, `selectReportLoading`, `selectShowReportModal`

#### `frontend/src/components/canvas/Canvas.tsx`
- Added "Report" button (FileText icon) in header next to "Insights" button
- Mounted `<ReportGenerator />` inside chart tab content

#### `frontend/src/components/canvas/DashboardGrid.tsx`
- Imported `FileText` icon and `ReportGenerator` component
- Added "Report" button in dashboard toolbar (before "Export PDF")
- Mounted `<ReportGenerator />` at end of dashboard content
- Destructured `setShowReportModal` from store

---

## Feature 4: Comparison Mode

### What it does
Users ask comparison questions like "Compare East vs West sales". The AI identifies the group field, two values, metric, and aggregation. The system splits data, aggregates both groups, calculates % change, and renders a grouped bar chart with comparison annotations.

### Files Created

#### `backend/services/comparisonService.ts` (~90 lines)
- `aggregateValues(data, field, agg)` — Supports sum, mean, count, min, max, median, distinct
- `executeComparison(data, spec)` — Filters data by group field values, aggregates both groups, calculates difference and % change, generates summary text
- `buildComparisonChartData(result, fields)` — Returns categories/values/colors for chart rendering

### Files Modified

#### `backend/types/index.ts`
- Added `ComparisonType`: `'category' | 'time_period' | 'metric'`
- Added `ComparisonSpec`: `type, groupField, groupValues: [string, string], metricField, aggregate`
- Added `ComparisonResult`: `spec, groupA: {label, value}, groupB: {label, value}, difference, percentChange, summary`
- Added `'compare'` to `AIIntent` union type
- Added `comparisonSpec?`, `comparisonResult?` to `AIQueryResult`

#### `backend/services/groqService.ts`
- **`detectIntent()` prompt**: Added intent #8 "compare" with keywords: compare, vs, versus, difference between, year over year
- **`fallbackIntentDetection()`**: Added regex for compare keywords
- **`processAIQuery()` switch**: Added `case 'compare'`
- **New function `processCompareRequest()`** (~80 lines):
  - Sends field list with categorical values to LLM
  - LLM returns groupField, groupValues, metricField, aggregate
  - Fuzzy matches fields
  - Dynamic imports `comparisonService`, calls `executeComparison()`
  - Builds a bar chart config for the comparison
  - Returns result with `comparisonSpec`, `comparisonResult`, `chartConfig`, `textAnswer`

#### `frontend/src/store/useVizStore.ts`
- **State added**: `comparisonMode: boolean`, `comparisonSpec: ComparisonSpec | null`, `comparisonResult: ComparisonResult | null`
- **Actions added**:
  - `applyComparison(spec)` — Dynamic imports comparisonService, executes, stores result, regenerates spec
  - `clearComparison()` — Resets state, regenerates spec
- **Modified `regenerateSpec()`**: When `comparisonResult` is present, adds markLine annotations (dashed reference lines for both group values)
- **Modified `processAIQuery()` handler**: Checks for `result.comparisonSpec && result.comparisonResult`, sets comparison state
- **Selectors added**: `selectComparisonMode`, `selectComparisonResult`

#### `frontend/src/components/canvas/Canvas.tsx`
- Added blue comparison badge: shows GitCompare icon, % change value, clear (X) button
- Wired to `clearComparison()` action

---

## Feature 5: Predictive Analytics (Forecasting)

### What it does
Users ask "Forecast next 6 months of sales". The AI identifies temporal and metric fields. The system selects the best method (linear regression, exponential smoothing, or Holt's linear trend) based on trend detection, generates forecast points with 95% confidence intervals, and overlays a dashed forecast line on the existing chart.

### Files Created

#### `backend/services/forecastService.ts` (~200 lines)
- `linearForecast(xValues, yValues, periods)` — Least squares regression, returns slope/intercept + forecast points
- `exponentialSmoothing(values, alpha, periods)` — Simple ES with alpha=0.3, flat forecast
- `holtsLinearTrend(values, alpha, beta, periods)` — Double exponential smoothing for trended data
- `addConfidenceIntervals(actuals, predicted, forecasts)` — Calculates residual std dev, adds +/- 1.96 sigma bands widening with distance
- `hasTrend(values)` — Checks if slope > 5% of mean per step
- `selectBestMethod(values)` — If <5 points: linear; if trend: Holt's; else: ES
- `generateForecast(data, temporalField, metricField, periods)` — Entry point: sorts data, extracts values, selects method, generates forecast with confidence intervals

### Files Modified

#### `backend/types/index.ts`
- Added `ForecastPoint`: `x: string|number, y: number, lower?: number, upper?: number`
- Added `ForecastResult`: `method, periods, points: ForecastPoint[], accuracy?, temporalField, metricField`
- Added `'forecast'` to `AIIntent` union type
- Added `forecastResult?` to `AIQueryResult`

#### `backend/services/groqService.ts`
- **`detectIntent()` prompt**: Added intent #9 "forecast" with keywords: forecast, predict, project, next X months, future, extrapolate
- **`fallbackIntentDetection()`**: Added regex for forecast keywords
- **`processAIQuery()` switch**: Added `case 'forecast'`
- **New function `processForecastRequest()`** (~70 lines):
  - Sends field list to LLM
  - LLM returns temporalField, metricField, periods
  - Fuzzy matches fields with fallback to first temporal/quantitative
  - Dynamic imports `forecastService`, calls `generateForecast()`
  - Builds a line chart config
  - Returns result with `chartConfig`, `forecastResult`, `textAnswer`

#### `frontend/src/store/useVizStore.ts`
- **State added**: `forecastData: ForecastResult | null`, `forecastLoading: boolean`
- **Actions added**:
  - `generateForecast(periods?)` — Gets x/y encodings, dynamic imports forecastService, stores result, regenerates spec
  - `clearForecast()` — Resets state, regenerates spec
- **Modified `regenerateSpec()`**: When `forecastData` is present:
  - Appends a dashed line series (cyan #06b6d4, diamond markers) for forecast points
  - Appends a semi-transparent area series for confidence interval bands
- **Modified `processAIQuery()` handler**: Checks for `result.forecastResult`, sets forecast state, regenerates spec
- **Selectors added**: `selectForecastData`, `selectForecastLoading`

#### `frontend/src/components/canvas/Canvas.tsx`
- Added cyan forecast badge: shows TrendingUp icon, period count, clear (X) button
- Wired to `clearForecast()` action

---

## Cross-Cutting Changes Summary

### `backend/types/index.ts`
- 3 new intent values in `AIIntent` union: `filter`, `compare`, `forecast`
- 3 new optional fields in `AIQueryResult`: `filterSpec`, `comparisonSpec`+`comparisonResult`, `forecastResult`
- 10 new type definitions across all features

### `backend/services/groqService.ts`
- Updated import list (added `FilterSpec`, `ComparisonSpec`)
- `detectIntent()` system prompt: added 3 intent descriptions (#7, #8, #9)
- `detectIntent()` JSON format: added 3 new intents to allowed values
- Intent mapping: added 3 new checks (before existing intents for priority)
- `fallbackIntentDetection()`: added 3 new regex patterns
- `processAIQuery()` switch: added 3 new cases
- 3 new async processor functions (~220 lines total)
- 1 new export `generateNarrative()` (~15 lines)

### `frontend/src/store/useVizStore.ts`
- 13 new state fields across VizState interface
- 11 new action methods across VizActions interface
- 11 new initial state values
- Modified `regenerateSpec()` to handle filtered data, forecast overlay, comparison annotations
- Modified `processAIQuery()` result handler for 3 new result types
- Modified `loadDataFromFile()` to trigger recommendations
- 10 new selector exports

### `frontend/src/components/canvas/Canvas.tsx`
- 6 new imports (icons + components + selectors)
- 7 new store bindings
- Report button in header
- 3 feature badges (filter/comparison/forecast) with clear buttons
- Mounted `RecommendationPanel` and `ReportGenerator`

### `frontend/src/components/canvas/DashboardGrid.tsx`
- Report button in dashboard toolbar
- Mounted `ReportGenerator` modal

---

## Known Build Errors

### Errors Introduced by This Implementation

| File | Line | Error | Cause |
|------|------|-------|-------|
| `groqService.ts` | ~1781 | `'dataProfile' is declared but its value is never read` | `processFilterRequest` receives `dataProfile` param but doesn't use it (only uses `fields`) |
| `groqService.ts` | ~1882 | `'dataProfile' is declared but its value is never read` | `processCompareRequest` receives `dataProfile` but only uses `fields` and `data` |
| `groqService.ts` | ~1995 | `'dataProfile' is declared but its value is never read` | `processForecastRequest` receives `dataProfile` but only uses `fields` and `data` |
| `groqService.ts` | ~2123 | `Expected 5 arguments, but got 4` | One of the processor calls in `processAIQuery()` switch may be missing an argument |
| `reportService.ts` | ~95 | `'dataProfile' is declared but its value is never read` | `generateChartNarrative` receives `dataProfile` but doesn't reference it in the function body |
| `useVizStore.ts` | ~1182 | `'compileToMarkdown' is declared but its value is never read` | `generateReport()` action imports `compileToMarkdown` but it's only used in `downloadReport()` |
| `useVizStore.ts` | ~1335 | `Type 'unknown[]' is not assignable to type 'SeriesOption'` | `regenerateSpec()` pushes forecast series to `option.series` cast as `unknown[]`, needs proper ECharts typing |
| `Canvas.tsx` | ~28 | `'generateReport' is declared but its value is never read` | Destructured `generateReport` from store but only `setShowReportModal` is used in the component |

### Pre-Existing Errors (Not Caused by This Implementation)

| File | Line | Error |
|------|------|-------|
| `annotationService.ts` | 86, 187 | Unused variables (`fieldName`, `sumY2`) |
| `groqService.ts` | 749 | Unused `context` variable |
| `autoChart.ts` | 173 | `Record<MarkType, string>` missing new mark types (tree, boxplot, etc.) |
| `echartsOptionBuilder.ts` | 557 | Treemap `breadcrumb.textStyle` not in ECharts type |
| `vegaSpecBuilder.ts` | 9, 50 | Missing `VegaLiteSpec` export, incomplete mark type record |
| `useVizStore.ts` | 352, 396, 405 | `vegaSpec` property doesn't exist on state (legacy code) |

### How to Fix the New Errors

1. **Unused params**: Prefix with underscore (`_dataProfile`) in `processFilterRequest`, `processCompareRequest`, `processForecastRequest`, `generateChartNarrative`
2. **Missing argument** (line ~2123): Check which processor call in `processAIQuery` switch is missing the `data` argument
3. **Unused import**: Remove `compileToMarkdown` from the `generateReport()` import, keep it only in `downloadReport()`
4. **Series typing**: Cast the series array properly: `(option.series as Record<string, unknown>[])` or use ECharts `SeriesOption` type
5. **Unused destructure**: Remove `generateReport` from Canvas.tsx destructuring (modal handles the trigger internally via `setShowReportModal`)
