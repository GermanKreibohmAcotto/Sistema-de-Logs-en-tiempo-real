# Dashboard Shell Specification

## Purpose

Operator-facing shell: sidebar nav, connection status, level accents, design tokens, and render invariants Obsidian Flux must preserve. No API/WS/`packages/shared` change.

## Requirements

### Requirement: Sidebar Mode Navigation

The sidebar MUST expose exactly two nav entries, "En vivo" and "Histórico", mapped to `live`/`historical` mode.

#### Scenario: En vivo clears the date range

- GIVEN mode `historical` with `from`/`to` set
- WHEN operator selects "En vivo"
- THEN from/to clear, mode becomes `live` (matches `handleBackToLive`)

### Requirement: FilterBar Control Preservation

Relocating the mode badge and "Volver a en vivo" to the sidebar MUST NOT orphan any `FilterBar` control.

#### Scenario: Remaining controls stay wired

- GIVEN the restyled dashboard
- WHEN `FilterBar` is inspected
- THEN level toggles, services, search, and from/to inputs remain present and wired

### Requirement: Connection Status Reflects Real WsClient State

The connection card MUST render exactly the `ConnectionStatus` `WsClient` emits, never a synthetic state.

#### Scenario: Status change propagates

- GIVEN `WsClient` emits `connected` → `disconnected`
- WHEN the card re-renders
- THEN it shows `disconnected`

### Requirement: Discreet Degraded States

Empty buffer, disconnected/reconnecting, paused-with-N-missed, and `droppedCount > 0` SHALL stay minimal/text-only; none MAY get a prominent accent. Accepted tradeoff: a discreet "disconnected" may be missed mid-incident.

#### Scenario: Disconnected renders discreetly

- GIVEN status is `disconnected`
- WHEN the card renders
- THEN it shows small text only, no pulse or banner

### Requirement: Level Accent Treatment

All five levels MUST render with a distinct accent in log rows and the stacked chart via `LEVEL_*_CLASSES`/`LEVEL_CHART_COLORS`.

#### Scenario: FATAL stays distinct from ERROR in rows

- GIVEN a FATAL row and an ERROR row are visible
- WHEN scanned
- THEN FATAL renders inverted/solid, ERROR does not — distinct despite a shared hue

### Requirement: Design-Token Discipline

Every color MUST resolve through an `@theme` token in `index.css`; no literals except `LEVEL_CHART_COLORS`.

#### Scenario: No literal colors

- GIVEN a restyled component
- WHEN its classes are inspected
- THEN every color utility maps to a `--color-*` token

### Requirement: Zero External Network Requests

The dashboard MUST NOT request any third-party origin on load; fonts self-hosted, icons inline SVG.

#### Scenario: Cold load, no internet route

- GIVEN an isolated network
- WHEN the dashboard loads
- THEN fonts/icons render, zero external requests

### Requirement: Live Console Render Invariants

The restyle MUST preserve: ring buffer outside React state via `useSyncExternalStore`; ~40 mounted DOM rows regardless of buffer size (cap 10,000); bottom-pinned auto-scroll that detaches past 48px, showing "Ir al final (N nuevos)"; and `ROW_HEIGHT` = `estimateSize` = rendered height (28) in `LogConsole.tsx`/`HistoricalLogList.tsx`.

#### Scenario: High ingest does not re-render per frame

- GIVEN WS frames arrive faster than one per animation frame
- WHEN `LogConsole` is mounted
- THEN it re-renders once per frame, not per message

#### Scenario: 10,000-item buffer stays bounded

- GIVEN the buffer holds 10,000 events
- WHEN `LogConsole` renders
- THEN mounted rows stay within the overscan bound, not 10,000

#### Scenario: Scroll up detaches

- GIVEN pinned with logs streaming
- WHEN operator scrolls up past the threshold
- THEN auto-scroll stops, "Ir al final" shows the count since detach

#### Scenario: Rendered height matches estimate

- GIVEN a rendered log row
- WHEN its height is measured
- THEN it equals 28px, matching `estimateSize`

### Requirement: Static Chrome Only for Glass and Motion

`backdrop-filter` and animation MUST be confined to static chrome (sidebar, status dot, overlays, panels), never the log viewport/rows.

#### Scenario: Log rows have no backdrop-filter or pulse

- GIVEN continuous high-ingest repaint
- WHEN a row's computed style is inspected
- THEN no `backdrop-filter`, no pulse animation

### Requirement: Component Test Coverage for Highest-Risk Behavior

The system MUST add `@testing-library/react` tests for: sidebar mode switching, virtualized row count on a 10k-scale buffer, and auto-scroll detach on scroll-up.

#### Scenario: Tests exist and pass

- GIVEN the restyle is complete
- WHEN `npm test` runs
- THEN all three test areas are present and passing

## Non-Goals

- Responsive breakpoints for the alerts aside; wide screens only.
- API, WS protocol, or `packages/shared` Zod contract changes.
- Notifications bell, avatar, 1H/24H/7D selector, "Wrap text", query-syntax search, "Live Tail", "LogNexus".
- Light theme, routing, responsive layout.
- 24px row density — 28px stays.
