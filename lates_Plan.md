## OpenViz Full-Codebase Audit and Improvement Plan

### Summary
Audit baseline: current working tree (including uncommitted changes).  
Goal: get the project to a reliable, shippable baseline, close security gaps, and add high-impact product improvements without changing UX direction.

### Current-State Findings (Prioritized)
1. **P0 Security: AI keys can be exposed client-side**
- Evidence: [aiProvider.ts](/mnt/d/code/openviz/backend/services/aiProvider.ts:69), [aiProvider.ts](/mnt/d/code/openviz/backend/services/aiProvider.ts:81), [aiProvider.ts](/mnt/d/code/openviz/backend/services/aiProvider.ts:260), [aiProvider.ts](/mnt/d/code/openviz/backend/services/aiProvider.ts:279)
- Risk: direct browser calls use provider secrets; `dangerouslyAllowBrowser` and direct Anthropic browser header usage are active.
- Additional critical signal: `.env` in workspace currently contains a real-looking Groq key (rotate immediately and replace).

2. **P0 Build is broken**
- Evidence: frontend build fails with TS errors from both frontend and backend code paths (hook rules, missing types, type mismatches, invalid store fields).
- Key files: [DashboardGrid.tsx](/mnt/d/code/openviz/frontend/src/components/canvas/DashboardGrid.tsx:546), [useVizStore.ts](/mnt/d/code/openviz/frontend/src/store/useVizStore.ts:476), [autoChart.ts](/mnt/d/code/openviz/backend/utils/autoChart.ts:173), [vegaSpecBuilder.ts](/mnt/d/code/openviz/backend/utils/vegaSpecBuilder.ts:9), [index.ts](/mnt/d/code/openviz/backend/types/index.ts:125)

3. **P0 Hook-order violation**
- Evidence: [DashboardGrid.tsx](/mnt/d/code/openviz/frontend/src/components/canvas/DashboardGrid.tsx:465), [DashboardGrid.tsx](/mnt/d/code/openviz/frontend/src/components/canvas/DashboardGrid.tsx:546)
- Risk: conditional early returns before `useCallback` violate React hook ordering.

4. **P1 Type-system drift between shared types and chart builders**
- Evidence: expanded `MarkType` union vs incomplete mappings: [index.ts](/mnt/d/code/openviz/backend/types/index.ts:125), [autoChart.ts](/mnt/d/code/openviz/backend/utils/autoChart.ts:173), [vegaSpecBuilder.ts](/mnt/d/code/openviz/backend/utils/vegaSpecBuilder.ts:50)
- Risk: compile failures and runtime feature inconsistency for advanced mark types.

5. **P1 Store model inconsistency and dead state fields**
- Evidence: setting non-existent `vegaSpec`: [useVizStore.ts](/mnt/d/code/openviz/frontend/src/store/useVizStore.ts:476), [useVizStore.ts](/mnt/d/code/openviz/frontend/src/store/useVizStore.ts:540)
- Risk: type failures and unclear canonical chart-spec model.

6. **P1 Frontend/backend boundary is muddled**
- Evidence: frontend TS config includes backend source: [tsconfig.app.json](/mnt/d/code/openviz/frontend/tsconfig.app.json:40)
- Risk: frontend build blocked by backend-only typing/deps; package isolation is not enforced.

7. **P1 Lint gate is effectively unusable**
- Evidence: many `any` violations in unused slices not wired into store: [aiSlice.ts](/mnt/d/code/openviz/frontend/src/store/slices/aiSlice.ts:21), [types.ts](/mnt/d/code/openviz/frontend/src/store/slices/types.ts:4)
- Risk: CI noise and reduced signal from lint.

8. **P2 Worker proxy can be abused without app-level auth**
- Evidence: accepts any POST with permissive origin fallback: [index.ts](/mnt/d/code/openviz/cloudflare-worker/src/index.ts:112), [index.ts](/mnt/d/code/openviz/cloudflare-worker/src/index.ts:241)
- Risk: public endpoint consumption beyond intended app use.

9. **P2 Error handling polish gap**
- Evidence: Vite app uses `process.env.NODE_ENV` check: [ErrorFallback.tsx](/mnt/d/code/openviz/frontend/src/components/ui/ErrorFallback.tsx:129)
- Risk: incorrect environment branching in Vite.

10. **P2 No automated tests present**
- Evidence: no test/spec files found in `frontend`, `backend`, or `cloudflare-worker`.
- Risk: regressions likely during rapid AI/chart feature development.

### Implementation Plan (Decision-Complete)

#### Phase 0: Security Containment
1. Revoke and rotate all provider keys currently used in local `.env` and any previously exposed keys.
2. Remove direct browser-provider fallback from `aiProvider`; require proxy for non-local dev.
3. Keep a controlled dev-only mode via explicit flag `VITE_ALLOW_INSECURE_DIRECT_AI=false` default.
4. Add proxy request authentication:
- Frontend sends signed nonce or short-lived app token header.
- Worker validates before forwarding.
5. Tighten CORS default:
- Reject when `ALLOWED_ORIGIN` is unset (no `*` fallback).

#### Phase 1: Restore Build and Lint Baseline
1. Fix hook ordering in `DashboardGrid`:
- Move all hooks above conditional returns.
- Convert `formatTimeAgo` to top-level pure util or top-level hook-safe callback.
2. Resolve `vegaSpec` field drift:
- Either reintroduce typed `vegaSpec` in state interface or remove all stale writes; default: remove stale writes and keep `echartsOption` as source of truth.
3. Align `MarkType` mappings:
- Provide complete mappings for all `MarkType` members in `autoChart`/`vegaSpecBuilder`, or split into supported vs planned marks.
- Default: introduce `SupportedMarkType` for rendered paths and keep advanced marks behind feature flags.
4. Fix missing/invalid backend types:
- Add `VegaLiteSpec` export in shared types or stop importing it where unused.
- Correct ECharts treemap option typing (`breadcrumb` fields).
5. Fix compile config boundaries:
- Remove `../backend` from frontend app compilation path.
- Create explicit shared package/module for `types` and pure utilities needed in frontend.
6. Lint strategy:
- Exclude unused legacy slice folder from lint temporarily.
- Then either delete dead slices or fully migrate store to slices.

#### Phase 2: Architecture Hardening
1. Introduce `packages/shared` (or equivalent) for shared TS contracts:
- `ChartConfig`, `MarkType`, `Dataset`, `AIQueryResult`, utility-safe enums.
2. Keep backend service code out of frontend build graph except explicitly browser-safe modules.
3. Define a strict AI client interface:
- `AIClient.request(query, context)` and `AIClient.stream(...)` implemented by proxy transport only in production.
4. Enforce environment contracts:
- `.env.example` only, no real keys.
- Startup validation for required env vars.

#### Phase 3: Product Improvements (High-ROI Features)
1. Add query/result observability:
- Track prompt intent, provider, latency, token usage, failure reason.
2. Add "AI action preview" mode:
- Show diff of chart/dashboard changes before applying.
3. Add dataset privacy controls for sharing:
- Option to share chart config only (no raw dataset in URL).
4. Add semantic model layer:
- User-curated field aliases/metrics to improve AI accuracy.
5. Add dashboard-level version snapshots:
- Named checkpoints and rollback, not just undo stack.
6. Add data freshness UX:
- Stronger stale-data warnings and auto-refresh health indicators.

### Public APIs / Interfaces / Types to Change
1. Add `SupportedMarkType` and keep `MarkType` as superset if needed.
2. Add `AITransportConfig` with explicit `mode: 'proxy' | 'direct-dev'`.
3. Add worker auth interface:
- Header contract: `X-OpenViz-Signature`, `X-OpenViz-Timestamp` (or equivalent token header).
4. Normalize store interfaces:
- Remove stale `vegaSpec` writes or add `vegaSpec?:` consistently and document ownership.
5. Add `SharePayloadV2`:
- `includeDataset: boolean`, schema versioned for backward compatibility.

### Test Cases and Scenarios
1. Build/lint gates:
- `frontend`: lint clean, `npm run build` pass.
- `backend/shared`: typecheck pass independently.
- `worker`: typecheck pass.
2. Security tests:
- No provider key in built frontend bundle.
- Worker rejects missing/invalid auth headers.
- Worker rejects disallowed origins.
3. Runtime behavior:
- Dashboard renders without hook-order warnings/errors.
- AI query create/modify/delete flows in single and dashboard mode.
- Streaming responses update chat incrementally and finalize correctly.
4. Type coverage:
- Every `SupportedMarkType` has deterministic mapping test.
- Unknown/unsupported mark degrades gracefully.
5. Share flows:
- Large dataset share warns and handles truncation risk.
- Config-only share imports correctly.
6. Regression smoke:
- Load CSV/JSON/XLSX, create chart, apply filter, generate report/export.

### Assumptions and Defaults
1. Baseline is **current working tree** (not just committed HEAD).
2. Keep current UI design language; prioritize stability/security over visual redesign.
3. Proxy-first AI architecture is the default for all non-local environments.
4. Advanced chart marks remain behind capability checks until fully implemented.
5. Legacy unused store slices are treated as technical debt and excluded/deleted unless explicitly needed.

### Execution Updates
1. `Phase 1 / Task 1 - Fix hook ordering in DashboardGrid`: **Completed**
- Moved hook-dependent declarations above early returns and removed conditional `useCallback` usage by promoting `formatTimeAgo` to a top-level utility function.
- Updated dashboard title effect dependency to remove the remaining hook dependency warning signal.
2. `Task 1 push to GitHub`: **Blocker**
- Push failed in this environment due Git credential/auth setup (`credential-manager` unavailable and no GitHub username/token available for HTTPS push).
3. `Phase 1 / Task 2 - Resolve vegaSpec field drift`: **Completed**
- Removed stale `vegaSpec: null` assignments from the active store and legacy data slice so state updates now align with the current `echartsOption` model.
4. `Task 2 push to GitHub`: **Blocker**
- Push failed again for the same credential/auth reason (`credential-manager` unavailable and no HTTPS username/token configured in this shell).
5. `Phase 1 / Task 4 - Fix missing shared backend type`: **Completed**
- Added a shared `VegaLiteSpec` contract (with related field/mark helper types) in `backend/types/index.ts` so `vegaSpecBuilder` imports resolve correctly.
6. `Task 3 push to GitHub`: **Blocker**
- Push remains blocked by local Git authentication setup in this environment (`credential-manager` unavailable and no HTTPS credentials configured).
7. `Phase 1 / Task 6 - Lint strategy (temporary scope reduction)`: **Completed**
- Temporarily excluded `src/store/slices/**` from lint in `frontend/eslint.config.js` to focus lint signal on the active store path (`useVizStore`).
- Result: lint errors dropped from the large legacy-slice set to 6 active-code issues.
8. `Git push blocker (HTTPS -> SSH)`: **Resolved**
- Root cause: `origin` was configured as HTTPS with `credential.helper=manager` and `http.sslbackend=openssl`, which failed in this environment.
- Fix applied: switched `origin` to SSH (`git@github.com:Aakashneeli/openviz.git`) and verified auth with `ssh -T git@github.com`.
- Outcome: all task commits were successfully pushed to `main`.
