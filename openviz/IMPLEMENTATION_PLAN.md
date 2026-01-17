# OpenViz Master Implementation Plan

This document outlines the step-by-step implementation strategy for the OpenViz platform, spanning three major phases.

> **Status Legend**:
> - ✅ **Completed**: Implemented and verified.
> - 🚧 **In Progress**: Currently being developed.
> - 📅 **Planned**: Scheduled for future sprints.

---

## 🟢 Phase 1: Core Foundation & Trust (✅ Completed)

**Goal**: Establish the "Smart Data" capabilities and build user trust through transparency.

### 1.1 Smart Data Profiler 2.0
- **Objective**: Automatically detect semantic types (Email, Currency, etc.) beyond basic numbers/strings.
- **Implementation**:
    - [x] Create `SemanticType` regex patterns in `schemaInference.ts`.
    - [x] Update `FieldInfo` interface to include `semanticType`.
    - [x] Update `DraggableField` UI to show semantic badges (Mail, Dollar, Globe icons).

### 1.2 Transparency Mode ("Show Your Work")
- **Objective**: Allow users to see the raw code behind AI-generated charts.
- **Implementation**:
    - [x] Create `CodePreview.tsx` component with JSON syntax highlighting.
    - [x] Update `AIMessage` type to store `echartsOption`.
    - [x] Add "Peek Code" toggle in `AIChat.tsx`.

### 1.3 Enhanced Data Shelf
- **Objective**: Improve drag-and-drop feedback.
- **Implementation**:
    - [x] Implement `DragOverlay` in `AppLayout.tsx`.
    - [x] Add ghost styling and semantic icons to dragged items.

---

## 🟡 Phase 2: The "Thinking" Canvas (🚧 Next Up)

**Goal**: Transform static charts into interactive exploration tools.

### 2.1 The "Data Painter" (Interactive Selection)
**Goal**: Allow users to "paint" (select) data points on a chart and get instant comparison insights.

#### Technical Steps
1.  **Enable Brushing**
    -   Modify `Canvas.tsx` to enable ECharts `brush` component.
    -   Add `onChartBrushSelected` handler in `useVizStore`.
    -   Store selected data indices in `VizState.selectedIndices`.

2.  **Selection Context Service**
    -   Create `backend/services/explanationService.ts`.
    -   Implement `compareSubsets(fullData, selectedIndices)` function.
    -   Calculate Z-score differences for quantitative fields: `(Mean_Selected - Mean_Global) / StdDev_Global`.

3.  **Insight Overlay**
    -   Create `InsightToast.tsx` component that appears when selection happens.
    -   Display top 3 insights (e.g., *"Selected points have 45% higher Sales"*).

### 2.2 Dashboard Templates Registry
**Goal**: Replace inconsistent AI generation with high-quality, pre-built grids.

#### Technical Steps
1.  **Template Definitions**
    -   Create `backend/templates/index.ts`.
    -   Define `DashboardTemplate` interface (grid layout + named slots).
    -   Implement `SaaS_KPI` and `Sales_Overview` templates.

2.  **Intelligent Slot Mapping**
    -   Update `groqService.ts` to support `intent: 'dashboard_template'`.
    -   Logic: Map user's available fields (e.g., "Amount") to template slots (e.g., "BigNumber_Primary").

3.  **Dashboard UI**
    -   Update `DashboardGrid.tsx` to render based on strict template layouts.

### 2.3 Smart Annotations
**Goal**: AI automatically highlights outliers and trends.

#### Technical Steps
1.  **Annotation Logic**
    -   Extend `processAIQuery` to return `annotations` array.
    -   Use `architect` (Arquero) to detect max/min points.
2.  **ECharts Integration**
    -   Map annotations to ECharts `markPoint` and `markLine` components.

---

## 🔴 Phase 3: Advanced Analytics (📅 Planned)

**Goal**: Bring desktop-class forecasting and privacy to the browser.

### 3.1 Client-Side Forecasting
**Goal**: Run predictive models in the browser without sending data to a server.

#### Technical Steps
1.  **Forecasting Engine**
    -   Install `regression` or simple-statistics library.
    -   Implement `calculateTrendLine(data)` and `predictNext(data, steps)`.
2.  **Web Worker**
    -   Move heavy calculation to `forecasting.worker.ts` to prevent UI freeze.
3.  **Visual Toggle**
    -   Add "Show Forecast" toggle to Line Chart toolbar.

### 3.2 Parameterized Dashboards ("What-If")
**Goal**: Add sliders that filter or adjust multiple charts.

#### Technical Steps
1.  **Global Parameters**
    -   Add `parameters` slice to `useVizStore`.
    -   Create `ParameterSlider` component.
2.  **Reactive Filtering**
    -   Update `echartsSpecBuilder` to apply parameter equations (e.g., `Sales * (1 + $growth_rate)`).

### 3.3 Local LLM Privacy Mode
**Goal**: Zero-data-exfiltration AI.

#### Technical Steps
1.  **WebLLM Integration**
    -   Integrate MLC LLM (WebLLM) for browser-based Llama-3-8B execution.
2.  **Model Management**
    -   Create UI for downloading/caching model weights (2GB+).
    -   Abstract AI service interface to switch between `GroqService` and `LocalService`.
