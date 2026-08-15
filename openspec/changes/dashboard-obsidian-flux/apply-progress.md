# Apply Progress: Obsidian Flux Dashboard Restyle

## Change: dashboard-obsidian-flux
## Mode: Strict TDD
## Scope of this batch: Phase 1 / PR1 only (tasks 1.1–1.18)

## Completed Tasks

- [x] 1.1 Fix `vitest.config.ts`: `test.include` accepts `*.test.tsx`; add top-level `esbuild: { jsx: 'automatic' }`
- [x] 1.2 Add `@testing-library/react@^16` + `@testing-library/dom@^10` to root `package.json` devDependencies; `npm install`
- [x] 1.3 [GREEN] `FilterBar.tsx`: swap broken `LEVEL_BADGE_CLASSES` import/usage → `LEVEL_CHIP_CLASSES`
- [x] 1.4 [GREEN] `LogRow.tsx`: swap broken `LEVEL_BADGE_CLASSES` import/usage → `LEVEL_TEXT_CLASSES` (blocking precondition resolved)
- [x] 1.5 [RED] `apps/web/test/view-mode.test.ts`
- [x] 1.6 [GREEN] Create `apps/web/src/lib/view-mode.ts`
- [x] 1.7 [RED] `apps/web/test/level-styles.test.ts`
- [x] 1.8 [GREEN] Create `apps/web/src/lib/row-metrics.ts`
- [x] 1.9 [GREEN] Add `CHART_CHROME` to `level-styles.ts`
- [x] 1.10 Create `apps/web/src/lib/connection-styles.ts`
- [x] 1.11 [RED] `apps/web/test/Sidebar.test.tsx`
- [x] 1.12 Create `apps/web/src/components/icons.tsx`
- [x] 1.13 [GREEN] Create `apps/web/src/components/Sidebar.tsx`
- [x] 1.14 Modify `ConnectionBanner.tsx`
- [x] 1.15 Modify `App.tsx`
- [x] 1.16 Modify `FilterBar.tsx` (prop removal + orphaned JSX deletion)
- [x] 1.17 Modify `index.css`: `@theme` → `@theme static`
- [x] 1.18 Verify PR1 green: all four commands pass (see Work Unit Evidence)

**18/18 Phase 1 tasks complete. PR1 ends green.**

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.3/1.4 | N/A — compile-level | Type check | ✅ Baseline: `npx tsc -b apps/web` → 2 pre-existing `TS2724` errors (the blocking precondition itself is the RED signal) | N/A (fix, not new behavior) | ✅ `npx tsc -b apps/web` → 0 errors | ➖ N/A (mechanical import fix) | ➖ None needed |
| 1.5/1.6 | `apps/web/test/view-mode.test.ts` | Unit | N/A (new file) | ✅ Written — `Cannot find module '../src/lib/view-mode.js'` | ✅ Passed — 2/2 | ✅ 2 cases (`'live'` clears range / `'historical'` preserves range) | ➖ None needed — 6-line pure function |
| 1.7/1.8/1.9 | `apps/web/test/level-styles.test.ts` | Unit | N/A (first test file for this module) | ✅ Written — `Cannot find module '../src/lib/row-metrics.js'` | ✅ Passed — 8/8 | ✅ `it.each` across 5 `LEVEL_*` maps × 5 `LOG_LEVELS`, plus `CHART_CHROME` var(--) check, plus `ROW_HEIGHT`/`ROW_HEIGHT_CLASS` | ➖ None needed |
| 1.11/1.12/1.13 | `apps/web/test/Sidebar.test.tsx` | Component (jsdom + RTL) | N/A (new component) | ✅ Written — `Failed to resolve import "../src/components/Sidebar.js"` | ✅ Passed — 4/4 | ✅ 4 cases: both buttons present, `aria-pressed` both states, click "En vivo" → `onModeChange('live')`, click "Histórico" → `onModeChange('historical')` | ➖ None needed |

### Test Summary
- **Total tests written**: 14 (2 view-mode + 8 level-styles/row-metrics + 4 Sidebar)
- **Total tests passing**: 14/14 (suite total: 89/89, up from 75/75 baseline)
- **Layers used**: Unit (10), Component/jsdom (4), E2E (0)
- **Approval tests** (refactoring): None — no refactoring tasks in this batch
- **Pure functions created**: `applyModeChange` (view-mode.ts); token maps in row-metrics.ts/level-styles.ts/connection-styles.ts are plain data, not functions

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `npm test` → **17 test files / 89 tests passing** (baseline was 14 files/75 tests). `npx tsc -b apps/web` → **0 errors** (baseline: 2 `TS2724` errors). |
| Runtime harness command/scenario and exact result | `npm run build -w @logs/web` → succeeds; `dist/assets/*.css` confirmed to contain `--color-outline-variant:#424754;` (proves `@theme static` emits unreferenced tokens). Interactive click-through of Sidebar mode switching via `npm run dev -w @logs/web` was **not performed** — this CLI sandbox has no browser/GUI tool to drive it. `npm run build` + `npm run typecheck` (full monorepo tsc + Vite production build) is the closest available automated runtime proxy and both pass. |
| Rollback boundary | `git revert` this PR1 slice + `npm install`. Reverts `App.tsx`, `FilterBar.tsx`, `LogRow.tsx`, `ConnectionBanner.tsx` to pre-restyle shape; reverts the `@theme static` line in `index.css` and the `CHART_CHROME` addition in `level-styles.ts`; removes `Sidebar.tsx`, `icons.tsx`, `connection-styles.ts`, `row-metrics.ts`, `view-mode.ts` and their three test files. No API/DB coordination required — `apps/api`/`packages/shared` untouched. |

## Files Changed

| File | Action | What Was Done |
|------|--------|----------------|
| `vitest.config.ts` | Modified | `include` accepts `*.test.tsx`; added top-level `esbuild: { jsx: 'automatic' }` |
| `package.json` (root) | Modified | Added `@testing-library/react@^16`, `@testing-library/dom@^10` devDeps; ran `npm install` |
| `apps/web/src/components/FilterBar.tsx` | Modified | Fixed broken `LEVEL_BADGE_CLASSES` import → `LEVEL_CHIP_CLASSES`; removed `mode`/`onBackToLive` from `FilterBarProps`; deleted orphaned mode badge + "Volver a en vivo" JSX |
| `apps/web/src/components/LogRow.tsx` | Modified | Fixed broken `LEVEL_BADGE_CLASSES` import → `LEVEL_TEXT_CLASSES` |
| `apps/web/src/lib/view-mode.ts` | Created | `ViewMode`, `TimeRange`, pure `applyModeChange` reproducing `handleBackToLive` exactly |
| `apps/web/test/view-mode.test.ts` | Created | RED→GREEN coverage for `applyModeChange` |
| `apps/web/src/lib/row-metrics.ts` | Created | `ROW_HEIGHT = 28`, `ROW_HEIGHT_CLASS = 'h-7'`, `COLUMN_CLASSES` |
| `apps/web/src/lib/level-styles.ts` | Modified | Added `CHART_CHROME` (axis/grid/tooltip `var(--color-*)` strings) |
| `apps/web/test/level-styles.test.ts` | Created | RED→GREEN coverage for all `LEVEL_*_CLASSES` maps, `CHART_CHROME`, and row-metrics constants |
| `apps/web/src/lib/connection-styles.ts` | Created | `STATUS_DOT_CLASSES`/`STATUS_LABELS` moved out of `ConnectionBanner`, shared with `Sidebar` |
| `apps/web/src/components/icons.tsx` | Created | 9 hand-authored geometric icons sharing `IconProps` |
| `apps/web/src/components/Sidebar.tsx` | Created | 288px (`w-72`) shell: title, two mode buttons (`aria-pressed`), status dot + endpoint card |
| `apps/web/test/Sidebar.test.tsx` | Created | RED→GREEN component coverage: accessible names, `aria-pressed`, click wiring |
| `apps/web/src/components/ConnectionBanner.tsx` | Modified | Consumes `connection-styles.ts`; header pill only, no full-width banner |
| `apps/web/src/App.tsx` | Modified | Shell layout (`h-screen overflow-hidden`, `Sidebar` + 64px bar + non-scrolling content column); `handleModeChange` via `applyModeChange`; stopped passing `mode`/`onBackToLive` to `FilterBar` |
| `apps/web/src/index.css` | Modified | `@theme` → `@theme static`; verified `--color-outline-variant` present in built CSS — no fallback needed |

## Deviations from Design

- **Top-bar page title**: design.md does not prescribe exact copy for the fused 64px bar. Used a dynamic heading (`Registros en vivo` / `Registros historicos`) reflecting the current mode. Not a spec violation — no requirement or non-goal governs this text.
- **`connection-styles.ts` colour choice**: design leaves the exact token-to-status mapping open. Chose `bg-secondary` (connected), `bg-tertiary` (connecting/reconnecting), `bg-error` (disconnected) — all existing `@theme` tokens, consistent with the surface ladder and Design-Token Discipline requirement.
- **Dropped `animate-pulse` for `connecting`/`reconnecting`**: the original `ConnectionBanner` pulsed the dot for both states. The spec's literal scenario only requires no-pulse for `disconnected` ("Disconnected renders discreetly ... no pulse or banner"), but per the broader "Discreet Degraded States" requirement ("none MAY get a prominent accent") this batch removed pulsing from all four states for consistency. Flagging explicitly in case `sdd-verify` reads the `connecting` pulse removal as over-reach beyond the literal scenario text.

## Issues Found

None blocking. Note for the record: `RateChart.tsx`, `AlertsPanel.tsx`, `ExportButton.tsx`, `TokenGate.tsx`, and the inline chart wrapper `<div>` in `App.tsx` still use pre-restyle Tailwind default (`slate-*`) classes — intentional, those are Phase 2/3 scope per design's File Changes table and were left untouched this batch.

## Remaining Tasks

Phase 2 (Stream Surfaces, PR2) and Phase 3 (Chart & Side Panels, PR3) — not started, out of scope for this run per explicit PR1 boundary.

- [ ] 2.1–2.10 (Phase 2)
- [ ] 3.1–3.7 (Phase 3)

## Workload / PR Boundary

- Mode: chained PR slice (`auto-chain`, `stacked-to-main`)
- Current work unit: Unit 1 — "Shell + tokens" (Suggested Work Units table, tasks.md)
- Boundary: starts at the blocking-precondition compile fix (`TS2724`), ends at task 1.18's full green verification. PR1 targets `main`.
- Estimated review budget impact: **≈527 authored changed lines** (additions+deletions, counted per-file via `git diff --numstat`/`wc -l`, excluding the generated `package-lock.json` and the pre-existing uncommitted redesign work this batch did not author — `main.tsx`, `index.html`, `apps/web/package.json` fontsource deps, `.gitignore`, and the portions of `index.css`/`level-styles.ts` already rewritten before this session started). Forecast was ~560; actual is under both the forecast and the ~700 explicit-flag threshold, well inside the 800-line session budget.

## Status

18/18 Phase 1 tasks complete. Ready for verify.
