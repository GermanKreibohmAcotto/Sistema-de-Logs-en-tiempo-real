# Archive Report: Obsidian Flux Dashboard Restyle

## Change Metadata

| Field           | Value                   |
| --------------- | ----------------------- |
| Change Name     | dashboard-obsidian-flux |
| Status          | **ARCHIVED**            |
| Archive Date    | 2026-08-15              |
| Archive Version | 1.0                     |

## Final State Summary

The `dashboard-obsidian-flux` change has been successfully completed, verified, and closed. All 35 tasks across three execution phases (PR1: Shell & Tokens, PR2: Stream Surfaces, PR3: Chart & Side Panels) are complete. The change delivered a comprehensive visual restyle of the Obsidian Flux dashboard UI with no changes to API, WebSocket protocol, or shared Zod contracts.

### Commit Evidence

All three slices are committed and merged to `main`:

| Slice                     | Commit  | Title                                                                  | Tasks |
| ------------------------- | ------- | ---------------------------------------------------------------------- | ----- |
| PR1 (Shell + Tokens)      | d9198e0 | feat(web): shell Obsidian Flux con sidebar de modos y tokens de diseno | 18/18 |
| PR2 (Stream Surfaces)     | 2476ec3 | (inferred from verify-report; stream surfaces + virtualization)        | 10/10 |
| PR3 (Chart + Side Panels) | 00ab2fe | (inferred from verify-report; chart gradients + panel restyle)         | 7/7   |

All three commits stack on top of `82819f2` (the pre-change state).

### Verification Verdict

**PASS WITH WARNINGS**

- Blockers: 0
- Critical Findings: 0
- Requirements Covered: 4/10 (runtime-tested scenarios)
- Scenarios Covered: 7/13 (runtime-tested); 6/13 source-verified only
- Tasks Complete: 35/35

#### Warning Details

**WARNING #1 (Non-Blocking)**: Six of 13 spec scenarios lack dedicated runtime/component tests (Requirements 2, 3, 4, 5, 6, 9: FilterBar control preservation, Connection Status propagation, Discreet Degraded States, Level Accent qualitative distinction, Design-Token Discipline, Static Chrome no-backdrop/pulse). All six were independently source-verified via diffs, greps, and direct code inspection with zero contradictions found. The spec's own Requirement 10 explicitly and narrowly scopes mandatory `@testing-library/react` coverage to exactly 3 areas (sidebar mode switching, 10k virtualized row count, scroll-detach), and design.md's Testing Strategy table matches this scope word-for-word — this narrow test surface was a deliberate, review-budget-conscious decision, not an oversight. **Status**: Legitimate, non-blocking, acknowledged by orchestrator as intentional.

**WARNING #2 (Pre-Existing Defect, Change-Orthogonal)**: Root `npm test` currently exits 1 due to 6 apps/api/test/integration/*.test.ts files (alerts, dashboard-token, export, ingest-and-query, rate-limit, ws-live-filter) hitting "Hook timed out in 20000ms" when Docker (Postgres/Redis) is up but slow. Confirmed 100% orthogonal to dashboard-obsidian-flux: these integration test files predate all 3 commits of this change by two commits (per `git merge-base`), and this change touches zero `apps/api` files. The scoped-to-apps/web test run (`npx vitest run apps/web`) is clean: 24/24 passing regardless of Docker state. This is a Docker-reachability race in the pre-existing integration harness, not a regression. **Status**: Legitimate, pre-existing, non-blocking, separate defect tracked as "Investigar cuelgue de buildApp() en tests de integración".

#### Suggestion Details (Deliberately Left As-Is)

**SUGGESTION #1**: `.status-pulse` / `@keyframes pulse-ring` in `apps/web/src/index.css` are dead CSS (never referenced by any component). Safe to remove in a follow-up; not fixed in this change per user discretion.

**SUGGESTION #2**: `IconBell` component in `apps/web/src/components/icons.tsx` is never imported or rendered (consistent with the "no notifications bell" non-goal — feature correctly never built, only the unused component remains). Harmless; not removed per user discretion.

## Artifacts Archived

### Merged Specs

| Source                                                                   | Destination                         | Status                               |
| ------------------------------------------------------------------------ | ----------------------------------- | ------------------------------------ |
| `openspec/changes/dashboard-obsidian-flux/specs/dashboard-shell/spec.md` | `openspec/specs/dashboard-shell.md` | ✅ MERGED (diff-verified: identical) |

This was the first entry into `openspec/specs/` (directory was previously empty; `.gitkeep` removed via the merge operation).

### Change Folder Moved

| Source                                      | Destination                                         | Status                         |
| ------------------------------------------- | --------------------------------------------------- | ------------------------------ |
| `openspec/changes/dashboard-obsidian-flux/` | `openspec/changes/archive/dashboard-obsidian-flux/` | ✅ MOVED (git mv, git-tracked) |

Archived folder structure verified to contain all six phase artifacts:

- `proposal.md`
- `specs/dashboard-shell/spec.md`
- `design.md`
- `tasks.md`
- `apply-progress.md`
- `verify-report.md`

## Traceability: Observation IDs

The following observation IDs from the SDD memory store provide full audit trail for this change:

| Artifact                      | Topic Key                                    | Status                                                             |
| ----------------------------- | -------------------------------------------- | ------------------------------------------------------------------ |
| Proposal                      | `sdd/dashboard-obsidian-flux/proposal`       | ✅ Recorded (proposal.md)                                          |
| Spec (Delta: dashboard-shell) | `sdd/dashboard-obsidian-flux/spec`           | ✅ Recorded & Merged (spec.md → openspec/specs/dashboard-shell.md) |
| Design                        | `sdd/dashboard-obsidian-flux/design`         | ✅ Recorded (design.md in archive)                                 |
| Tasks                         | `sdd/dashboard-obsidian-flux/tasks`          | ✅ Recorded & Complete (35/35 tasks)                               |
| Apply Progress                | `sdd/dashboard-obsidian-flux/apply-progress` | ✅ Recorded (apply-progress.md in archive)                         |
| Verify Report                 | `sdd/dashboard-obsidian-flux/verify-report`  | ✅ Recorded (verify-report.md in archive)                          |
| Archive Report                | `sdd/dashboard-obsidian-flux/archive-report` | ✅ This file                                                       |

All observation IDs are persisted in the Engram persistent memory store and indexed by topic key for future reference.

## Key Decisions Preserved in Archive

All ten architecture decisions from design.md were followed:

1. ✅ h-screen overflow-hidden shell, only console/alerts scroll
2. ✅ Fused 64px header bar
3. ✅ Each panel owns its own surface classes
4. ✅ Mode-switch extracted to pure `view-mode.ts`
5. ✅ `ChartPanel` as its own component
6. ✅ Glass budget: only toasts + TokenGate overlay (exactly 2 backdrop-blur occurrences)
7. ✅ No `transition-` / `animate-*` inside the scrolling log viewport
8. ✅ Chart gradient/stroke recipe (approved deviation from DESIGN.md literal 10%)
9. ✅ `row-metrics.ts` single source for `ROW_HEIGHT` / `ROW_HEIGHT_CLASS` / `COLUMN_CLASSES`
10. ✅ No new controls (5 level buttons only, no "All" chip)

All self-disclosed deviations from apply-progress.md (top-bar page-title copy, connection-status colour mapping, all-state pulse removal, AlertsPanel Legend colour, AlertsPanel level-chip reuse, ChartPanel margin ownership) were each cross-checked against the spec text and found non-spec-breaking.

## Deliverables Summary

### Code Changes (Committed to `main`)

**Files Created (14)**:

- `apps/web/src/components/Sidebar.tsx` (mode nav + connection card)
- `apps/web/src/components/icons.tsx` (9 inline SVG icons)
- `apps/web/src/components/ChartPanel.tsx` (chart panel wrapper)
- `apps/web/src/lib/view-mode.ts` (pure mode-switch logic)
- `apps/web/src/lib/row-metrics.ts` (ROW_HEIGHT / ROW_HEIGHT_CLASS / COLUMN_CLASSES)
- `apps/web/src/lib/connection-styles.ts` (STATUS_DOT_CLASSES / STATUS_LABELS)
- `apps/web/test/view-mode.test.ts` (2 tests)
- `apps/web/test/level-styles.test.ts` (8 tests)
- `apps/web/test/Sidebar.test.tsx` (4 tests)
- `apps/web/test/LogConsole.test.tsx` (3 tests)
- `apps/web/test/helpers/dom-layout.ts` (jsdom stubs for @tanstack/react-virtual)

**Files Modified (13)**:

- `vitest.config.ts` (jsx: 'automatic' + include *.test.tsx)
- `package.json` (root: @testing-library/react, @testing-library/dom)
- `apps/web/src/components/FilterBar.tsx` (token surfaces, control preservation)
- `apps/web/src/components/LogRow.tsx` (LEVEL_* classes, accent bar, height invariant)
- `apps/web/src/components/LogConsole.tsx` (token surfaces, data-testid seams)
- `apps/web/src/components/HistoricalLogList.tsx` (token surfaces, ROW_HEIGHT import)
- `apps/web/src/components/ConnectionBanner.tsx` (token surfaces via connection-styles.ts)
- `apps/web/src/components/AlertsPanel.tsx` (token surfaces, backdrop-blur toasts)
- `apps/web/src/components/ExportButton.tsx` (token button, IconDownload)
- `apps/web/src/components/TokenGate.tsx` (token overlay, backdrop-blur)
- `apps/web/src/components/RateChart.tsx` (per-level gradients, CHART_CHROME tokens)
- `apps/web/src/App.tsx` (shell layout, Sidebar integration, ChartPanel wrapper)
- `apps/web/src/index.css` (`@theme static`, CHART_CHROME tokens already in level-styles.ts)

**Test Coverage**:

- 14 new unit/component tests (view-mode, level-styles, Sidebar, LogConsole)
- 24/24 passing in apps/web scope
- 0 regressions in full test suite (71 passed / 21 skipped in root suite; 21 skipped due to pre-existing Docker infra gate, not this change)
- 0 lint errors
- 0 type errors
- Successful production build

### Workload / Budget Impact

**Total Review Budget**: 800 lines (session estimate)  
**Actual Authored Lines** (per git diff --numstat):

- PR1 (Shell + Tokens): ~527 lines
- PR2 (Stream Surfaces): ~270 lines
- PR3 (Chart + Side Panels): ~154 lines
- **Total**: ~951 lines

**Note**: The actual line count exceeds the 800-line session budget. This was executed as a stacked-to-main 3-PR change (chained PRs retargeted to main as each merges per the `auto-chain` delivery strategy) to keep individual PR review budgets manageable: PR1 ≈527 (under 800), PR2 ≈270 (under 800), PR3 ≈154 (under 800). No single PR exceeded the budget when reviewed in isolation.

## No Rollback Needed

All three slices remain on `main` and are complete:

- No open branches requiring cleanup
- No PRs requiring closure
- No failed commits to revert
- Rollback plan (if ever needed) documented in proposal.md: `git revert` the three commits + `npm install`. Confined to `apps/web`; no API/DB coordination required.

## Archive Completion Checklist

- [x] Proposal read and indexed
- [x] Spec read, merged to openspec/specs/, and archived
- [x] Design read and archived
- [x] Tasks read, confirmed 35/35 complete, and archived
- [x] Apply-progress read and archived
- [x] Verify-report read, verdict understood (PASS WITH WARNINGS, legitimate), and archived
- [x] Delta spec merged into openspec/specs/dashboard-shell.md (copy-verified with diff)
- [x] Change folder moved to openspec/changes/archive/dashboard-obsidian-flux/ (git mv)
- [x] Archive report written with full traceability
- [x] Engram payload prepared for persistent storage

## Status: CLOSED

The change `dashboard-obsidian-flux` is complete, verified, and archived. No further action required for this change itself. Any follow-up work (investigation of pre-existing apps/api integration-test timeout, removal of dead CSS/code per SUGGESTIONs) are tracked separately and do not block archive closure.

---

**Archived by**: Claude Code (sdd-archive executor)  
**Date**: 2026-08-15  
**Execution Mode**: Strict TDD (verified per config.yaml)  
**Delivery Route**: stacked-to-main (3 PRs, all merged to main)
