# OpenViz UI/UX Documentation
*Version 2.0 - Professional Developer Tool Overhaul*

## 1. Design Philosophy
OpenViz has been transformed from a generic dashboard into a **Professional Visual Development Environment (IDE)**. The design language emphasizes density, precision, and minimizing visual noise to focus on the data and configuration.

### Core Pillars
- **High Density**: Efficient use of screen real estate with slim headers (40px) and compact lists.
- **Solid Structure**: Clear, solid borders divide semantic regions. No blurry overlays or excessive glassmorphism.
- **Tool-Like Precision**: Controls are minimalist and standardized. Drag-and-drop targets are clear but unobtrusive.
- **"Midnight Glass" Theme**: Deep dark backgrounds (`zinc-950`) with subtle semi-transparent surfaces for panels, maintaining legible contrast (`zinc-200` text).

---

## 2. Technology Stack

### Frontend Core
- **Framework**: React 19 (via Vite)
- **Language**: TypeScript 5.0+
- **Build Tool**: Vite 5+ (Fast HMR)

### Styling & UI
- **CSS Engine**: Tailwind CSS v4 (Alpha/Beta)
- **Component Primitives**: Radix UI (via Shadcn/UI)
- **Icons**: Lucide React
- **Fonts**: 
  - *Primary*: 'Outfit' (Sans-serif for UI)
  - *Code*: 'JetBrains Mono' (for formulas/specs)

### Visualizations & State
- **Visualization Engine**: Vega-Lite v5 (via `vega-embed` and `react-vega`)
- **State Management**: Zustand (Global store with DevTools)
- **Drag and Drop**: @dnd-kit/core (Sortable, Droppable, Draggable)
- **Data Processing**: Arquero / PapaParse

### AI Integration
- **LLM Interface**: Groq SDK (Llama 3.3 70B Versatile)
- **Context Awareness**: Custom Data Profile Service

---

## 3. Design System Details

### Color Palette ("Midnight Glass")
| Variable | Value (HSL/Hex) | Usage |
| :--- | :--- | :--- |
| `bg-background` | `hsl(240 10% 3.9%)` | Main app background (Deepest Black) |
| `bg-card` | `hsl(240 10% 6%)` | Panels and containers (Slightly lighter) |
| `border-border` | `hsl(240 4% 16%)` | Subtle dividers between panels |
| `text-foreground` | `hsl(0 0% 98%)` | Primary text (White) |
| `text-muted` | `hsl(240 5% 65%)` | Secondary text (Grey) |
| `bg-primary` | `hsl(252 59% 58%)` | Primary Action / Accent (Vibrant Purple) |

### Typography
- **Headings**: Outfit, Weight 600/700, Tight Tracking.
- **UI Text**: Outfit, Weight 400/500, Size 13px (Default), 11px (Labels).
- **Labels**: Uppercase, Tracking-Widest, Font-Bold, Size 10px.

---

## 4. UI Architecture & Layout components

### A. App Layout (`AppLayout.tsx`)
A classic "IDE" three-column grid layout with collapsible side panels.
- **Left Panel (280px)**: "Explorer" - Data Source & Fields.
- **Center Panel (Flexible)**: "Canvas" - Visualization & Dashboard.
- **Right Panel (320px)**: "Properties" - Encoding Channels & Configuration.

**Key Features:**
- **Solid Resizers**: Fixed width panels with solid borders.
- **Toggle Buttons**: Minimalist icons (`LayoutTemplate`, `Settings2`) to collapse/expand panels.
- **Transitions**: Smooth CSS grid transitions `cubic-bezier(0.16, 1, 0.3, 1)`.

### B. TopBar (`TopBar.tsx`)
A slim, 40px global header.
- **Left**: Brand ("OpenViz") and History Controls (Undo/Redo).
- **Center**: Active Dataset Status (Name, Row Count, Field Count).
- **Right**: Global Actions (Upload, Export, Command Palette hint).

### C. Data Shelf ("Explorer")
Located in the Left Panel.
- **Header**: "EXPLORER" label with collapse button.
- **Search**: Slim input to filter fields.
- **Content**: A specific `ScrollArea` containing `DraggableField` components.
- **Draggable Field**: A high-density row row (`24px` height) displaying the field type icon (Color-coded) and field name. Use `dnd-kit`'s `useDraggable`.

### D. Encoding Deck ("Inspector")
Located in the Right Panel.
- **Header**: "VISUAL MAPPING" label with Clear All button.
- **Structure**: Grouped sections ("Position", "Mark", "Facets") separated by solid borders.
- **Encoding Shelf**: Drop zones for fields.
  - *Empty State*: Dashed border, "Drop here" guidance.
  - *Filled State*: Solid row showing Field Name and Aggregation (if any). Includes a "Remove" (X) button on hover.

---

## 5. Canvas & Visualization

### VizPreview (`VizPreview.tsx`)
- **Container**: Flex-grow area in the center.
- **Engine**: Renders Vega-Lite specifications into SVG/Canvas.
- **Interactivity**: 
  - Dynamic resizing based on container or data cardinality.
  - Hover signals and tooltips.
  - "Summarize" button to trigger AI analysis.

### Dashboard Grid (`DashboardGrid.tsx`)
- **Layout**: CSS Grid layout for multiple charts.
- **Cards**: Each chart is a mini-card with a header.
- **Interactions**:
  - **Maximize**: Click button to expand a chart to Single View (preserving state).

---

## 6. Interaction Flows

### 1. Drag & Drop Workflow
1.  **Pick**: User grabs a field from the *Data Shelf*.
2.  **Drag**: A semi-transparent "ghost" overlay follows the cursor.
3.  **Target**: Valid *Encoding Shelves* highlight (`bg-primary/10`, `border-primary`) when hovered.
4.  **Drop**:
    - `dnd-kit` detects drop event.
    - `useVizStore` updates `encodings` state.
    - `regenerateSpec` is triggered, updating the Vega-Lite JSON.
    - Chart re-renders immediately.

### 2. Dashboard Navigation
- **Expand**: Dashboard Card -> Click "Maximize" -> Stores full config in `chartConfig`, cleans `dashboardConfig` -> View switches to Single Chart.
- **Return**: Single Chart Header -> Click "Grid Icon" -> Restores `dashboardConfig` -> View switches to Dashboard Grid.

### 3. AI Copilot
- **Input**: User types in `AIChat` (e.g., "Show sales over time").
- **Process**: Groq LLM analyzes Schema + Query -> Returns Chart Config JSON.
- **Action**: Store updates -> Chart renders -> "Suggestion Applied" message appears.
