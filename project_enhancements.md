\# 🎨 OpenViz

\> \*\*AI-Powered Data Visualization & Analytics Platform\*\* – Transform your data into beautiful, interactive charts and dashboards using natural language. Ask questions, get insights, and build visualizations without domain knowledge.

!\[OpenViz\](https://img.shields.io/badge/React-19-blue?logo=react)

!\[TypeScript\](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)

!\[Vite\](https://img.shields.io/badge/Vite-7.2-purple?logo=vite)

!\[Vega-Lite\](https://img.shields.io/badge/Vega--Lite-6.4-orange)

!\[Groq AI\](https://img.shields.io/badge/Groq-Llama\_4-green?logo=meta)

\---

\## 📖 Overview

\*\*OpenViz\*\* is a modern, web-based data intelligence tool that combines the \*\*Vega-Lite\*\* visualization grammar with a \*\*context-aware AI assistant\*\*. Unlike traditional BI tools that require knowledge of query languages or complex UIs, OpenViz allows users to upload data and simply \*talk\* to it.

Users can ask natural language questions to get statistical answers, request specific charts, or command the AI to build entire multi-view dashboards automatically.

\### ✨ Key Highlights

\- 🧠 \*\*Conversational AI Analytics\*\* – Ask specific questions about data (e.g., \*"Which region had the lowest profit in Q3?"\*) and get text answers.

\- 🤖 \*\*Zero-Knowledge Charting\*\* – Type \*"Compare sales vs. targets"\* and get a perfect visualization.

\- 📊 \*\*One-Click Dashboards\*\* – Generate multi-chart, grid-based layouts from a single prompt (e.g., \*"Give me a sales overview dashboard"\*).

\- 🎯 \*\*Drag-and-Drop Refinement\*\* – Intuitive field-to-channel mapping for AI-generated charts.

\- ⚡ \*\*Real-time Fluidity\*\* – Smooth animations, state history, and instant previews.

\- 🔧 \*\*Hybrid Editor\*\* – Switch seamlessly between Visual builder, AI Chat, and JSON Code views.

\---

\## 🚀 Features

\### 1. 🧠 Advanced AI Assistant (v2.0)

The AI has been upgraded from a simple "chart generator" to a full data analyst.

\#### \*\*A. Conversational Q&A Engine\*\*

The AI parses the dataset schema and statistical summaries to answer text-based queries:

\- \*"What is the average age of customers?"\*

\- \*"Show me the top 5 products by revenue."\*

\- \*"Are there any outliers in the price column?"\*

\*\*Implementation:\*\* The AI uses a Retrieval-Augmented Generation (RAG) approach where it queries a pre-computed statistical profile of the data (min, max, distinct counts, samples) before answering, ensuring accuracy without hallucinations.

\#### \*\*B. Dashboard Generation\*\*

Users can request complex views:

\- \*Prompt:\* "Create a dashboard showing revenue trends, regional breakdown, and product category performance."

\- \*Action:\* OpenViz generates a layout specification with multiple Vega-Lite specs arranged in a responsive grid (CSS Grid/Masonry).

\#### \*\*C. "Why?" and Insight Explanation\*\*

Instead of just flagging an anomaly, the AI explains it:

\- \*User:\* "Why is sales down in March?"

\- \*AI:\* Analyzes correlations with other fields (e.g., marketing spend, holidays) and provides a text explanation alongside a supporting chart.

\#### \*\*D. Contextual Memory\*\*

The AI remembers the state of the current chart.

\- \*User:\* "Make it a line chart." (AI switches mark type)

\- \*User:\* "Now split it by region." (AI adds color encoding)

\### 2. 📁 Data Import & Smart Profiling

Upload your datasets and let OpenViz automatically analyze them:

| Feature | Description |

|---------|-------------|

| \*\*File Support\*\* | CSV, TSV, and JSON files |

| \*\*Auto Type Detection\*\* | Automatically identifies quantitative, nominal, temporal, and ordinal fields |

| \*\*Intelligence Profile\*\* | Generates a hidden "Data Context" object used by the LLM to understand the dataset without uploading every row. |

| \*\*Sparklines\*\* | Inline data distribution previews for each field |

| \*\*Cleaning Suggestions\*\* | AI suggests fixes for missing values or inconsistent formats (e.g., "Date column contains mixed formats") |

\### 3. 🎨 Visual Encoding System

Build charts by mapping data fields to visual channels, with AI assistance.

| Channel | Purpose | Example |

|---------|---------|---------|

| \*\*X\*\* | Horizontal position | Categories, dates |

| \*\*Y\*\* | Vertical position | Measures, counts |

| \*\*Color\*\* | Hue encoding | Group comparisons |

| \*\*Size\*\* | Mark size | Quantitative emphasis |

| \*\*Shape\*\* | Mark shape | Additional categorization |

| \*\*Row/Column\*\* | Faceting | Small multiples (Dashboard components) |

\*\*Supported Chart Types:\*\*

\- 📊 Bar Charts (Grouped/Stacked)

\- 📈 Line/Area Charts

\- 🔵 Scatter Plots & Bubble Charts

\- 🥧 Donut/Pie Charts

\- 🗺️ Heatmaps

\- 📊 Boxplots & Histograms

\- 🌐 Geospatial Maps (Projection support)

\### 4. ⚡ Auto-Chart & Fluid UX

\*\*State History (Undo/Redo)\*\*

\- Every action (AI prompt or Drag-and-Drop) is pushed to a history stack. Users can travel back in time to previous configurations.

\*\*Smooth Transitions\*\*

\- Using Framer Motion or Auto-Animate, when data changes or charts update, the morphing is seamless, helping the user track data points.

\*\*Responsive Canvas\*\*

\- The canvas resizes intelligently. If the user generates a Dashboard, the layout adapts from mobile (stacked) to desktop (grid).

\### 5. 🔧 Code Editor & Export

Toggle to the code view to:

\- View generated Vega-Lite JSON specification for \*\*every chart on the canvas\*\*.

\- Make direct edits with \*\*Monaco Editor\*\*.

\- \*\*Export Dashboard:\*\* Export the entire view as a standalone HTML file or PDF.

\---

\## 🛠️ Technology Stack

\### Core Framework

| Technology | Version | Purpose |

|------------|---------|---------|

| \*\*React\*\* | 19.2 | UI Framework |

| \*\*TypeScript\*\* | 5.9 | Type Safety |

| \*\*Vite\*\* | 7.2 | Build Tool & Dev Server |

| \*\*Framer Motion\*\* | 11.0 | Smooth Animations/Transitions |

\### Visualization

| Technology | Version | Purpose |

|------------|---------|---------|

| \*\*Vega\*\* | 6.2 | Visualization Grammar |

| \*\*Vega-Lite\*\* | 6.4 | High-Level Chart Grammar |

| \*\*react-vega\*\* | 8.0 | React Vega Integration |

| \*\*vega-embed\*\* | 7.1 | Embedding & Interactivity |

\### AI Integration

| Technology | Version | Purpose |

|------------|---------|---------|

| \*\*Groq SDK\*\* | 0.37 | Ultra-fast AI Inference |

| \*\*Llama 4 Maverick\*\* | 17B | Reasoning & Chart Config |

| \*\*System Prompting\*\* | Custom | Context-injection for Data Analysis |

\### State Management & UI

| Technology | Version | Purpose |

|------------|---------|---------|

| \*\*Zustand\*\* | 5.0 | State Management (with History middleware) |

| \*\*@dnd-kit\*\* | 6.3 | Drag-and-Drop System |

| \*\*@radix-ui\*\* | Various | Accessible UI Primitives |

| \*\*Lucide React\*\* | 0.562 | Icon Library |

| \*\*Tailwind CSS\*\* | 4.1 | Utility-First Styling |

\### Data Processing

| Technology | Version | Purpose |

|------------|---------|---------|

| \*\*PapaParse\*\* | 5.5 | CSV/TSV Parsing |

| \*\*Arquero\*\* | 8.0 | Data Transformation & Querying |

| \*\*date-fns\*\* | 4.1 | Date Parsing & Formatting |

\### Development Tools

| Technology | Purpose |

|------------|---------|

| \*\*ESLint\*\* | Code Linting |

| \*\*Monaco Editor\*\* | In-browser Code Editing |

| \*\*PostCSS\*\* | CSS Processing |

\---

\## 📐 Enhanced Architecture

src/

├── components/

│ ├── ai/

│ │ ├── AIChat.tsx # Conversational Interface (Text + Viz)

│ │ ├── AIQueryBar.tsx # Quick input bar

│ │ └── InsightPanel.tsx # Text-based analysis results

│ │

│ ├── canvas/

│ │ ├── Canvas.tsx # Main container (Grid/Flex)

│ │ ├── VizPreview.tsx # Individual chart wrapper

│ │ ├── DashboardGrid.tsx # NEW: Multi-chart layout manager

│ │ └── CodeEditor.tsx # Monaco JSON editor

│ │

│ ├── data-shelf/

│ │ ├── DataShelf.tsx

│ │ ├── DraggableField.tsx

│ │ └── Sparkline.tsx

│ │

│ ├── encoding-deck/

│ │ ├── EncodingDeck.tsx

│ │ └── EncodingShelf.tsx

│ │

│ ├── layout/

│ │ ├── AppLayout.tsx

│ │ └── TopBar.tsx # History controls, Export

│ │

│ └── ui/ # Reusable UI Components

│ ├── button.tsx

│ ├── dialog.tsx

│ └── ...

│

├── services/

│ ├── groqService.ts # AI API client

│ └── dataContextService.ts # NEW: Summarizes data for AI context

│

├── store/

│ └── useVizStore.ts # Zustand + History Middleware

│

├── types/

│ └── index.ts

│

├── utils/

│ ├── autoChart.ts

│ ├── schemaInference.ts

│ ├── vegaSpecBuilder.ts

│ └── dashboardBuilder.ts # NEW: Generates multi-chart specs

│

└── lib/

└── utils.ts

\---

\## 🔄 Enhanced Data Flow

\`\`\`mermaid

flowchart TD

A\[Upload Data\] --> B\[Parse & Inference\]

B --> C\[Generate Statistical Profile\]

C --> D\[Zustand Store\]

D --> E\[Data Shelf UI\]

%% User Workflow

E --> F\[Drag & Drop Fields\]

F --> G\[Update Chart Config\]

%% AI Workflow

H\[Natural Language Query\] --> I\[Groq Llama 4\]

C -->|Context Injection| I

I --> J{Intent Detection}

%% AI Paths

J -->|Question| K\[Query Arquero Data\]

K --> L\[Return Text Answer\]

J -->|Chart Request| M\[Generate Vega Spec\]

M --> G

J -->|Dashboard Request| N\[Dashboard Builder\]

N --> O\[Generate Multiple Specs\]

O --> P\[Create Layout Grid\]

P --> G

G --> Q\[Render Visualization\]

Q --> R\[User Interaction / History Push\]

R --> D

🚀 Getting Started

Prerequisites

Node.js 18+ (LTS recommended)

npm or yarn

Groq API Key (for AI features)

Installation

code

Bash

\# Clone the repository

git clone https://github.com/your-username/openviz.git

cd openviz

\# Install dependencies

npm install

Environment Setup

Create a .env file in the project root:

code

Env

\# Required for AI features

VITE\_GROQ\_API\_KEY=your\_groq\_api\_key\_here

\# AI Model Configuration

VITE\_AI\_MODEL=meta-llama/llama-4-maverick-17b-128e-instruct

💡 Get a Groq API Key: Sign up at console.groq.com to get your free API key.

Running the App

code

Bash

\# Start development server

npm run dev

\# Build for production

npm run build

\# Preview production build

npm run preview

The app will be available at http://localhost:5173

📦 Available Scripts

CommandDescription

npm run devStart development server with HMR

npm run buildBuild production bundle

npm run previewPreview production build locally

npm run lintRun ESLint code analysis

🎯 Usage Guide

Scenario 1: The Non-Technical User (Dashboard First)

Upload Data → Select a CSV file (e.g., sales\_data.csv).

Ask AI → Type "Create a dashboard summarizing sales performance."

View Result → OpenViz auto-generates a layout with:

A line chart for sales over time.

A bar chart for top regions.

A key metric card (Total Sales).

Interact -> Click on a bar in the region chart to filter the time-series chart (Brush Linking).

Scenario 2: The Analyst (Deep Dive)

Ask a Question → "Why were returns high in April?"

AI Response → "Returns spiked by 40% in April. The primary category was 'Electronics'."

Follow-up → "Show me the relationship between product rating and returns."

AI Action → Generates a Scatter Plot (X: Rating, Y: Returns) with a trend line.

Scenario 3: The Builder (Manual + AI)

Drag Revenue to Y and Date to X.

Ask AI → "Overlay the target data as a line."

Result -> The AI adds a second layer to the current Vega-Lite spec without changing your base configuration.

Encoding Options

For each field dropped on a channel, you can configure:

OptionDescription

Aggregatesum, mean, count, min, max, median, distinct

BinGroup continuous values into bins

Time Unityear, quarter, month, week, day, hours

Sortascending, descending

🧩 Type System

Data Profile (New for AI Context)

code

TypeScript

interface DataProfile {

rowCount: number;

fields: FieldProfile\[\];

summary: string; // AI-generated summary of the dataset

}

interface FieldProfile {

name: string;

type: FieldType;

uniqueCount: number;

nullCount: number;

exampleValues: any\[\];

stats?: { min: number; max: number; mean: number; median: number };

}

Dashboard Configuration (New)

code

TypeScript

interface DashboardConfig {

charts: ChartConfig\[\];

layout: {

cols: number;

rows: number;

};

}

Chart Configuration

code

TypeScript

interface ChartConfig {

id: string;

title?: string;

mark: MarkType;

encodings: ShelfPlacement\[\];

width: number | 'container';

height: number | 'container';

interactive?: boolean;

}

Encoding Channels

code

TypeScript

type EncodingChannel = 'x' | 'y' | 'color' | 'size' | 'shape' | 'tooltip' | 'row' | 'column';

🌟 Key Implementation Details

AI Context Strategy

To prevent the AI from hallucinating and to optimize token usage:

Profile Generation: When data loads, we run arquero summary stats.

Context Injection: We inject this JSON profile into the system prompt of the LLM.

Querying: If the user asks a specific data question ("What is the max price?"), the AI actually outputs a structured JSON command instead of guessing the number, and our backend runs the query. This ensures 100% accuracy.

State Management (Zustand)

The app uses Zustand with devtools for lightweight, efficient state:

code

TypeScript

export const useVizStore = create()(

devtools(

(set, get) => ({

// Data state

dataset: null,

uploadStatus: { state: 'idle', progress: 0 },

// Encoding state

encodings: \[\],

// Chart configuration

chartConfig: initialChartConfig,

vegaSpec: null,

// Actions...

}),

{ name: 'openviz-store' }

)

);

History Management

Using Zustand middleware for Undo/Redo capability:

code

TypeScript

const useVizStore = create(

devtools(

persist(

(set, get) => ({

// ... state

undo: () => set((state) => ({ past: state.past, present: state.past.pop(), future: \[...\] })),

redo: () => set((state) => ({ ... }))

})

)

)

)

Schema Inference

Automatic type detection with configurable thresholds:

code

TypeScript

// Detects: quantitative, nominal, temporal, ordinal

const fields = inferSchema(data);

Vega-Lite Spec Building

Converts internal state to valid Vega-Lite JSON:

code

TypeScript

const spec = buildVegaLiteSpec(chartConfig, dataset.data);

🎨 Updated UI/UX Design Implementation (v2.0 Vision)

This section outlines the requirements for the "Deep Space" aesthetic—modern, high-contrast, and fluid. The goal is a professional "Data IDE" that feels futuristic but remains accessible.

1\. Visual Language & Theme

Color Palette: "Obsidian & Neon"

We will abandon standard blacks for rich, deep zinc/slate tones to reduce eye strain and increase premium feel.

Background Base: bg-zinc-950 (Not pure black)

Surface / Panels: bg-zinc-900/50 with backdrop-blur-xl (Glassmorphism)

Borders: border-zinc-800 (Subtle separation)

Primary Accent: #6366f1 (Indigo-500) to #a855f7 (Purple-500) gradient for AI elements.

Secondary Accent: #10b981 (Emerald-500) for success/data confirmation.

Text: text-zinc-100 (Primary), text-zinc-400 (Secondary).

Typography

Headers/UI: Inter or Geist Sans (Clean, high legibility).

Code/Data: JetBrains Mono or Fira Code (Technical feel).

Glassmorphism Strategy

Sidebars and Floating Action Bars (FABs) must use:

bg-black/40 backdrop-blur-md border border-white/10 shadow-2xl

This creates depth without "heaviness."

2\. Layout Architecture: "The Workbench"

The layout should move away from a static dashboard to a flexible "Workbench" environment.

Left Sidebar (Data Intelligence):

Collapsible.

Contains the Data Shelf (List of columns).

Columns are rendered as "Pills" that can be dragged.

Visuals: Each field has an icon representing its type (e.g., # for numbers, 📅 for dates, Aa for strings).

Sparklines: When hovering over a field, a small sparkline chart fades in next to it to show distribution.

Center Stage (Infinite Canvas):

Background: Subtle dot-grid pattern (bg-\[url('/grid.svg')\] opacity-20).

The Grid: Dashboard tiles snap to a masonry grid.

Empty State: A beautiful, centered "Spotlight" input asking: "What does your data hide? Ask me..."

Right Sidebar (Control Deck):

Encoding Deck: Where users drop fields (X, Y, Color).

Visual Logic: Dropping a field here should trigger a "glow" effect on the container to confirm action.

Tabbed Interface: Switch between "Visual Builder" (GUI) and "Code" (JSON) seamlessly.

3\. The "Liquid AI" Interaction

The AI shouldn't feel like a chatbot sidebar. It should feel like an integrated OS.

Command Bar (Spotlight Style):

Press Cmd+K or click the bottom-center floating bar.

Input field floats above the content with a glowing gradient border.

Thinking State: When AI is processing, the border animates a gradient rotation.

Response:

Text answers appear in a "Toast" or "Insight Card" that floats near the data.

Chart generations animate into the Canvas (Scale up from 0 to 1 with spring physics).

4\. Component Specifics

A. The Data Shelf (Draggables)

Use @dnd-kit with DragOverlay.

When a user starts dragging a field:

The original item dims.

The dragged item becomes a "Ghost" pill (semi-transparent, high-border contrast).

Valid drop zones (X-axis, Y-axis, Color) on the right sidebar pulse with a specific color (e.g., Blue for X, Green for Y).

B. The Charts (Vega-Lite Styling)

We must inject a custom Vega configuration to override default white backgrounds.

Config:

code

JSON

"config": {

"background": "transparent",

"view": { "stroke": "transparent" },

"axis": {

"domainColor": "#3f3f46", // zinc-700

"gridColor": "#27272a", // zinc-800

"labelColor": "#a1a1aa", // zinc-400

"titleColor": "#e4e4e7" // zinc-200

},

"legend": {

"labelColor": "#a1a1aa",

"titleColor": "#e4e4e7"

}

}

C. Buttons & Inputs

Buttons: No flat colors. Subtle vertical gradients.

Normal: bg-zinc-800 hover:bg-zinc-700

Action: bg-gradient-to-r from-indigo-600 to-purple-600

Inputs: No borders until focused.

Default: bg-zinc-900

Focus: ring-1 ring-purple-500 bg-zinc-800

5\. Motion & Micro-interactions (Framer Motion)

Motion is critical for the "Modern/Smooth" feel.

Layout Shifts: Wrap the main Canvas and Sidebar in from Framer Motion. When sidebars collapse, the charts shouldn't "jump"—they should slide and resize fluidly.

Data Updates: When the user changes a field from "Sum" to "Mean", the chart bars shouldn't snap; they should animate the height change. (Handled via Vega-Lite transitions or React key updates).

Loading States:

Avoid generic spinners.

Use a "Shimmer" skeleton effect on the Chart Container while Groq is generating the JSON spec.

📄 License

MIT License – feel free to use, modify, and distribute.

OpenViz – Data Intelligence for Everyone.