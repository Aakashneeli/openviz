# OpenViz Design System & UI/UX Documentation
*Version 3.0 — "Luminous Flow" Overhaul*

## 1. Design Philosophy
We are shifting from a utilitarian "Admin Dashboard" aesthetic to a **"Cinematic IDE"** aesthetic. The goal is to make data exploration feel fluid, immersive, and reactive.

### Core Pillars
1.  **Atmospheric Depth**: Replace flat blacks with deep, rich "Obsidian" tones (`zinc-950` to `slate-900` gradients). Use subtle radial gradients and backdrop blurs to create layering.
2.  **Reactive Feedback**: The UI must "breathe." Every interaction (hover, drag, click) triggers a micro-animation.
3.  **Cognitive Continuity**: Remove harsh white borders. Use lighting, shadow, and glassmorphism to separate panels.
4.  **Data as Light**: Charts and data points should appear self-luminous (neon accents) against the dark void.

---

## 2. Technology Stack (2025 Standards)

### Frontend Core
- **Framework**: React 19 (Server Components ready)
- **Build**: Vite 6 (Instant HMR)
- **Language**: TypeScript 5.4+

### Styling & Motion (The "Soul" Engine)
- **CSS Engine**: Tailwind CSS v4
- **Animation**: **Framer Motion** (Essential for layout transitions, drag physics, and entry animations).
- **Components**: **Shadcn/UI** (Customized primitives, not default styles).
- **Icons**: Lucide React (Stroke width: 1.5px for elegance).

### Visualization
- **Engine**: Vega-Lite v5 (wrapped in `react-vega`).
- **Rendering**: Canvas API (Performance) with SVG overlays (Tooltips).

---

## 3. Design Tokens: "Obsidian & Neon"

### Color Palette (Dark Mode Only)
We use a "Void" base with "Electric" accents.

| Token Name | Tailwind/CSS Value | Usage |
| :--- | :--- | :--- |
| **Bg-Void** | `hsl(240, 10%, 4%)` | The deepest background layer. |
| **Bg-Surface** | `hsl(240, 6%, 10%)` | Panels, Cards (approx 30% opacity). |
| **Border-Glass** | `rgba(255, 255, 255, 0.08)` | Ultra-thin separators. |
| **Text-Primary** | `hsl(0, 0%, 98%)` | Headers, Values. |
| **Text-Muted** | `hsl(240, 5%, 60%)` | Labels, Descriptions. |
| **Accent-Flux** | `linear-gradient(135deg, #6366f1, #a855f7)` | Primary Actions, AI Buttons. |
| **Signal-Success**| `hsl(150, 60%, 50%)` | Data Loaded, Valid Drop. |

### Typography
- **Primary Font**: **Inter V4** or **Geist Sans**.
- **Code Font**: **JetBrains Mono** (Ligatures enabled).
- **Styles**:
    - *H1/H2*: Tracking tight (`-0.02em`), Weight 500.
    - *UI Labels*: Tracking wide (`0.05em`), Uppercase, Weight 600, Size 10px.

---

## 4. UI Architecture & Layout

### A. The "Floating" Layout (`AppLayout.tsx`)
Instead of a rigid grid with solid dividers, panels "float" above the background.
- **Background**: `Bg-Void` with a very subtle radial gradient spotlight in the center to draw focus.
- **Panels**: All sidebars have `rounded-xl`, `border-glass`, and `backdrop-blur-xl`.
- **Gaps**: `12px` padding between the window edges and the panels.

### B. Command Bar (Replaces TopBar)
A sleek, glass-morphic strip integrated into the top of the window.
- **Left**: Brand Mark (Gradient text).
- **Center**: **"Omni-Search" Input**.
    - Looks like Spotlight search (`Cmd+K`).
    - Acts as both Field Search and AI Prompt input.
    - Visual: `bg-white/5` with `border-white/10`. Glows on focus.
- **Right**: Export & User profile (Avatar).

### C. Explorer Panel (Left)
- **Header**: Minimal. Just "DATA" label.
- **Field Chips**:
    - Instead of list items, fields are **Pills/Chips**.
    - **Icon**: Duotone icons (Blue for Dimensions, Green for Measures).
    - **Interaction**: On hover, the chip translates `x: 4px`.

### D. The "Cockpit" (Right Panel)
- **Visual Mapping**:
    - **Drop Zones**: Large, dashed areas.
    - **State - Empty**: "Drag field here" (Text opacity 0.3).
    - **State - Hover with Field**: The zone borders glow `Accent-Flux` and scale up 1.02x.
    - **State - Filled**: The field snaps into place with a spring animation.

---

## 5. The Canvas (Center Stage)

### Smart Grid (`DashboardGrid.tsx`)
- **Container**: Transparent. No visible borders around the grid itself.
- **Chart Cards**:
    - **Base**: `bg-surface/40` (Glass).
    - **Border**: `border-glass`.
    - **Hover**: **Spotlight Effect**. The border near the mouse cursor lights up (using CSS radial-gradient mask).
- **Empty State**:
    - A pulsing **"Wireframe Skeleton"** shows where charts will appear.
    - Central "Sparkle" icon to trigger AI generation.

### AI Assistant: "The Ghost"
- **Location**: Floating button, bottom-center of Canvas.
- **Interaction**:
    1. Click button -> Input expands with blur effect.
    2. Type "Show Sales vs Year".
    3. **Result**: The chart doesn't just "appear." It **morphs** from a skeleton loader into the final visualization.

---

## 6. Interaction & Motion Physics

### 1. Magnetic Drag & Drop
*Uses `dnd-kit` + `Framer Motion`*
- **Pickup**: Field Chip scales to 1.05x, shadow increases, becomes semi-transparent.
- **Traversal**: A "Ghost" of the chip follows the cursor.
- **Approach**: When the ghost nears a valid Drop Zone (e.g., X-Axis), the Drop Zone magnetically pulls towards the cursor (scale 1.02x, border opacity 1.0).

### 2. Contextual Focus
- When a user selects a chart to edit properties:
    - The active chart stays bright (Opacity 1.0).
    - All other charts in the grid dim (Opacity 0.5) and blur slightly (blur-sm).
    - This creates a "Depth of Field" effect, focusing the user on the task.

---

## 7. Implementation Guide (Tailwind v4)

### CSS Variables (Global)
```css
:root {
  --bg-void: 240 10% 4%;
  --bg-glass: 240 5% 10%;
  --accent-glow: 0 0 20px rgba(168, 85, 247, 0.4);
}

.glass-panel {
  @apply bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl;
}

/* The Spotlight Border Effect */
.card-spotlight {
  @apply relative overflow-hidden rounded-xl border border-white/10 bg-white/5;
}
.card-spotlight::before {
  content: '';
  @apply absolute inset-0 -z-10;
  background: radial-gradient(
    800px circle at var(--mouse-x) var(--mouse-y), 
    rgba(255, 255, 255, 0.15), 
    transparent 40%
  );
  opacity: 0;
  transition: opacity 0.5s;
}
.card-spotlight:hover::before {
  opacity: 1;
}




<motion.div 
  layoutId={field.id}
  whileHover={{ scale: 1.02, x: 4 }}
  whileDrag={{ scale: 1.1, boxShadow: "0px 10px 30px rgba(0,0,0,0.5)" }}
  className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/5 cursor-grab active:cursor-grabbing"
>
  <FieldIcon type={field.type} className="text-indigo-400" />
  <span className="text-sm font-medium text-slate-200">{field.name}</span>
</motion.div>