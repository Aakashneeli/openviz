# OpenViz Product Analysis & Strategic Recommendations

> **Prepared by**: AI Product Strategy Analysis  
> **Date**: January 28, 2026  
> **Document Type**: Product Review & Roadmap Recommendations

---

## Executive Summary

**OpenViz** is a well-architected AI-powered data visualization platform with solid fundamentals. You've built a compelling core product with innovative features like proactive chart recommendations, natural language filtering, forecasting, and per-chart AI focus. However, there are significant gaps that would prevent this from being a compelling commercial product.

This document provides a comprehensive analysis organized by priority, covering critical gaps, competitive differentiators, architecture refinements, and a recommended 90-day roadmap.

---

## Table of Contents

1. [Critical Gaps (Must-Fix Before Launch)](#-critical-gaps-must-fix-before-launch)
2. [High-Priority Enhancements](#-high-priority-enhancements-competitive-differentiators)
3. [Medium-Priority Improvements](#-medium-priority-improvements)
4. [Architecture Refinements](#-architecture-refinements)
5. [Feature Prioritization Matrix](#-feature-prioritization-matrix)
6. [Monetization Considerations](#-monetization-considerations)
7. [Recommended 90-Day Roadmap](#-recommended-90-day-roadmap)
8. [Final Thoughts](#final-thoughts)

---

## 🔴 Critical Gaps (Must-Fix Before Launch)

### 1. Security: API Key Exposure

**Problem**: Your Groq API key is exposed in the frontend via `VITE_GROQ_API_KEY`. Anyone can inspect your bundle and steal your API key.

**Recommendation**:
- Create a lightweight backend proxy (Cloudflare Workers, Vercel Edge Functions, or a simple Node.js server)
- Route all AI calls through this proxy where the API key lives server-side
- Add rate limiting per IP/session at the proxy level
- This is a **blocker** for any commercial deployment

**Implementation Example**:
```typescript
// Cloudflare Worker example
export default {
  async fetch(request: Request) {
    const response = await fetch('https://api.groq.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`, // Secret stored in worker
        'Content-Type': 'application/json',
      },
      body: request.body,
    });
    return response;
  },
};
```

---

### 2. No Export Capabilities

**Problem**: Users can create beautiful charts but have no way to use them outside the app.

**Recommendation** (prioritized):

| Export Type | Effort | Value | Implementation Notes |
|-------------|--------|-------|---------------------|
| PNG/JPEG Image | Low | High | ECharts `getDataURL()` |
| SVG Vector | Low | High | ECharts `getDataURL('svg')` |
| PDF Report | Medium | High | jsPDF or html2pdf |
| PowerPoint | Medium | Very High (enterprise) | pptxgenjs library |
| Embedded iframe | Medium | High (sharing) | Generate embeddable code |
| CSV/Excel data export | Low | Medium | SheetJS/xlsx |

**Quick Win Code**:
```typescript
// Add to VizPreview.tsx
const exportChart = (format: 'png' | 'svg') => {
  const chartInstance = echartsRef.current?.getEchartsInstance();
  if (chartInstance) {
    const url = chartInstance.getDataURL({
      type: format,
      pixelRatio: 2,
      backgroundColor: '#fff'
    });
    const link = document.createElement('a');
    link.download = `chart.${format}`;
    link.href = url;
    link.click();
  }
};
```

---

### 3. No Error Handling/Recovery

**Problem**: No error boundaries, no graceful degradation, no retry logic documented.

**Recommendation**:
- Add React Error Boundaries around major sections (Canvas, AI Chat, Data Shelf)
- Implement AI call retry with exponential backoff
- Add graceful fallback when AI is unavailable ("AI temporarily unavailable, try manual mode")
- Add toast notifications for actionable errors
- Add a "Report Bug" button that captures state

**Implementation**:
```typescript
// components/ErrorBoundary.tsx
class ErrorBoundary extends React.Component<Props, State> {
  state = { hasError: false, error: null };
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to error tracking service
    logErrorToService(error, info);
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onRetry={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}
```

---

### 4. No Onboarding/Empty States

**Problem**: New users landing on the app see... what? No guidance, no sample data, no tutorial.

**Recommendation**:
- Add a first-run tutorial (3-5 step overlay highlighting key features)
- Include sample datasets (Sales data, COVID stats, Stock prices)
- Design compelling empty states for each panel:
  - Data Shelf empty → "Drop a CSV here to get started"
  - Canvas empty → Show example chart with "Upload data to create your own"
  - Dashboard empty → "Add your first chart"
- Add contextual tooltips on hover

**Sample Datasets to Include**:
```
sample-data/
├── sales_data.csv          # Classic business data
├── stock_prices.csv        # Time series example
├── customer_segments.csv   # Categorical analysis
├── website_analytics.csv   # Marketing metrics
└── employee_survey.csv     # HR/People analytics
```

---

## 🟠 High-Priority Enhancements (Competitive Differentiators)

### 5. Cross-Chart Filtering (Dashboard Interactivity)

**Problem**: Charts in dashboards are static islands. Users expect BI-tool behavior where clicking a bar filters other charts.

**Recommendation**:
- Implement "click-to-filter" on dashboard charts
- When user clicks a data point (e.g., "USA" in a bar chart), broadcast a filter event
- Other charts in the dashboard filter to that value
- Show a "Filtering by: USA" badge with clear button
- This is a **major differentiator** from static dashboards

**Implementation Approach**:
```typescript
// types/index.ts
interface CrossFilter {
  sourceChartId: string;
  field: string;
  value: string | number | string[];
  operator: 'eq' | 'in';
}

// Add to DashboardConfig
interface DashboardConfig {
  // ... existing fields
  crossFilters: CrossFilter[];
  crossFilterEnabled: boolean;
}

// In chart click handler
const handleChartClick = (params: ECElementEvent) => {
  if (dashboardConfig.crossFilterEnabled) {
    setCrossFilter({
      sourceChartId: chart.id,
      field: params.dimensionNames[0],
      value: params.name,
      operator: 'eq'
    });
  }
};
```

---

### 6. Calculated Fields

**Problem**: Users can't create derived metrics (profit margin, year-over-year change, running totals).

**Recommendation**:
- Add a "New Calculated Field" button in Data Shelf
- Support common patterns:
  - Arithmetic: `Revenue - Cost`
  - Aggregations: `SUM(Sales) / COUNT(Orders)`
  - Date math: `DATEDIFF(OrderDate, ShipDate)`
  - Conditionals: `IF(Region = 'USA', 'Domestic', 'International')`
- Use Arquero for computation (you already have it)
- Allow AI to create calculated fields via NL: "Create a profit margin field"

**Type Definition**:
```typescript
interface CalculatedField {
  id: string;
  name: string;
  formula: string;
  resultType: FieldType;
  referencedFields: string[];
  createdAt: Date;
  createdBy: 'user' | 'ai';
}

// Example formulas
const examples = [
  { name: 'Profit Margin', formula: '(Revenue - Cost) / Revenue * 100' },
  { name: 'Days to Ship', formula: 'DATEDIFF(OrderDate, ShipDate)' },
  { name: 'Region Type', formula: "IF(Country = 'USA', 'Domestic', 'International')" },
];
```

---

### 7. Data Source Connectors

**Problem**: File upload only limits enterprise use cases.

**Recommendation** (phased):

| Phase | Connectors | Effort | Priority |
|-------|------------|--------|----------|
| 1 | Google Sheets, URL/API | Medium | High |
| 2 | Database (Postgres, MySQL via proxy) | High | Medium |
| 3 | Cloud storage (S3, GCS) | Medium | Medium |
| 4 | SaaS (Salesforce, HubSpot, GA4) | High | Low (initially) |

**Google Sheets Implementation**:
```typescript
interface DataSource {
  id: string;
  type: 'file' | 'google-sheets' | 'api' | 'database';
  config: GoogleSheetsConfig | APIConfig | DatabaseConfig;
  refreshInterval?: number; // minutes
  lastRefreshed?: Date;
}

interface GoogleSheetsConfig {
  spreadsheetId: string;
  sheetName: string;
  range?: string;
  credentials: OAuthToken;
}
```

---

### 8. Scheduled Refresh & Live Data

**Problem**: Dashboards are snapshots. Real-world use requires auto-refresh.

**Recommendation**:
- Add "Refresh interval" setting per dashboard (manual, 1min, 5min, 1hr)
- For URL/API sources, fetch new data on interval
- Show "Last updated: 5 min ago" timestamp
- Add visual indicator when refresh is happening

**Implementation**:
```typescript
// In useVizStore.ts
interface DashboardConfig {
  // ... existing
  refreshInterval: number | null; // null = manual only
  lastRefreshed: Date | null;
}

// Refresh logic
useEffect(() => {
  if (!dashboardConfig?.refreshInterval) return;
  
  const interval = setInterval(() => {
    refreshDashboardData();
  }, dashboardConfig.refreshInterval * 60 * 1000);
  
  return () => clearInterval(interval);
}, [dashboardConfig?.refreshInterval]);
```

---

### 9. Collaboration & Sharing

**Problem**: localStorage only. No way to share dashboards or collaborate.

**Recommendation** (progressive enhancement):

| Feature | Backend Needed | Effort | Value |
|---------|----------------|--------|-------|
| Export/import dashboard JSON | No | Low | Medium |
| "Copy link" (base64-encoded state in URL) | No | Medium | High |
| Public shareable links | Yes (minimal) | Medium | High |
| Multi-user editing | Yes (real-time backend) | High | Very High |

**URL-Encoded State (No Backend)**:
```typescript
// Share current dashboard via URL
const shareDashboard = () => {
  const state = {
    dashboard: dashboardConfig,
    data: compressData(dataset), // Use lz-string for compression
  };
  const encoded = btoa(JSON.stringify(state));
  const url = `${window.location.origin}?state=${encoded}`;
  navigator.clipboard.writeText(url);
};

// Load from URL on mount
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const state = params.get('state');
  if (state) {
    const decoded = JSON.parse(atob(state));
    loadSharedDashboard(decoded);
  }
}, []);
```

---

## 🟡 Medium-Priority Improvements

### 10. AI Enhancements

| Enhancement | Value | Effort | Notes |
|-------------|-------|--------|-------|
| **Streaming responses** | Better UX, perceived speed | Medium | Use Groq streaming API |
| **Conversation memory** (across sessions) | Personalization | Medium | Store in localStorage/IndexedDB |
| **AI confidence scores** | Transparency | Low | Parse from LLM response |
| **Fallback to Claude/GPT** | Reliability | Medium | Provider abstraction layer |
| **User feedback loop** (👍/👎) | Improvement data | Low | Log to analytics |
| **AI prompt versioning** | A/B testing | Medium | Feature flags |

**Streaming Implementation**:
```typescript
const streamAIResponse = async (query: string, onChunk: (text: string) => void) => {
  const response = await fetch('/api/ai/stream', {
    method: 'POST',
    body: JSON.stringify({ query }),
  });
  
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;
    onChunk(decoder.decode(value));
  }
};
```

---

### 11. Chart Templates & Gallery

**Problem**: Users start from scratch every time.

**Recommendation**:
- Add "Template Gallery" with pre-built charts by category
- Allow users to save their charts as templates
- Add "Duplicate chart" button

**Template Categories**:
```typescript
const templateCategories = {
  sales: [
    { name: 'Revenue Over Time', mark: 'line', encodings: ['temporal:x', 'quantitative:y'] },
    { name: 'Regional Breakdown', mark: 'bar', encodings: ['nominal:x', 'quantitative:y', 'nominal:color'] },
    { name: 'Top Products', mark: 'bar', encodings: ['nominal:y', 'quantitative:x'], sort: 'descending' },
  ],
  marketing: [
    { name: 'Conversion Funnel', mark: 'bar', horizontal: true },
    { name: 'Campaign Performance', mark: 'bar', grouped: true },
  ],
  operations: [
    { name: 'KPI Scorecard', mark: 'text', layout: 'grid' },
    { name: 'Inventory Levels', mark: 'bar', stacked: true },
  ],
};
```

---

### 12. Advanced Aggregations & Transformations

**Current**: sum, mean, count, min, max, median, distinct

**Add**:

| Aggregation | Use Case |
|-------------|----------|
| `percentile(field, 95)` | Distribution analysis |
| `cumulative_sum` | Running totals |
| `percent_of_total` | Composition analysis |
| `moving_average(field, window)` | Trend smoothing |
| `rank` | Leaderboards |
| `first / last` | Boundary values |
| `variance / stddev` | Dispersion |

**Arquero Implementation**:
```typescript
import { op } from 'arquero';

const aggregations = {
  cumulative_sum: (table, field) => 
    table.derive({ [`${field}_cumsum`]: op.cumsum(field) }),
  
  percent_of_total: (table, field) => 
    table.derive({ 
      [`${field}_pct`]: d => d[field] / op.sum(field) * 100 
    }),
  
  moving_average: (table, field, window = 7) =>
    table.derive({ 
      [`${field}_ma${window}`]: op.rolling_mean(field, [-window + 1, 0]) 
    }),
};
```

---

### 13. Drill-Down Functionality

**Problem**: Can't explore data hierarchies (Year → Quarter → Month → Day).

**Recommendation**:
- Detect hierarchical fields automatically (Country > State > City)
- Allow click-to-drill on temporal and categorical axes
- Add breadcrumb trail: "2024 > Q3 > August"
- Add "drill up" button

**Implementation**:
```typescript
interface DrillPath {
  field: string;
  value: string | number;
  level: number;
}

interface DrillHierarchy {
  name: string;
  levels: string[]; // ['Year', 'Quarter', 'Month', 'Day']
  currentPath: DrillPath[];
}

// Auto-detect temporal hierarchy
const detectTemporalHierarchy = (field: FieldInfo): string[] => {
  if (field.type === 'temporal') {
    return ['year', 'quarter', 'month', 'week', 'day'];
  }
  return [];
};

// Auto-detect geographic hierarchy
const detectGeoHierarchy = (fields: FieldInfo[]): string[] | null => {
  const geoFields = ['country', 'state', 'city', 'zipcode'];
  const found = geoFields.filter(g => 
    fields.some(f => f.name.toLowerCase().includes(g))
  );
  return found.length > 1 ? found : null;
};
```

---

### 14. Keyboard Shortcuts

**Implement and Document**:

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Z` | Undo |
| `Cmd/Ctrl + Shift + Z` | Redo |
| `Cmd/Ctrl + S` | Save dashboard |
| `Cmd/Ctrl + K` | Open AI chat |
| `Cmd/Ctrl + N` | New chart |
| `Cmd/Ctrl + D` | Duplicate chart |
| `Cmd/Ctrl + E` | Export menu |
| `Delete / Backspace` | Remove selected encoding |
| `Escape` | Close modal/panel |
| `?` | Show keyboard shortcuts |

**Implementation**:
```typescript
// hooks/useKeyboardShortcuts.ts
import { useEffect } from 'react';

export const useKeyboardShortcuts = () => {
  const { undo, redo, saveDashboard, toggleAIChat } = useVizStore();
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      
      if (isMod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (isMod && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      }
      if (isMod && e.key === 's') {
        e.preventDefault();
        saveDashboard();
      }
      if (isMod && e.key === 'k') {
        e.preventDefault();
        toggleAIChat();
      }
      if (e.key === '?' && !e.target.matches('input, textarea')) {
        showShortcutsModal();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
};
```

---

## 🟢 Architecture Refinements

### 15. Split the Monolithic Store

**Problem**: `useVizStore.ts` is ~1,320 lines and growing. This affects maintainability and testing.

**Recommendation**:
```
stores/
├── dataStore.ts       // dataset, dataProfile, uploadStatus
├── chartStore.ts      // chartConfig, encodings, echartsOption
├── dashboardStore.ts  // dashboardConfig, savedDashboards
├── aiStore.ts         // aiQuery, aiChatHistory, aiFocusedChartId
├── uiStore.ts         // sidebars, view mode, isDragging
├── historyStore.ts    // past, future, undo/redo
└── index.ts           // Compose all slices
```

**Zustand Slice Pattern**:
```typescript
// stores/dataStore.ts
export interface DataSlice {
  dataset: Dataset | null;
  dataProfile: DataProfile | null;
  uploadStatus: UploadStatus;
  loadDataFromFile: (file: File) => Promise<void>;
  clearData: () => void;
}

export const createDataSlice: StateCreator<DataSlice> = (set, get) => ({
  dataset: null,
  dataProfile: null,
  uploadStatus: { state: 'idle', progress: 0 },
  loadDataFromFile: async (file) => { /* ... */ },
  clearData: () => set({ dataset: null, dataProfile: null }),
});

// stores/index.ts
export const useVizStore = create<DataSlice & ChartSlice & DashboardSlice & AISlice & UISlice>()(
  devtools(
    (...a) => ({
      ...createDataSlice(...a),
      ...createChartSlice(...a),
      ...createDashboardSlice(...a),
      ...createAISlice(...a),
      ...createUISlice(...a),
    }),
    { name: 'openviz-store' }
  )
);
```

---

### 16. Add Service Abstraction Layer

**Problem**: Direct Groq SDK calls are scattered. Switching AI providers requires extensive changes.

**Recommendation**:
```typescript
// services/aiProvider.ts
interface AIProvider {
  generateText(prompt: string, options?: AIOptions): Promise<string>;
  generateJSON<T>(prompt: string, schema: JSONSchema): Promise<T>;
  detectIntent(query: string, context: Context): Promise<Intent>;
  streamText(prompt: string, onChunk: (text: string) => void): Promise<void>;
}

interface AIOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

// Implementations
class GroqProvider implements AIProvider {
  private client: Groq;
  constructor(apiKey: string) {
    this.client = new Groq({ apiKey });
  }
  // ... implement methods
}

class ClaudeProvider implements AIProvider { /* ... */ }
class OpenAIProvider implements AIProvider { /* ... */ }

// Factory
export const createAIProvider = (config: AIConfig): AIProvider => {
  switch (config.provider) {
    case 'groq': return new GroqProvider(config.apiKey);
    case 'claude': return new ClaudeProvider(config.apiKey);
    case 'openai': return new OpenAIProvider(config.apiKey);
    default: throw new Error(`Unknown provider: ${config.provider}`);
  }
};
```

---

### 17. Implement Lazy Loading

**Problem**: Large initial bundle with all features loaded upfront.

**Recommendation**:
```typescript
import { lazy, Suspense } from 'react';

// Lazy load heavy components
const CodeEditor = lazy(() => import('./components/canvas/CodeEditor'));
const ReportGenerator = lazy(() => import('./components/report/ReportGenerator'));
const DashboardGrid = lazy(() => import('./components/canvas/DashboardGrid'));
const AIChat = lazy(() => import('./components/ai/AIChat'));

// Loading skeletons
const ChartSkeleton = () => (
  <div className="animate-pulse bg-zinc-800 rounded-lg h-96 w-full" />
);

// Usage
const Canvas = () => (
  <Suspense fallback={<ChartSkeleton />}>
    {viewMode === 'dashboard' ? <DashboardGrid /> : <VizPreview />}
  </Suspense>
);
```

**Route-based splitting** (if you add routing):
```typescript
const routes = [
  { path: '/', element: lazy(() => import('./pages/Home')) },
  { path: '/dashboard/:id', element: lazy(() => import('./pages/Dashboard')) },
  { path: '/explore', element: lazy(() => import('./pages/Explore')) },
];
```

---

### 18. Add Caching Layer

**Problem**: Repeated AI calls for similar queries, re-computation of stats on every render.

**Recommendation**:
```typescript
// utils/cache.ts
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class QueryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }
  
  set<T>(key: string, data: T, ttlMs: number = 5 * 60 * 1000): void {
    this.cache.set(key, { data, timestamp: Date.now(), ttl: ttlMs });
  }
  
  hash(query: string, context: object): string {
    return btoa(JSON.stringify({ query, context })).slice(0, 32);
  }
}

export const aiCache = new QueryCache();

// Usage in groqService
const processAIQuery = async (query: string, context: Context) => {
  const cacheKey = aiCache.hash(query, context);
  const cached = aiCache.get<AIQueryResult>(cacheKey);
  if (cached) return cached;
  
  const result = await actualAICall(query, context);
  aiCache.set(cacheKey, result);
  return result;
};
```

**IndexedDB for large datasets**:
```typescript
// utils/storage.ts
import { openDB } from 'idb';

const db = await openDB('openviz', 1, {
  upgrade(db) {
    db.createObjectStore('datasets', { keyPath: 'id' });
    db.createObjectStore('dashboards', { keyPath: 'id' });
  },
});

export const storage = {
  saveDataset: (dataset: Dataset) => db.put('datasets', dataset),
  getDataset: (id: string) => db.get('datasets', id),
  saveDashboard: (dashboard: SavedDashboard) => db.put('dashboards', dashboard),
  getAllDashboards: () => db.getAll('dashboards'),
};
```

---

### 19. Add Comprehensive Testing

**Problem**: No testing strategy documented.

**Recommendation**:

| Test Type | Tools | Coverage Target |
|-----------|-------|-----------------|
| Unit tests | Vitest | 80%+ for utils/services |
| Component tests | Testing Library + Vitest | Key components |
| Integration tests | Playwright | Critical user flows |
| Visual regression | Chromatic/Percy | Chart rendering |
| E2E | Playwright | Happy paths |

**Priority Unit Tests**:
```typescript
// tests/utils/schemaInference.test.ts
import { describe, it, expect } from 'vitest';
import { inferFieldType, inferSchema } from '@backend/utils/schemaInference';

describe('schemaInference', () => {
  describe('inferFieldType', () => {
    it('detects quantitative fields', () => {
      expect(inferFieldType([1, 2, 3, 4, 5])).toBe('quantitative');
    });
    
    it('detects temporal fields', () => {
      expect(inferFieldType(['2024-01-01', '2024-02-01'])).toBe('temporal');
    });
    
    it('detects nominal fields', () => {
      expect(inferFieldType(['USA', 'Canada', 'Mexico'])).toBe('nominal');
    });
  });
});

// tests/services/filterService.test.ts
describe('filterService', () => {
  const testData = [
    { country: 'USA', sales: 1000 },
    { country: 'Canada', sales: 500 },
    { country: 'Mexico', sales: 750 },
  ];
  
  it('filters by equality', () => {
    const result = applyFilters(testData, {
      conditions: [{ field: 'country', operator: 'eq', value: 'USA' }],
      logic: 'and',
    });
    expect(result).toHaveLength(1);
    expect(result[0].country).toBe('USA');
  });
  
  it('filters by greater than', () => {
    const result = applyFilters(testData, {
      conditions: [{ field: 'sales', operator: 'gt', value: 600 }],
      logic: 'and',
    });
    expect(result).toHaveLength(2);
  });
});
```

**Component Test Example**:
```typescript
// tests/components/DataShelf.test.tsx
import { render, screen } from '@testing-library/react';
import { DataShelf } from '@/components/data-shelf/DataShelf';

describe('DataShelf', () => {
  it('shows empty state when no data', () => {
    render(<DataShelf />);
    expect(screen.getByText(/upload a file/i)).toBeInTheDocument();
  });
  
  it('renders field list when data is loaded', () => {
    // Mock store with dataset
    render(<DataShelf />);
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('Region')).toBeInTheDocument();
  });
});
```

---

## 📊 Feature Prioritization Matrix

| Feature | User Value | Effort | Revenue Impact | Priority |
|---------|------------|--------|----------------|----------|
| API key security | Critical | Low | Blocker | **P0** |
| Image export (PNG/SVG) | High | Low | Medium | **P0** |
| Error handling | High | Medium | Medium | **P0** |
| Onboarding | High | Medium | High | **P0** |
| Cross-chart filtering | Very High | Medium | High | **P1** |
| PowerPoint export | High | Medium | Very High (enterprise) | **P1** |
| Calculated fields | High | Medium | Medium | **P1** |
| Google Sheets connector | High | Medium | High | **P1** |
| Streaming AI | Medium | Medium | Low | **P2** |
| Templates gallery | Medium | Low | Medium | **P2** |
| Keyboard shortcuts | Medium | Low | Low | **P2** |
| Store refactor | Low (devs) | Medium | Low | **P2** |
| Advanced aggregations | Medium | Medium | Medium | **P2** |
| Drill-down | Medium | Medium | Medium | **P2** |
| Full collaboration | Very High | Very High | Very High | **P3** |
| Database connectors | High | High | High | **P3** |

---

## 💰 Monetization Considerations

### Freemium Model

| Tier | Features | Price |
|------|----------|-------|
| **Free** | 3 dashboards, 5 charts each, file upload only, watermark on exports | $0 |
| **Pro** | Unlimited dashboards, all export formats, connectors, no watermark | $15/mo |
| **Team** | Collaboration, shared dashboards, priority support, admin controls | $49/mo/user |
| **Enterprise** | SSO, audit logs, custom integrations, SLA, dedicated support | Custom |

### Usage-Based Add-ons

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| AI queries/month | 50 | 500 | Unlimited |
| Data refresh | Manual only | Scheduled | Real-time |
| Export quality | Watermarked | High-res | Custom branding |
| Data storage | 50MB | 1GB | Unlimited |
| Connectors | File only | + Sheets, API | + Database, SaaS |

### Enterprise Features to Build

- [ ] Single Sign-On (SSO) with SAML/OIDC
- [ ] Role-based access control (Viewer, Editor, Admin)
- [ ] Audit logs for compliance
- [ ] Custom branding (logo, colors)
- [ ] API access for automation
- [ ] Embedded analytics (iframe with auth)
- [ ] Data governance (row-level security)

---

## 🎯 Recommended 90-Day Roadmap

### Month 1: Foundation & Security (Weeks 1-4)

**Week 1: Security & Infrastructure**
- [ ] Set up backend proxy for API key (Cloudflare Workers or Vercel Edge)
- [ ] Add rate limiting (100 requests/hour per IP)
- [ ] Implement API error handling with retry logic

**Week 2: Error Handling & Stability**
- [ ] Add React Error Boundaries to major sections
- [ ] Implement toast notification system
- [ ] Add loading states and skeletons
- [ ] Create "Report Bug" functionality

**Week 3: Export Capabilities**
- [ ] Implement PNG export
- [ ] Implement SVG export
- [ ] Add export button to chart toolbar
- [ ] Create export options modal

**Week 4: Onboarding & Empty States**
- [ ] Design and implement first-run tutorial (5 steps)
- [ ] Create 3 sample datasets
- [ ] Design empty states for all panels
- [ ] Add contextual help tooltips

### Month 2: Competitive Features (Weeks 5-8)

**Week 5: Cross-Chart Filtering**
- [ ] Design cross-filter data model
- [ ] Implement click-to-filter on charts
- [ ] Add filter propagation to other charts
- [ ] Create filter badge UI with clear button

**Week 6: Calculated Fields**
- [ ] Design calculated field UI
- [ ] Implement formula parser (basic arithmetic)
- [ ] Add AI-assisted field creation
- [ ] Support common functions (SUM, AVG, IF)

**Week 7: PowerPoint Export**
- [ ] Integrate pptxgenjs library
- [ ] Design export options (single chart vs. dashboard)
- [ ] Implement chart-to-slide conversion
- [ ] Add template selection

**Week 8: Google Sheets Connector**
- [ ] Set up Google OAuth flow
- [ ] Implement Sheets API integration
- [ ] Create connector UI in data import
- [ ] Add refresh functionality

### Month 3: Polish & Scale (Weeks 9-12)

**Week 9: AI Enhancements**
- [ ] Implement streaming responses
- [ ] Add user feedback (👍/👎) on AI responses
- [ ] Create fallback provider (Claude or GPT)
- [ ] Improve prompt engineering

**Week 10: Template Gallery**
- [ ] Design 10 chart templates
- [ ] Create template browser UI
- [ ] Implement "Save as template" feature
- [ ] Add "Duplicate chart" button

**Week 11: Architecture Improvements**
- [ ] Split store into slices
- [ ] Implement lazy loading for heavy components
- [ ] Add caching layer for AI responses
- [ ] Set up basic unit tests (target: 50% coverage)

**Week 12: Performance & Polish**
- [ ] Performance audit and optimization
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Cross-browser testing
- [ ] Documentation and changelog

---

## Final Thoughts

OpenViz has a **strong foundation** — the AI integration is thoughtful, the feature set is impressive for a solo/small team project, and the architecture is reasonable. The biggest gaps are:

1. **Security** — API key exposure is a blocker for any commercial deployment
2. **Export** — Users can't get their work out of the app
3. **Interactivity** — Dashboards need cross-filtering to compete with BI tools
4. **Enterprise features** — Collaboration and connectors unlock paid tiers

### Immediate Action Items

1. **This week**: Move API key to backend proxy
2. **Next week**: Add PNG/SVG export
3. **This month**: Onboarding + error handling
4. **This quarter**: Cross-chart filtering + PowerPoint export

### Competitive Positioning

**Differentiate from**:
- **Tableau/Power BI**: Simpler, AI-first, no learning curve
- **Chart.js/D3**: Higher-level, no coding required
- **Datawrapper**: More interactive, dashboard support
- **Observable**: More accessible, less technical

**Target users**:
- Data analysts who want faster exploration
- Product managers who need quick dashboards
- Marketers who want self-service analytics
- Small teams without dedicated BI resources

### Success Metrics to Track

| Metric | Target (90 days) |
|--------|------------------|
| Weekly Active Users | 500+ |
| Charts created/week | 2,000+ |
| AI queries/week | 5,000+ |
| Export rate | 30%+ of charts |
| Retention (Week 1) | 40%+ |
| NPS | 40+ |

---

*This analysis was prepared based on a comprehensive review of OpenViz documentation including CLAUDE.md, README.md, project_overview.md, and AI_FEATURES_IMPLEMENTATION_REPORT.md.*
