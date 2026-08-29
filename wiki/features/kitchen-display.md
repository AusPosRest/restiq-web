# Kitchen Display (KDS) - web

## Capabilities

- **CAP-2** Station queue - a cook sees their station's queued tickets
  oldest-left, with ageing colors from the station's own threshold, and can
  bump, recall, or refire.

CAP-1 (ticket domain, routing, fire-on-send) is backend-only, shipped in
restiq-backend PR #70 (issue #67) - this story consumes it verbatim. CAP-3
(Expo), CAP-4 (Bumped/recall), CAP-5 (All-day summary) are later sibling
stories; this story only establishes the shell/nav slots for them.

## What's built

- `/kds` route group, a sixth disjoint surface that **reuses the pos auth
  realm** (SPEC/AD-16: "auth realms separate principal types, not screens").
  `src/proxy.ts` routes `/kds/:path*` through the same `decidePosRoute` as
  `/pos` - a missing/expired `pos_session` redirects to the existing
  `/pos/login?next=<the /kds path>`. `src/lib/pos-session.ts`'s
  `sanitizePosNextPath` was widened to also accept `/kds` so that
  `next=` round-trips back through the same login page after a real PIN
  sign-in.
- `src/app/kds/api/[...path]/route.ts` - server-side pass-through to the
  backend's real, merged `/kitchen/v1/*` (restiq-backend#70), forwarding the
  same `pos_session` cookie as a bearer token. Mirrors `/pos/api/[...path]`
  exactly; only the upstream path prefix differs.
- `src/app/kds/api.ts` - typed client (`KdsApiError`/`kdsApi`,
  `listStations`/`stationQueue`/`bumpTicket`/`recallTicket`/`refireTicket`),
  shapes copied verbatim from `restiq-backend/src/kitchen/tickets.dtos.ts`.
- `src/app/kds/layout.tsx` - the `.kds-theme` wrapper (`#0E0E10` base,
  Hanken Grotesk/Inter/Public Sans), reads the `pos_staff` cookie
  server-side (same stand-in POS uses - no session read-back endpoint
  exists) to resolve the display's outlet, handed down via
  `KdsOutletProvider`/`useKdsOutlet()`.
- Station picker (`src/app/kds/page.tsx` + `kds-entry.tsx` +
  `kds-entry-state.ts`): fetches the outlet's stations, checks the saved
  choice (`kds-station-storage.ts`, `localStorage` key
  `kds:station:<outletId>`), and either redirects straight into that
  station's queue or shows the picker. Falls back to a synthetic "Unrouted
  tickets" option when the outlet has zero real stations (restiq-backend's
  documented zero-station edge case). `?reselect=1` forces the picker again
  - that's what the header's "Change station" control links to.
- `src/app/kds/(shell)/kds-header.tsx` - the shared quiet header every mode
  renders: current station/mode title, Station/Expo/Bumped/All-Day nav,
  Change station, Sign out. Expo/Bumped/All-Day
  (`src/app/kds/(shell)/{expo,bumped,all-day}/page.tsx`) are real routes
  rendering a `ComingSoon` placeholder - inert until stories 3-5 replace
  them.
- K1 Station Queue (`src/app/kds/(shell)/station/`):
  - `station-queue-state.ts` - pure logic: `ageingLevel` (blue/yellow/red),
    `formatElapsed`, `sortOldestFirst`, `orderTypeLabel`,
    `ticketDisplayNumber`, `groupLinesByBatch` (ADD-ON section grouping).
  - `use-station-queue.ts` - the ~5s poll, stale-on-failure (never
    blank-and-repaint), with a `refresh()` escape hatch for immediate
    re-polling after a mutation.
  - `use-ticket-actions.ts` - bump/recall/refire with a per-ticket
    pending lock (blocks double-tap) and one automatic retry on failure
    before surfacing a re-tappable error.
  - `ticket-card.tsx` - the load-bearing `TicketCard`: header (order
    number, table/type, large tabular elapsed time), ADD-ON-separated line
    groups, seat tags, struck-through-red VOID lines, RECALLED banner
    (`ticket.recalled`, real data), Bump/Refire (queued) or Recall (bumped).
  - `station-queue-screen.tsx` - ties it together: reconnecting notice on
    poll failure, skeleton on first load, calm "No open tickets" empty
    state, the oldest-left ticket rail.

## Integration points for later stories

- **The shell (issue #66) is the contract for K2-K4.** `KdsHeader`,
  `KdsOutletProvider`/`useKdsOutlet()`, `kdsApi`/`api.ts`'s types,
  `data-states.tsx`, and `use-kds-load.ts` are all meant to be reused as-is,
  not re-implemented per screen.
- `TicketCard` (`ticket-card.tsx`) is written to be reusable for K3's
  bumped/recall view: it already branches on `ticket.status` (`queued` ->
  Bump/Refire, `bumped` -> Recall), so K3 should render this same component
  against `GET .../bumped` results, not build its own ticket rendering.
- **Poll convention:** a `~5s` interval hook shaped like
  `use-station-queue.ts` (stale-on-failure, `refresh()` for post-mutation
  immediacy) - K2/K4 should copy this shape for their own reads
  (`/expo`, `/all-day-summary`) rather than inventing a different polling
  pattern.
- **API convention:** every kitchen read/write goes through
  `src/app/kds/api.ts`'s `kdsApi()` helper and the `/kds/api/[...path]`
  pass-through - no new proxy route is needed for K2-K5, only new functions
  in `api.ts` mirroring the backend's already-committed
  `tickets.dtos.ts`/`tickets.controller.ts` shapes.
- **KdsHeader's `activeMode`** already has `"expo" | "bumped" | "all-day"`
  cases wired to real (placeholder) routes - a sibling story's page.tsx
  just needs to replace its `ComingSoon` body with the real screen and pass
  its own `activeMode`.

## Key decisions

- **A single `Station.ageingThresholdMinutes` drives both the
  blue->yellow and yellow->red cutoffs.** DESIGN.md/SPEC.md describe a
  "first" and "second/urgent" threshold, but the real schema
  (restiq-backend#70) and the Tenant Admin stations panel both expose only
  one configurable number. This client's reading: the configured value IS
  the first (ageing) cutoff, and urgent is `2x` it - a deterministic
  derivation from the one real field rather than inventing an unconfigured
  second schema column. See `station-queue-state.ts`'s `ageingLevel` header
  comment. Revisit if a future story adds a real second threshold.
- **No "server/owner name" on the ticket header.** DESIGN.md's ideal
  `TicketCard` header lists a server/owner name, but the real, merged
  `TicketView` (restiq-backend#70) carries no staff attribution anywhere -
  an approved decision (SPEC open question resolved "no" - shared station
  screen, FR-34), not an omission here. The header renders order number,
  table/type, and elapsed time only - never a fabricated name.
- **No per-ADD-ON-batch "own fired time."** EXPERIENCE.md's `TicketCard`
  description says each ADD-ON section carries its own fired time, but
  `TicketLineView` has no per-line/per-batch timestamp - only the ticket's
  single `firedAt` exists (the real per-batch fact is recorded as a
  `TicketEvent` row of type `add_on_fired`, but that event log isn't
  exposed through `TicketView`/`TicketLineView`). Rendering a second timer
  from data that doesn't exist would be exactly the kind of fabricated
  telemetry this codebase repeatedly avoids elsewhere (attendance,
  connectivity, printer status). The ADD-ON section still renders as a
  visually separated, labeled group (the SPEC/DESIGN success criterion that
  actually matters: "an ADD-ON section is visually separated inside its
  parent ticket") - just without an invented second clock. A good backend
  follow-up: expose `TicketEvent`'s `add_on_fired` timestamps per batch.
- **Order type ("Dine-in"/"Counter") is derived, not fetched.** `TicketView`
  has no explicit order-type field; `tableLabel` is only ever non-null for a
  table order (`startCounterOrder()` always sets `tableId: null`, per
  `src/app/pos/api.ts`), so presence of a table label is structurally
  equivalent to "dine-in".
- **Tall-ticket continuation columns are out of scope for this story.**
  DESIGN.md's Do/Don't list mentions spilling an overly tall ticket into an
  explicit continuation column rather than shrinking type. This story's
  cards instead grow to fit their content in a horizontally-scrolling rail
  (each column a fixed-width ticket, `overflow-x-auto`) - simpler, no
  column-balancing algorithm, and not a hard CAP-2 success criterion
  (SPEC.md's CAP-2 success line doesn't mention it). Flagged here as a
  known simplification for a future visual-polish pass, not a missed
  requirement.
- **Bump/recall/refire have no automated live-backend verification in this
  story.** No local restiq-backend/Postgres instance was available in this
  build's environment, so the fire->queue->bump loop is covered only by
  mocked-fetch integration tests against the real, merged
  `tickets.dtos.ts`/`tickets.controller.ts` shapes (read directly, not
  guessed) - not exercised against a live server. Flagged for whoever next
  has a running backend to spot-check.
