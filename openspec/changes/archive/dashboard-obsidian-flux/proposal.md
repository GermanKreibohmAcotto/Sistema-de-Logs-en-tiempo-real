# Proposal: Obsidian Flux Dashboard Restyle

## Intent

Operators scan this dashboard during incidents, where a missed FATAL costs downtime. Today it wears default slate greys whose level colours barely separate, and the active mode hides in a small badge. Obsidian Flux layers tonal dark surfaces so vibrant level accents carry the urgency, and promotes the two real modes into a persistent sidebar. Purely visual — no new features, no API change, no behaviour change.

## Scope

### In Scope

- `Sidebar.tsx` (new, 288px): "En vivo" / "Histórico" nav + connection card. Relocates the mode badge and "Volver a en vivo" out of `FilterBar` — a move, not a feature.
- `icons.tsx` (new): hand-written inline SVG.
- Restyle `App.tsx`, `FilterBar`, `RateChart` + panel wrapper, `LogRow`, `LogConsole`, `HistoricalLogList`, `AlertsPanel`, `ExportButton`, `ConnectionBanner`, `TokenGate`.
- Already in the working tree, part of this change: `index.css` `@theme` tokens, `level-styles.ts`, `main.tsx` fonts, `index.html`, fontsource deps.

### Out of Scope

- Unbacked design chrome: notifications bell, avatar, 1H/24H/7D selector, "Wrap text", query-syntax search, "Live Tail".
- The "LogNexus" brand name.
- Any external runtime call (Google Fonts CDN) — self-hosted tool, isolated networks.
- API, WS protocol, `packages/shared` Zod contracts: **not touched**.
- Light theme, responsive layout, routing.

## Capabilities

### New Capabilities

- `dashboard-shell`: sidebar mode navigation, connection-status card, panel layering, level accent tokens, and the render invariants the restyle must preserve.

### Modified Capabilities

- None — `openspec/specs/` holds no specs yet.

## Approach

- Token-first: every colour resolves through `@theme` in `index.css`; no literals in components.
- Depth from tonal layering + 1px `outline-variant` borders, never heavy shadows.
- Glass and animation only on static chrome, never on the repainting log viewport.
- Contract invariants: ring buffer outside React via `useSyncExternalStore`; virtualized console (~40 DOM rows); bottom-anchored auto-scroll detaching on scroll-up; `ROW_HEIGHT` = virtualizer `estimateSize` = rendered height.
- Recorded deviation: FATAL chart colour `#ff5449`. Obsidian Flux reuses ERROR's salmon, leaving stacked areas indistinguishable.

## Affected Areas

| Area                                               | Impact   | Description                         |
| -------------------------------------------------- | -------- | ----------------------------------- |
| `apps/web/src/components/Sidebar.tsx`, `icons.tsx` | New      | Mode nav + connection card; SVG set |
| `apps/web/src/App.tsx`                             | Modified | Sidebar shell layout                |
| `apps/web/src/components/*.tsx`                    | Modified | 9 components restyled               |
| `apps/web/src/index.css`, `lib/level-styles.ts`    | Modified | Tokens (already applied)            |
| `packages/shared`, `apps/api`                      | None     | Untouched                           |

## Risks

| Risk                                                                                                                                                                       | Likelihood | Mitigation                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wide shallow diff over ~13 files with zero UI coverage: `npm test`, `typecheck`, `lint` prove compilation and store logic only, so layout and state regressions pass green | High       | Minimal component-test net (root has `vitest` + `jsdom`; needs `@testing-library/react`) for sidebar mode switching and console virtualization/auto-scroll, plus a per-state manual checklist in `tasks.md` |
| Restyle breaks virtualization, row height, or scroll anchoring                                                                                                             | Med        | Encode the four invariants as spec requirements; assert DOM row count against a 10k buffer                                                                                                                  |
| Sidebar relocation silently drops a `FilterBar` control                                                                                                                    | Med        | Diff `FilterBar` props before/after; no handler may be orphaned                                                                                                                                             |
| 800-line review budget exceeded                                                                                                                                            | Med        | `sdd-tasks` slices chained PRs: shell first, then components                                                                                                                                                |

## Rollback Plan

Confined to `apps/web` plus two `package.json` deps. `git revert` the commits, or pre-commit `git checkout -- apps/web` then `npm install`. No migration, no persisted state, no contract change, so `apps/api` and `packages/shared` need no coordinated rollback.

## Dependencies

- Fontsource Inter + JetBrains Mono (installed).
- `@testing-library/react` — new devDependency, pending question 3 below.

## Success Criteria

- [ ] `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` pass.
- [ ] Sidebar switches modes; "En vivo" clears `from`/`to` exactly as `handleBackToLive` does today.
- [ ] ~40 DOM rows at a 10k buffer; auto-scroll still detaches on scroll-up.
- [ ] Every `FilterBar` control still reachable after the relocation.
- [ ] Five levels distinct in rows and stacked chart; zero external requests on load.

## Open Questions

Pending user answers (see the proposal question round in the phase result): log row density (28px vs the design's 24px), narrow-viewport behaviour for the alerts aside, component-test scope, degraded-state prominence, and the motion/glass budget over the streaming region.
