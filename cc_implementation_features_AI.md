Implement the following plan:                                                   
                                                                                  
  # Implementation Plan: 5 AI Features for OpenViz                                
                                                                                  
  ## Implementation Order                                                         
  1. **Chart Recommendations** (auto-triggered on data load)                      
  2. **NL Data Filtering** (new `filter` intent)                                  
  3. **Report Generation** (button-triggered, LLM narratives)                     
  4. **Comparison Mode** (new `compare` intent)                                   
  5. **Predictive Analytics** (new `forecast` intent)                             
                                                                                  
  ---                                                                             
                                                                                  
  ## Feature 1: Proactive Chart Recommendations                                   
                                                                                  
  ### Files (in order)                                                            
                                                                                  
  1. **`backend/types/index.ts`** — Add `ChartRecommendation` interface (id,      
  mark, xField, yField, colorField?, score, reason)                               
                                                                                  
  2. **`backend/services/recommendationService.ts`** — NEW (~250 lines)           
  - `analyzeFieldPairs(fields, data)` — score every valid (x,y) pair              
  - `scoreChartCandidate(xField, yField, data)` — weighted: type                  
  compatibility 25%, cardinality 30%, variance 20%, correlation 15%, user         
  patterns 10%                                                                    
  - `generateRecommendations(fields, data, limit=5)` — return top N               
  - Mark type selection reuses `autoChart.ts` logic                               
                                                                                  
  3. **`frontend/src/store/useVizStore.ts`** — (~60 lines)                        
  - State: `chartRecommendations`, `recommendationsLoading`                       
  - Actions: `generateRecommendations()`, `applyRecommendation(id)`,              
  `dismissRecommendation(id)`                                                     
  - Call at end of `loadDataFromFile()` after profiling                           
  - `applyRecommendation`: sets chartConfig + encodings, calls                    
  `regenerateSpec()`                                                              
                                                                                  
  4. **`frontend/src/components/recommendations/RecommendationPanel.tsx`** —      
  NEW (~120 lines)                                                                
  - Show when: dataset loaded, no encodings, recommendations exist                
  - 3-5 cards with chart type icon, field names, reason, "Apply" button           
                                                                                  
  5. **`frontend/src/components/canvas/Canvas.tsx`** — Mount                      
  `<RecommendationPanel />` above `<VizPreview />`                                
                                                                                  
  ---                                                                             
                                                                                  
  ## Feature 2: Natural Language Data Filtering                                   
                                                                                  
  ### Files (in order)                                                            
                                                                                  
  1. **`backend/types/index.ts`** — Add `FilterOperator`, `FilterCondition`,      
  `FilterSpec` types. Add `'filter'` to `AIIntent`. Add `filterSpec?` to          
  `AIQueryResult`.                                                                
                                                                                  
  2. **`backend/services/filterService.ts`** — NEW (~150 lines)                   
  - `applyFilters(data, spec)` — iterate conditions with and/or logic             
  - `evaluateCondition(record, condition)` — switch on operator (eq, gt,          
  lt, contains, in, etc.)                                                         
  - `getFilterSummary(spec, originalCount, filteredCount)`                        
                                                                                  
  3. **`backend/services/groqService.ts`** — (~80 lines)                          
  - Add filter to `detectIntent()` prompt: keywords "filter", "only show",        
  "where", "greater than", "exclude"                                              
  - Add regex fallback for filter keywords                                        
  - New `processFilterRequest()`: LLM parses NL into FilterCondition[]            
  with fuzzy field matching                                                       
  - Add `case 'filter'` to switch in `processAIQuery()`                           
                                                                                  
  4. **`frontend/src/store/useVizStore.ts`** — (~40 lines)                        
  - State: `activeFilters`, `filteredData`                                        
  - Actions: `applyFilter(spec)`, `clearFilters()`                                
  - **Critical**: `regenerateSpec()` must use `filteredData ??                    
  dataset.data`                                                                   
  - Handle `result.filterSpec` in `processAIQuery` action                         
                                                                                  
  5. **`frontend/src/components/canvas/Canvas.tsx`** — Amber filter badge         
  with count + clear button (~25 lines)                                           
                                                                                  
  ---                                                                             
                                                                                  
  ## Feature 3: Report Generation                                                 
                                                                                  
  ### Files (in order)                                                            
                                                                                  
  1. **`backend/types/index.ts`** — Add `ReportSection` (type, title,             
  content, enabled), `ReportData` (title, sections, generatedAt, datasetName)     
                                                                                  
  2. **`backend/services/reportService.ts`** — NEW (~300 lines)                   
  - `generateExecutiveSummary(dataProfile, charts[])` — LLM call                  
  - `generateChartNarrative(chartConfig, dataProfile, data)` — LLM call           
  per chart                                                                       
  - `generateDataOverview(dataProfile)` — pure computation                        
  - `generateKeyFindings(dataProfile, data)` — LLM call                           
  - `generateFullReport(...)` — orchestrator                                      
  - `compileToMarkdown(report)` — format to markdown string                       
                                                                                  
  3. **`backend/services/groqService.ts`** — Add `generateNarrative()` helper     
  (~80 lines)                                                                     
                                                                                  
  4. **`frontend/src/store/useVizStore.ts`** — (~40 lines)                        
  - State: `reportData`, `reportLoading`, `showReportModal`                       
  - Actions: `generateReport()`, `downloadReport()` (creates Blob +               
  triggers download)                                                              
                                                                                  
  5. **`frontend/src/components/report/ReportGenerator.tsx`** — NEW (~150         
  lines)                                                                          
  - Radix Dialog modal with section toggles, generate button, markdown            
  preview, download .md                                                           
                                                                                  
  6. **`frontend/src/components/canvas/Canvas.tsx`** +                            
  **`DashboardGrid.tsx`** — Add report button (FileText icon)                     
                                                                                  
  ---                                                                             
                                                                                  
  ## Feature 4: Comparison Mode                                                   
                                                                                  
  ### Files (in order)                                                            
                                                                                  
  1. **`backend/types/index.ts`** — Add `ComparisonType`, `ComparisonSpec`,       
  `ComparisonResult`. Add `'compare'` to `AIIntent`. Add `comparisonSpec?`,       
  `comparisonResult?` to `AIQueryResult`.                                         
                                                                                  
  2. **`backend/services/comparisonService.ts`** — NEW (~220 lines)               
  - `executeComparison(data, spec)` — split by groupField, aggregate              
  metricField per group                                                           
  - `buildComparisonChartConfig(result, fields)` — grouped bar or overlaid        
  line config                                                                     
  - `formatComparisonSummary(result)` — text summary with % change                
                                                                                  
  3. **`backend/services/groqService.ts`** — (~100 lines)                         
  - Add compare to `detectIntent()`: keywords "compare", "vs", "versus",          
  "difference between", "year over year"                                          
  - New `processCompareRequest()`: LLM parses group field, values A/B,            
  metric, aggregate                                                               
  - Add `case 'compare'` to switch                                                
                                                                                  
  4. **`backend/utils/echartsOptionBuilder.ts`** — (~80 lines)                    
  - `buildComparisonOption(config, data, comparisonResult)`: grouped bars         
  for category, overlaid lines for time period, dual Y-axis for metric            
  comparison, difference annotations                                              
                                                                                  
  5. **`frontend/src/store/useVizStore.ts`** — (~50 lines)                        
  - State: `comparisonMode`, `comparisonSpec`, `comparisonResult`                 
  - Actions: `applyComparison(spec)`, `clearComparison()`                         
  - `regenerateSpec()`: pass comparisonResult to builder when present             
                                                                                  
  6. **`frontend/src/components/canvas/Canvas.tsx`** — Blue comparison badge      
  with % change + exit button (~30 lines)                                         
                                                                                  
  ---                                                                             
                                                                                  
  ## Feature 5: Predictive Analytics (Forecasting)                                
                                                                                  
  ### Files (in order)                                                            
                                                                                  
  1. **`backend/types/index.ts`** — Add `ForecastPoint` (x, y, lower?,            
  upper?), `ForecastResult` (method, periods, points, accuracy). Add              
  `'forecast'` to `AIIntent`. Add `forecastResult?` to `AIQueryResult`.           
                                                                                  
  2. **`backend/services/forecastService.ts`** — NEW (~200 lines)                 
  - `linearForecast(xValues, yValues, periods)` — reuse                           
  `calculateTrendLine` from annotationService                                     
  - `exponentialSmoothing(values, alpha, periods)` — simple ES                    
  - `holtsLinearTrend(values, alpha, beta, periods)` — for trended data           
  - `selectBestMethod(data)` — pick based on trend strength                       
  - `generateForecast(data, temporalField, metricField, periods)` —               
  orchestrator                                                                    
  - `generateConfidenceInterval(actuals, predicted, forecasts)` — adds            
  lower/upper from residual stddev                                                
                                                                                  
  3. **`backend/services/groqService.ts`** — (~80 lines)                          
  - Add forecast to `detectIntent()`: keywords "forecast", "predict",             
  "project", "next X months"                                                      
  - New `processForecastRequest()`: LLM identifies temporal field, metric         
  field, period count                                                             
  - Add `case 'forecast'` to switch                                               
                                                                                  
  4. **`backend/utils/echartsOptionBuilder.ts`** — (~60 lines)                    
  - Append dashed line series for forecast points                                 
  - Optional area series for confidence interval (semi-transparent)               
  - Extend xAxis to include forecast labels                                       
  - Vertical markLine at actual/forecast boundary                                 
                                                                                  
  5. **`frontend/src/store/useVizStore.ts`** — (~50 lines)                        
  - State: `forecastData`, `forecastLoading`                                      
  - Actions: `generateForecast(periods?)`, `clearForecast()`                      
  - `regenerateSpec()`: pass forecastData to builder when present                 
                                                                                  
  6. **`frontend/src/components/canvas/Canvas.tsx`** — Cyan forecast badge        
  with period count + clear button (~20 lines)                                    
                                                                                  
  ---                                                                             
                                                                                  
  ## Cross-Cutting: Key Integration Points                                        
                                                                                  
  - **`regenerateSpec()`** is the critical function — must be updated to:         
  1. Use `filteredData ?? dataset.data` (Feature 2)                               
  2. Pass `forecastData` to builder (Feature 5)                                   
  3. Pass `comparisonResult` to builder (Feature 4)                               
  - **`processAIQuery` in store** needs 3 new result handlers (filter,            
  compare, forecast)                                                              
  - **`groqService.ts`**: `AIIntent` gets 3 new values, `detectIntent()` gets     
  3 new intent descriptions, `processAIQuery()` switch gets 3 new cases, 3        
  new processor functions                                                         
                                                                                  
  ## Verification                                                                 
                                                                                  
  After each feature: `npm run dev`, upload CSV, test the feature, then `cd       
  frontend && npx tsc -b` for type checking.                                      
                                            