# OpenViz Project Overview

> **System Memory Document**
> *This document serves as the primary source of truth for the OpenViz project. It details the architecture, feature set, AI integration, and development standards. AI agents should read this file to understand the context before making changes.*

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
- **Framework**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Language**: [TypeScript 5.9](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/) + custom CSS variables.
- **State Management**: [Zustand](https://github.com/pmndrs/zustand) (with DevTools).
- **Visualization**: [Vega-Lite](https://vega.github.io/vega-lite/) + [React-Vega](https://github.com/vega/react-vega).
- **AI/LLM**: [Groq SDK](https://console.groq.com/) (running Llama 3/4 models).
- **Data Processing**: [Arquero](https://uwdata.github.io/arquero/) (fast dataframes) + [PapaParse](https://www.papaparse.com/).
- **UI Primitives**: [Radix UI](https://www.radix-ui.com/) + [Lucide React](https://lucide.dev/).
- **Drag & Drop**: [dnd-kit](https://dndkit.com/).

### Directory Structure
```
src/
├── components/
│   ├── ai/              # Chat interface, Insight cards
│   ├── canvas/          # Main chart rendering area, Dashboard grid
│   ├── data-shelf/      # Sidebar for field list, draggables
│   ├── encoding-deck/   # Right sidebar for channel mapping (x, y, color...)
│   ├── layout/          # App shell, MainLayout, Headers
│   └── ui/              # Reusable atoms (Button, Input, Dialog) mechanism
├── lib/                 # Third-party library configurations
├── services/
│   ├── dataContextService.ts  # Statistical profiling for AI context
│   └── groqService.ts         # LLM communication layer
├── store/
│   └── useVizStore.ts   # CENTRAL BRAIN: Manages dataset, charts, and UI state
├── utils/
│   ├── autoChart.ts         # Heuristics for default charts
│   ├── schemaInference.ts   # Type detection (Quantitative vs Nominal)
│   └── vegaSpecBuilder.ts   # Compiles store state -> Vega-Lite JSON
└── App.tsx              # Root component
```

### State Management (`useVizStore.ts`)
The entire application state is centralized in a single Zustand store. This enables features like global Undo/Redo and seamless serialization.
- **Data Slice**: Raw data (`dataset`), inferred schema (`fields`), and upload status.
- **Encoding Slice**: Array of `ShelfPlacement` objects mapping `Field -> Channel`.
- **Chart Slice**: High-level config (mark type, title, sorting).
- **AI Slice**: Chat history, generated insights, and suggestion state.
- **UI Slice**: Sidebar toggles, active view modes.

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
5. **Store Update**: The processed dataset and schema are saved to `useVizStore`.

### 3.2. Visual Encoding (The "Deck")
Instead of writing code, users drag fields from the **Data Shelf** to the **Encoding Deck**.
- **Logic**: When a field is dropped on the "X-Axis" zone, a `ShelfPlacement` is added to the store.
- **Compilation**: `vegaSpecBuilder.ts` listens to store changes. It iterates through all active encodings and constructs a valid Vega-Lite JSON specification.
- **Rendering**: The JSON is passed to `<VegaLite />` which renders the SVG/Canvas interactions.

---

## 4. AI Features Architecture

OpenViz uses a **Context-Aware RAG** (Retrieval-Augmented Generation) approach, but optimized for small data contexts without a vector DB.

### 4.1. The AI Service (`groqService.ts`)
We use **Groq** for ultra-low latency inference, crucial for the "real-time" feel.
- **Model**: Custom Llama-based models (e.g., `llama-4-maverick`).
- **Input**: User query + **Data Context**.
- **Output**: JSON-structured response handling both text answers and chart specifications.

### 4.2. Context Injection Strategy
To make the AI "smart" about the user's specific file, we inject a high-density **Data Profile** into the system prompt:
```typescript
{
  "dataset_summary": "1000 rows, 5 columns",
  "fields": [
    { "name": "Revenue", "type": "quantitative", "stats": {"min": 100, "max": 5000} },
    { "name": "Region", "type": "nominal", "unique_values": ["North", "South"] }
  ]
}
```
*Note: We DO NOT send the entire dataset to the LLM to preserve privacy and token limits. We only send the metadata/statistics.*

### 4.3. Capabilities
1. **Intent Detection**: Decides if the user wants a simple answer ("Total revenue?") or a visualization ("Plot revenue by year").
2. **Auto-Charting**: Generates a valid `ChartConfig` object which the app applies to the state, updating the UI instantly.
3. **Insight Generation**: Heuristic + AI analysis to find outliers, trends, and correlations in the data.

---

## 5. Key Features

### 💻 Hybrid Editor
- **Visual Mode**: Drag-and-drop builder for non-technical users.
- **Code Mode**: Direct access to the generic JSON for power users (using Monaco Editor).
- **AI Mode**: Conversational interface to manipulate the chart.

### 📊 Dashboard Engine
- **Single View**: Focus on one chart for deep analysis.
- **Dashboard View**: CSS Grid-based layout engine allowing multiple charts to coexist. AI can generate full dashboards ("Give me a KPI summary") by creating multiple chart configurations at once.

### 🎨 Design System
- **Theme**: "Cyber-Professional" Dark Mode (Zinc-900 backgrounds, Violet-500 accents).
- **Components**: Built on headless Radix UI primitives for accessibility, styled with Tailwind.
- **Motion**: Framer Motion used for layout transitions and shared-element effects (e.g., expanding a chart).

---

## 6. Future Roadmap
*(Derived from project enhancements log)*
1. **Templates**: Pre-defined dashboard layouts for common use cases (Sales, SaaS Metrics).
2. **Data Transformations**: Allowing the AI to create *new* calculated fields (e.g., `Profit = Sales - Cost`).
3. **Export Engine**: High-resolution PNG/SVG export and "Share Link" functionality.
4. **Local LLM Support**: Running WebLLM in the browser for offline privacy.

---

## 7. How to Use This Document for Coding
- **When Fixing Bugs**: Check the *Architecture* section to see if the bug lies in the Store (Logic) or Component (UI).
- **When Adding Features**: Follow the *Data Flow*. Ensure you update the `useVizStore` types, the Vega spec builder, and the UI components.
- **When Improving AI**: Modify `groqService.ts` to adjust prompts or `dataContextService.ts` to provide richer statistical context.
