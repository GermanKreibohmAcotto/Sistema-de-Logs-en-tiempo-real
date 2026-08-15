# Tasks: Obsidian Flux Dashboard Restyle

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | PR1 ~560 · PR2 ~510 · PR3 ~215 · Total ~1,285 |
| 800-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Shell + tokens) → PR 2 (Stream surfaces) → PR 3 (Chart + side panels) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
800-line budget risk: Medium

Per-slice risk: PR1 Medium (icons.tsx + Sidebar + App shell + 3 test files bundled — closest to the 800 ceiling), PR2 Medium (LogConsole/Historical/LogRow/FilterBar restyle + LogConsole.test.tsx), PR3 Low (visual-only, no new tests). Threat Matrix: N/A per design — presentational-only `apps/web` change, no routing/subprocess/VCS boundary, so no threat-matrix RED tasks apply.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Shell + tokens; repairs the pre-existing `LEVEL_BADGE_CLASSES` break; must end green | PR 1 → main | `npm test && npx tsc -b apps/web` | `npm run dev -w @logs/web`: click "En vivo"/"Histórico" in Sidebar, confirm live console renders, dot reflects `WsClient` status | `git revert` PR1 + `npm install`; App.tsx/FilterBar.tsx/LogRow.tsx return to pre-restyle shape; no API/DB coordination |
| 2 | Stream surfaces: virtualized console, historical list, row/filter restyle | PR 2 → PR1 branch (retarget to main once PR1 merges) | `npx vitest run apps/web/test/LogConsole.test.tsx` | `npm run dev -w @logs/web` + `npm run load` (loadgen) feeding high-ingest WS traffic; scroll up mid-stream, confirm "Ir al final (N nuevos)" | `git revert` PR2 commits only; `row-metrics.ts` stays owned by PR1, no cross-slice break |
| 3 | Chart + side panels: `ChartPanel`, gradients, `AlertsPanel`, `ExportButton`, `TokenGate` | PR 3 → PR2 branch (retarget to main once PR2 merges) | `npm test && npm run build -w @logs/web` | `npm run dev -w @logs/web`: trigger an alert rule (toast glass), export CSV, submit `TokenGate` (overlay blur) | `git revert` PR3 commits; App.tsx's `<ChartPanel>` swap is the only shared line, reverts in the same commit |

## Phase 1: Shell & Tokens (PR 1 — must end green)

- [x] 1.1 Fix `vitest.config.ts`: `test.include` accepts `*.test.tsx`; add top-level `esbuild: { jsx: 'automatic' }`
- [x] 1.2 Add `@testing-library/react@^16` + `@testing-library/dom@^10` to root `package.json` devDependencies; `npm install`
- [x] 1.3 [GREEN] `FilterBar.tsx`: swap broken `LEVEL_BADGE_CLASSES` import/usage → `LEVEL_CHIP_CLASSES`; confirm `npx tsc -b apps/web` passes
- [x] 1.4 [GREEN] `LogRow.tsx`: swap broken `LEVEL_BADGE_CLASSES` import/usage → `LEVEL_TEXT_CLASSES`; confirm `npx tsc -b apps/web` passes (blocking precondition resolved)
- [x] 1.5 [RED] `apps/web/test/view-mode.test.ts`: `'live'` clears `from`/`to`; `'historical'` preserves them (fails — module missing)
- [x] 1.6 [GREEN] Create `apps/web/src/lib/view-mode.ts` (`ViewMode`, `TimeRange`, `applyModeChange`); 1.5 passes
- [x] 1.7 [RED] `apps/web/test/level-styles.test.ts`: every `LEVEL_*_CLASSES` map has all 5 `LOG_LEVELS` keys; `CHART_CHROME` values all start with `var(--`; `ROW_HEIGHT === 28`; `ROW_HEIGHT_CLASS === 'h-7'` (fails — `CHART_CHROME`/`row-metrics` missing)
- [x] 1.8 [GREEN] Create `apps/web/src/lib/row-metrics.ts` (`ROW_HEIGHT = 28`, `ROW_HEIGHT_CLASS = 'h-7'`, `COLUMN_CLASSES`)
- [x] 1.9 [GREEN] Add `CHART_CHROME` (axis/grid/tooltip `var(--color-*)` strings) to `level-styles.ts`; 1.7 passes
- [x] 1.10 Create `apps/web/src/lib/connection-styles.ts`; move `STATUS_DOT_CLASSES`/`STATUS_LABELS` out of `ConnectionBanner.tsx`
- [x] 1.11 [RED] `apps/web/test/Sidebar.test.tsx`: two buttons by accessible name; active carries `aria-pressed="true"`; clicking "En vivo" calls `onModeChange('live')`; file has its own `afterEach(cleanup)` (fails — `Sidebar` missing)
- [x] 1.12 Create `apps/web/src/components/icons.tsx`: 9 icons (`IconLive`, `IconHistory`, `IconSearch`, `IconServer`, `IconBell`, `IconDownload`, `IconPause`, `IconPlay`, `IconArrowDown`) sharing `IconProps { size?: number; className?: string }`
- [x] 1.13 [GREEN] Create `apps/web/src/components/Sidebar.tsx`: 288px shell, two mode buttons (icon + `aria-label`), status dot via `connection-styles.ts`, endpoint card; 1.11 passes
- [x] 1.14 Modify `ConnectionBanner.tsx`: consume `connection-styles.ts` maps, header pill only (no full-width banner — discreet degraded states)
- [x] 1.15 Modify `App.tsx`: shell layout (`h-screen overflow-hidden`, sidebar + 64px bar + non-scrolling content column); wire `Sidebar` via `applyModeChange`; stop passing `mode`/`onBackToLive` to `FilterBar`
- [x] 1.16 Modify `FilterBar.tsx`: remove `mode`/`onBackToLive` from `FilterBarProps`; delete the now-orphaned mode badge + "Volver a en vivo" JSX (structural only — full visual restyle deferred to Phase 2)
- [x] 1.17 Modify `index.css`: `@theme` → `@theme static`; verify `--color-outline-variant` in `apps/web/dist/assets/*.css` after `npm run build -w @logs/web` (fallback to plain `@theme`, documented inline, if unsupported)
- [x] 1.18 Verify PR1 green: `npm test`, `npx tsc -b apps/web`, `npm run build -w @logs/web`, `npm run typecheck`

## Phase 2: Stream Surfaces (PR 2)

- [x] 2.1 Create `apps/web/test/helpers/dom-layout.ts`: stub `Element.prototype.getBoundingClientRect`, define `clientHeight`/`scrollHeight`, no-op `Element.prototype.scrollTo`
- [x] 2.2 [RED] Scenario "10,000-item buffer stays bounded" — `apps/web/test/LogConsole.test.tsx`: seed 10k-event `LogStore`, assert `[data-testid="log-row"]` count `< 120`
- [x] 2.3 [RED] Scenario "Rendered height matches estimate" — same file: assert every row wrapper `style.height === '28px'`
- [x] 2.4 [RED] Scenario "Scroll up detaches" — same file: scroll past 48px threshold, assert "Ir al final" shows the count since detach
- [x] 2.5 No new test: Scenario "High ingest does not re-render per frame" (ring buffer outside React) stays covered by existing `apps/web/test/log-store.test.ts`; confirm `LogConsole.tsx` keeps `useSyncExternalStore(store.subscribe, store.getSnapshot)` unchanged
- [x] 2.6 [GREEN] Modify `LogConsole.tsx`: import `ROW_HEIGHT`/`ROW_HEIGHT_CLASS` from `row-metrics.ts` (drop local const), add `data-testid="log-row"`/`"log-viewport"`, panel surface + column header + toolbar restyle; 2.2–2.4 pass
- [x] 2.7 Modify `HistoricalLogList.tsx`: import shared `ROW_HEIGHT` from `row-metrics.ts` (drop local const — keeps the cross-file invariant with `LogConsole`), same panel + column header restyle
- [x] 2.8 Modify `LogRow.tsx`: full restyle to `LEVEL_TEXT_CLASSES`/`LEVEL_ROW_CLASSES`/`LEVEL_ACCENT_CLASSES`, `COLUMN_CLASSES`, `h-full`/`overflow-hidden`, no vertical padding (rendered-height invariant)
- [x] 2.9 Modify `FilterBar.tsx`: segmented level control using `LEVEL_CHIP_CLASSES`, token surfaces (structural prop removal already done in 1.16)
- [x] 2.10 Verify PR2 green: `npm test`, `npx tsc -b apps/web`, manual scroll-detach + 10k-buffer smoke in dev

## Phase 3: Chart & Side Panels (PR 3)

- [ ] 3.1 Create `apps/web/src/components/ChartPanel.tsx`: surface + heading wrapper around `RateChart`, `h-56 shrink-0`
- [ ] 3.2 Modify `RateChart.tsx`: per-level `<linearGradient>` (`0.45 → 0.05`) + full-opacity 1.5px stroke per level (deviation from DESIGN.md's literal 10%, approved); consume `CHART_CHROME` for grid/axis/tooltip
- [ ] 3.3 Modify `App.tsx`: replace inline chart `div` with `<ChartPanel>`
- [ ] 3.4 Modify `AlertsPanel.tsx`: panel surface, form/rule/history restyle, `backdrop-blur` toasts (sanctioned glass surface #1)
- [ ] 3.5 Modify `ExportButton.tsx`: token button styling + `IconDownload`
- [ ] 3.6 Modify `TokenGate.tsx`: token card + `backdrop-blur` overlay (sanctioned glass surface #2)
- [ ] 3.7 Verify PR3 green: `npm test`, `npx tsc -b apps/web`, `npm run build -w @logs/web`; confirm zero external network requests on cold load and no `backdrop-filter`/animation inside `[data-testid="log-viewport"]`
