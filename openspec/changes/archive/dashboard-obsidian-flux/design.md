# Design: Obsidian Flux Dashboard Restyle

## Technical Approach

A presentational-only restyle of `apps/web`. Three token modules in `src/lib` own every colour and geometry constant; components consume class maps and never inline a literal. `App.tsx` becomes a pure geometry shell (sidebar + one 64px bar + a non-scrolling content column); each panel component owns its own surface classes. No API, WS, or `packages/shared` contract is touched.

**Blocking precondition**: the tree does not compile today. `level-styles.ts` was already rewritten and dropped `LEVEL_BADGE_CLASSES`, which `FilterBar.tsx:2` and `LogRow.tsx:2` still import. `npm run typecheck` is red before a single new line is written. Work unit 1 MUST restore green.

## Architecture Decisions

| #   | Decision          | Chose                                                                                             | Rejected                                                                                       | Rationale                                                                                                                                                                                                                                               |
| --- | ----------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Shell layout      | Outer `h-screen overflow-hidden`; only the console and alerts panel scroll                        | Page-level scroll; sticky filter bar                                                           | The virtualizer needs a scroll container of definite height. Nested scrolling breaks `scrollToIndex` anchoring.                                                                                                                                         |
| 2   | Header rows       | Fuse the mockup's fixed header + page-title row into one 64px bar                                 | Two rows as drawn (128px of chrome)                                                            | Vertical space is the scarce resource in a log tool; the app fits one screen with no page scroll. Losing 64px of stream is a real cost, the second row carried no unbacked-free content.                                                                |
| 3   | Panel surfaces    | Each panel component owns `rounded-xl border bg-*`; `App` owns only `flex-[3]`, `min-h-0`, gaps   | `App` owns all surfaces; a generic `<Panel>` wrapper                                           | Self-contained components render correctly in isolation, which is what makes component tests cheap. A generic `Panel` would have to proxy three different scroll semantics through props.                                                               |
| 4   | Mode-switch state | State stays in `App`'s three `useState`s; the transition rule extracts to pure `lib/view-mode.ts` | Full `useDashboardFilters` hook; inline handler with no seam                                   | The hook moves ~35 lines of working state code in a "no behaviour change" restyle. A 6-line pure function makes the settled "En vivo clears from/to" invariant machine-checkable at zero DOM cost.                                                      |
| 5   | Chart panel       | Own component `ChartPanel.tsx`                                                                    | Inline in `App.tsx`                                                                            | It owns a surface, a heading and a fixed height — that is panel presentation, not shell geometry. Keeps decision 3 consistent.                                                                                                                          |
| 6   | Glass budget      | `backdrop-blur` only on alert toasts and the `TokenGate` overlay                                  | Blur on header, filter bar, chart, alerts panel (as in `code.html`)                            | Settled decision 5 permits panel surfaces, but with a non-scrolling outer container nothing moves behind those panels — it is GPU cost for zero payoff. Toasts genuinely float over content.                                                            |
| 7   | Viewport motion   | No `transition`, no `animate-*` inside the scrolling log viewport; instant hover tint             | `code.html`'s `transition-colors` rows, `animate-[fadeIn]` entries, `animate-pulse` ERROR text | Settled decision 5. The viewport repaints continuously under ingest.                                                                                                                                                                                    |
| 8   | Chart area fill   | Per-level `<linearGradient>` at `0.45 → 0.05`, plus a full-opacity 1.5px stroke                   | DESIGN.md's literal 10% gradient                                                               | DESIGN.md's 10% figure targets a single line chart. Five _stacked_ areas at 10% are mutually indistinguishable — the exact failure the FATAL colour deviation already exists to avoid. The stroke carries the boundary; the gradient carries the depth. |
| 9   | Row constants     | `lib/row-metrics.ts` exports `ROW_HEIGHT`, `ROW_HEIGHT_CLASS`, `COLUMN_CLASSES`                   | Duplicated `const ROW_HEIGHT = 28` per file (today's state)                                    | Settled decision 1 makes 28px load-bearing across `estimateSize`, the wrapper height, and the rendered row. It has three consumers (`LogConsole`, `HistoricalLogList`, `LogRow`) plus two new column-header rows. One module, one assertion.            |
| 10  | No new controls   | Five level buttons only; no "All" chip, no `animate-pulse` FATAL chip, no "Streaming" spinner     | `code.html`'s segmented control with `All`                                                     | `levels: []` already means all-active and is already reachable. A shortcut button is a new control in a change that promises none. Symmetric with the "no dropped control" risk.                                                                        |

## Tailwind v4 `@theme` token usage

`apps/web/src/index.css` is the sole source of colour. Tailwind v4 takes its theme from the `@theme` block there — there is no `tailwind.config.js`.

- **Change**: `@theme` → `@theme static`, so every declared `--color-*` custom property is emitted to `:root` even if no utility class references it. `RateChart` reads axis/grid/tooltip colours as `var(--color-*)` strings and would otherwise depend on an unrelated component happening to use the matching utility.
- **Verify in GREEN**: `npm run build -w @logs/web`, then confirm `--color-outline-variant` appears in `apps/web/dist/assets/*.css`.
- **Fallback if `@theme static` is unsupported by tailwindcss ^4.3.3**: revert to plain `@theme`. All four chrome tokens (`outline-variant`, `on-surface-variant`, `surface-container-high`, `on-surface`) are used as utilities by the restyled components, so emission still holds; record the fragility instead of hiding it.
- **Sanctioned literal exception**: `LEVEL_CHART_COLORS` in `level-styles.ts` keeps hex values. Recharts series need concrete colours for `<stop stop-color>`, and FATAL's `#ff5449` is a deliberate extension with no `@theme` token. This is the only module allowed to hold a colour literal.

### Surface ladder

| Region                   | Token                       |
| ------------------------ | --------------------------- |
| App shell                | `bg-background`             |
| Sidebar, log viewport    | `bg-surface-lowest`         |
| Filter bar, alerts panel | `bg-surface-low`            |
| Chart panel              | `bg-surface-container`      |
| Inputs                   | `bg-surface-highest`        |
| Panel borders            | `border-outline-variant/40` |

`code.html` puts inputs _lighter_ than their panel; DESIGN.md prose says darker (`#080A0E`). Conflict resolved toward `code.html` — the concrete recipe reads better against a dark panel.

## Data Flow

### Live ingest → painted row (the path the restyle must not break)

```
WsClient          LogStore              LogConsole              Virtualizer        LogRow
   │ onLogs(items)   │                      │                       │                │
   ├────────────────►│ push() → ring(10k)   │                       │                │
   │                 ├─ rAF coalesce ───────┤                       │                │
   │                 ├─ notify() ──────────►│ useSyncExternalStore  │                │
   │                 │                      ├ count=items.length ──►│                │
   │                 │                      ├ estimateSize=ROW_HEIGHT                │
   │                 │                      │◄── ~60 virtual items ─┤                │
   │                 │                      ├ wrapper style.height = virtualRow.size ┤
   │                 │                      │                       │  h-full, no py │
   │                 │                      ├ if pinnedToBottom: scrollToIndex(last)  │
```

Invariant chain: `ROW_HEIGHT` (28) = `estimateSize()` = wrapper inline height = rendered row height, because `LogRow` uses `ROW_HEIGHT_CLASS`-compatible `h-full` with `overflow-hidden` and **no vertical padding**.

### Sidebar mode switch

```
Sidebar                 App                              WsClient / api
  │ click "En vivo"      │
  ├ onModeChange('live')►│
  │                      ├ applyModeChange('live', {from,to})
  │                      │    → { mode:'live', range:{ from:'', to:'' } }
  │                      ├ setFrom('') setTo('') setMode('live')
  │                      ├ filters recomputed → from/to undefined
  │                      ├──────────────────────────────► ws.subscribe(filters)
  │                      └ renders <LogConsole/>
  │ click "Histórico"    │
  ├ onModeChange('hist')►├ range preserved, mode='historical'
  │                      ├──────────────────────────────► GET /v1/logs, /v1/stats/timeseries
```

`applyModeChange('live', …)` reproduces today's `handleBackToLive` exactly. The existing `useEffect([from, to])` that forces historical mode is unchanged and no-ops on the cleared range. Selecting "Histórico" with an empty range is **not** a new state: clearing the dates today leaves `mode === 'historical'` because that effect only ever sets, never unsets.

## File Changes

| File                                             | Action | Description                                                                                         |
| ------------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------- |
| `apps/web/src/lib/row-metrics.ts`                | Create | `ROW_HEIGHT = 28`, `ROW_HEIGHT_CLASS = 'h-7'`, `COLUMN_CLASSES` (time/level/service/message widths) |
| `apps/web/src/lib/view-mode.ts`                  | Create | `ViewMode`, `TimeRange`, pure `applyModeChange`                                                     |
| `apps/web/src/lib/connection-styles.ts`          | Create | `STATUS_DOT_CLASSES`, `STATUS_LABELS` moved out of `ConnectionBanner` so `Sidebar` shares them      |
| `apps/web/src/components/icons.tsx`              | Create | 9 hand-authored icons (below)                                                                       |
| `apps/web/src/components/Sidebar.tsx`            | Create | 288px shell: title, two mode buttons, endpoint card                                                 |
| `apps/web/src/components/ChartPanel.tsx`         | Create | Surface + heading around `RateChart`, `h-56 shrink-0`                                               |
| `apps/web/src/App.tsx`                           | Modify | Shell layout, `handleModeChange`, drops `mode`/`onBackToLive` from `FilterBar`                      |
| `apps/web/src/components/FilterBar.tsx`          | Modify | **Fixes broken import**; segmented level control; loses mode badge + "Volver a en vivo"             |
| `apps/web/src/components/LogRow.tsx`             | Modify | **Fixes broken import**; `LEVEL_TEXT/ROW/ACCENT_CLASSES`; `COLUMN_CLASSES`                          |
| `apps/web/src/components/LogConsole.tsx`         | Modify | Panel surface, column header, toolbar restyle, `data-testid` seams, imports `ROW_HEIGHT`            |
| `apps/web/src/components/HistoricalLogList.tsx`  | Modify | Same panel + column header; imports `ROW_HEIGHT`                                                    |
| `apps/web/src/components/RateChart.tsx`          | Modify | Token chrome, per-level gradients                                                                   |
| `apps/web/src/components/AlertsPanel.tsx`        | Modify | Panel surface, form/rule/history restyle, glass toasts                                              |
| `apps/web/src/components/ExportButton.tsx`       | Modify | Token button + `IconDownload`                                                                       |
| `apps/web/src/components/ConnectionBanner.tsx`   | Modify | Header pill; consumes `connection-styles.ts`                                                        |
| `apps/web/src/components/TokenGate.tsx`          | Modify | Token card, glass overlay                                                                           |
| `apps/web/src/index.css`                         | Modify | `@theme` → `@theme static`                                                                          |
| `apps/web/src/lib/level-styles.ts`               | Modify | Add `CHART_CHROME` (`var(--color-*)` strings for axis/grid/tooltip)                                 |
| `vitest.config.ts`                               | Modify | `include` accepts `*.test.tsx`; `esbuild: { jsx: 'automatic' }`                                     |
| `package.json` (root)                            | Modify | `@testing-library/react@^16`, `@testing-library/dom@^10` devDeps                                    |
| `apps/web/test/helpers/dom-layout.ts`            | Create | jsdom geometry stubs                                                                                |
| `apps/web/test/{view-mode,level-styles}.test.ts` | Create | Pure token/rule tests                                                                               |
| `apps/web/test/{Sidebar,LogConsole}.test.tsx`    | Create | Component tests                                                                                     |

## Interfaces / Contracts

```ts
// lib/view-mode.ts — the settled "En vivo clears the range" rule, unit-testable.
export type ViewMode = 'live' | 'historical';
export interface TimeRange {
  from: string;
  to: string;
}
export function applyModeChange(
  next: ViewMode,
  range: TimeRange,
): { mode: ViewMode; range: TimeRange } {
  return next === 'live'
    ? { mode: 'live', range: { from: '', to: '' } }
    : { mode: 'historical', range };
}

// components/Sidebar.tsx — pure presentational, no hooks, no fetching.
export interface SidebarProps {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  status: ConnectionStatus; // dot colour only
  endpoint: string; // WS_URL host, monospace card
}

// components/icons.tsx — one shared contract for all 9.
export interface IconProps {
  size?: number;
  className?: string;
} // size defaults to 16
```

Every icon renders `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `strokeWidth={1.75}`, round caps/joins, `aria-hidden="true"`, `focusable="false"`. Colour therefore comes from the parent's `text-*` class — icons hold no literal. `IconPause`/`IconPlay` are the two exceptions, using `fill="currentColor"` solid geometry because stroke-only transport glyphs read poorly at 16px.

**The 9**: `IconLive` (3 arcs + dot), `IconHistory` (circle + hands), `IconSearch`, `IconServer` (2 rects + dots), `IconBell`, `IconDownload`, `IconPause`, `IconPlay`, `IconArrowDown`. Hand-authored geometric paths only — no Material Symbols path data, no icon dependency. `IconChart`, `IconTrash` and `IconShield` were cut: each icon is authored geometry, and a text heading or the existing "borrar" label already does the job.

Because every icon is `aria-hidden`, **every icon-only control MUST carry `aria-label`** — which is also what makes the component tests queryable by accessible name.

### Class-map consumption (no colour leaks)

| Map                                    | Consumer                      | Use                                                                              |
| -------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------- |
| `LEVEL_TEXT_CLASSES`                   | `LogRow`                      | Level cell; FATAL inverts to a solid block                                       |
| `LEVEL_ROW_CLASSES`                    | `LogRow`                      | Row tint on the row container                                                    |
| `LEVEL_ACCENT_CLASSES`                 | `LogRow`                      | Left bar, rendered only when the string is non-empty (falsy for DEBUG/INFO/WARN) |
| `LEVEL_CHIP_CLASSES`                   | `FilterBar`                   | Active chip; inactive falls back to `text-on-surface-variant`                    |
| `LEVEL_CHART_COLORS`                   | `RateChart`                   | Stroke + gradient stops                                                          |
| `CHART_CHROME`                         | `RateChart`                   | Grid, axis ticks, tooltip surface                                                |
| `STATUS_DOT_CLASSES` / `STATUS_LABELS` | `ConnectionBanner`, `Sidebar` | Dot + label                                                                      |

## Degraded states (discreet — settled decision 4)

| State                         | Treatment                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| Empty live / empty historical | One line, `text-sm text-on-surface-variant/60`. No illustration, no icon.                |
| Disconnected / reconnecting   | Header pill only: dot colour + label. No full-width banner.                              |
| Paused with missed            | Existing button label `Reanudar (N perdidos)`, `bg-tertiary-container text-on-tertiary`. |
| Dropped by saturation         | Inline `text-tertiary` in the toolbar, as today.                                         |

Constant-height toolbar in every case — no state may shift the viewport.

## Testing Strategy

Strict TDD: RED before each work unit.

| Layer             | What              | Approach                                                                                                                                                                                         |
| ----------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit (node)       | `applyModeChange` | `'live'` clears `from`/`to`; `'historical'` preserves them                                                                                                                                       |
| Unit (node)       | Token maps        | Every `LEVEL_*` map has all 5 `LOG_LEVELS` keys; `CHART_CHROME` values are all `var(--…)`, never `#`; `ROW_HEIGHT === 28` and `ROW_HEIGHT_CLASS === 'h-7'`                                       |
| Component (jsdom) | `Sidebar`         | Two buttons by accessible name; active carries `aria-pressed="true"`; clicking "En vivo" calls `onModeChange('live')`                                                                            |
| Component (jsdom) | `LogConsole`      | 10k-event store → `[data-testid="log-row"]` count `< 120` (ceiling, not a pin on the virtualizer's overscan math); every row wrapper `style.height === '28px'`; scroll-up surfaces "Ir al final" |

**Seams — production code stays clean.** The only production affordances are two `data-testid` attributes (`log-row`, `log-viewport`), the extracted `row-metrics.ts` constants, and `Sidebar` being props-only. Every jsdom gap is closed in `apps/web/test/helpers/dom-layout.ts`: stub `Element.prototype.getBoundingClientRect` (virtual-core calls it synchronously on mount, before any `ResizeObserver`), define `clientHeight`/`scrollHeight` for the auto-scroll math, and no-op `Element.prototype.scrollTo`. jsdom has no `ResizeObserver`, which virtual-core already tolerates via an early return. No test-only prop is added to any component.

**Harness notes**: files use `// @vitest-environment jsdom` (existing convention, `log-store.test.ts:1`), since the root config is `environment: 'node'`. `globals` is false, so RTL's auto-cleanup never registers — each file MUST call `afterEach(cleanup)` explicitly. `@testing-library/dom` is a hard peer of RTL 16 and must be installed alongside it. No `jest-dom`; assert with plain `getAttribute`/`textContent` so `tsconfig.app.json`'s `types: ["vite/client"]` needs no change.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. This change is confined to `apps/web` presentation plus two devDependencies.

## Migration / Rollout

No migration. No persisted state, no contract change. Ship as three chained PRs against the 800-line budget:

1. **Shell + tokens** — the three `lib` modules, `icons.tsx`, `Sidebar`, `App`, `ConnectionBanner`, `index.css`, vitest config + deps, minimal import fixes in `FilterBar`/`LogRow`, the two pure tests and `Sidebar.test.tsx`. **Must end green** — it repairs the pre-existing `LEVEL_BADGE_CLASSES` break.
2. **Stream surfaces** — `LogConsole`, `HistoricalLogList`, `LogRow`, `FilterBar` full restyle, `dom-layout.ts`, `LogConsole.test.tsx`.
3. **Chart + side panels** — `ChartPanel`, `RateChart`, `AlertsPanel`, `ExportButton`, `TokenGate`.

Rollback is `git revert` per slice plus `npm install`; `apps/api` and `packages/shared` need no coordination.

## Open Questions

- [ ] `@theme static` support in tailwindcss ^4.3.3 is assumed, not verified. Fallback is documented above and costs one line.
- [ ] Exact jsdom stub set for `@tanstack/react-virtual` v3 is finalized during RED; the design fixes the _policy_ (all stubs in the test helper, none in production) rather than the stub bodies.
