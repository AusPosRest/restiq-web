# Kitchen Display (KDS) - web

## Capabilities

- **CAP-2** Station queue - a cook sees their station's queued tickets
  oldest-left, with ageing colors from the station's own threshold, and can
  bump, recall, or refire.
- **CAP-5** All-day production summary - the kitchen sees live per-item
  production counts across all open (queued) tickets, sorted highest-count-
  first, that decrement as items bump within the same ~5s poll cycle.

CAP-1 (ticket domain, routing, fire-on-send) is backend-only, shipped in
restiq-backend PR #70 (issue #67) - this story consumes it verbatim. CAP-3
(Expo), CAP-4 (Bumped/recall) are later sibling stories; those still only get
the shell/nav slots established by issue #66.
- **CAP-4** Bumped view and recall - bumped tickets remain visible,
  newest-bumped-first, with their full recall history, and a single tap
  recalls one back to its source station.

CAP-1 (ticket domain, routing, fire-on-send) is backend-only, shipped in
restiq-backend PR #70 (issue #67) - this story consumes it verbatim. CAP-3
(Expo), CAP-5 (All-day summary) are later sibling stories; the shell story
(#66) only established the shell/nav slots for them.

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
  Change station, Sign out. Expo/Bumped
  (`src/app/kds/(shell)/{expo,bumped}/page.tsx`) are real routes rendering a
  `ComingSoon` placeholder - inert until stories 3-4 replace them. All-Day
  (`src/app/kds/(shell)/all-day/page.tsx`) is real as of this story (K4,
  issue #72).
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

- K4 All-Day Production Summary (`src/app/kds/(shell)/all-day/`, CAP-5,
  issue #72):
  - `all-day-summary-state.ts` - pure logic: `sortHighestCountFirst`
    (highest-count-first; this story's documented sort choice - the
    backend's `GET .../all-day-summary` returns alphabetical-by-name, see
    Key decisions below).
  - `use-all-day-summary.ts` - the same ~5s poll shape as K1's
    `use-station-queue.ts` (stale-on-failure, never blank-and-repaint).
  - `all-day-summary-screen.tsx` - the `AllDayCountGrid`: one tile per item
    (large tabular-numeral count + item name), reconnecting/load-failed
    notices identical in wording to K1's, skeleton on first load, calm
    "No open tickets" empty state.
  - `page.tsx` renders the screen directly, mirroring K1's
    `station/[stationId]/page.tsx` shape.
## What's built (continued: K3 Bumped View and recall, issue #71)

- `src/app/kds/api.ts` gained `BumpedTicketView` (`TicketView & { recallHistory:
  string[] }`) and `bumpedTickets(outletId)` (`GET
  /kitchen/v1/outlets/:outletId/bumped`, restiq-backend#70's real, merged
  `bumped()` - shapes read directly from `tickets.service.ts`/`tickets.dtos.ts`,
  not guessed).
- `src/app/kds/(shell)/bumped/`:
  - `bumped-view-state.ts` - pure logic: `sortBumpedNewestFirst` (defensive
    client re-sort, same precedent as K1's `sortOldestFirst`),
    `formatRecallTimes` (ISO timestamps -> local clock-time labels).
  - `use-bumped-queue.ts` - the ~5s poll, stale-on-failure, `refresh()` for
    immediate re-polling after a recall - identical shape to K1's
    `use-station-queue.ts`, per the shell story's documented poll convention.
  - `bumped-view-screen.tsx` - ties it together: reconnecting/failed notices,
    skeleton, calm "No bumped tickets" empty state, and the newest-bumped-left
    rail. Recall reuses K1's `useTicketActions` (same one-tap, one-retry
    contract); bump/refire are no-ops here since `TicketCard` only renders
    Recall for a `status: "bumped"` ticket.
  - `page.tsx` - replaces the shell story's `ComingSoon` placeholder.
- `TicketCard` (`station/ticket-card.tsx`) gained one new optional prop,
  `recallTimes?: string[]` - when present and non-empty, renders a small
  "Recalled Nx - <times>" strip below the header. Undefined everywhere else
  (K1's `/queue` read carries no recall history), so K1's own rendering and
  tests are unaffected. This is the "reuse `TicketCard` directly" contract
  the shell story asked for: no forked ticket rendering for K3, one additive
  prop instead.

## Key decisions (continued: K3, issue #71)

- **Bumped-newest-first, not a client-invented ordering.** CAP-4's SPEC/
  screens.md success line doesn't state an order; restiq-backend#70's real
  `bumped()` (`tickets.service.ts`) already returns `orderBy: { bumpedAt:
  'desc' }` with a doc comment saying so ("most-recently-bumped first").
  `bumped-view-state.ts`'s `sortBumpedNewestFirst` is a defensive
  client-side re-sort of that documented order - the same precedent K1 set
  with `sortOldestFirst` re-sorting an already-`firedAt asc` response,
  not an independent client decision.
- **Recall history renders as a compact strip, not the DESIGN.md mock's
  per-cook attribution.** The bumped-view screenshot
  (`bumped-view-spice-route--a3cc216b.png`) shows "Bumped by <name>" -
  unavailable, per the shell story's own documented decision that the real,
  merged `TicketView` carries no staff attribution anywhere (FR-34, no
  actor attribution). `recallHistory` (ISO timestamps from the backend's
  append-only `TicketEvent` log) is real data the mock doesn't show; K3
  renders that instead - "Recalled Nx - <time>, <time>" - real facts, not a
  fabricated name.
- **No time-since-bumped clock on `TicketCard`; the elapsed figure still
  reads time-since-fired.** Reusing `TicketCard` as-is (per the shell
  story's explicit instruction) means the header's elapsed time keeps its
  existing meaning rather than gaining a second, forked clock for this one
  screen. The ageing color is moot here regardless - `TicketCard` already
  forces the green bumped frame for any `status: "bumped"` ticket, ignoring
  the ageing level entirely.
- **`ticket.recalled` (the RECALLED banner) does not appear in the bumped
  view.** Per the real DTO's own doc comment, `recalled` is true only while
  a ticket is `queued` as the direct result of a recall - a bumped ticket
  is never in that state, so the banner correctly never renders here. The
  banner belongs to K1's station queue (where a just-recalled ticket lands),
  not K3 - consistent with SPEC's "recalling... returns it to its source
  station's queue marked RECALLED", not the bumped view itself.

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
  immediacy) - K2/K3 should copy this shape for their own reads (`/expo`,
  `/bumped`) rather than inventing a different polling pattern. K4's
  `use-all-day-summary.ts` already does this (no `refresh()` - the all-day
  screen has no mutating actions of its own).
- **API convention:** every kitchen read/write goes through
  `src/app/kds/api.ts`'s `kdsApi()` helper and the `/kds/api/[...path]`
  pass-through - no new proxy route is needed for K2-K3, only new functions
  in `api.ts` mirroring the backend's already-committed
  `tickets.dtos.ts`/`tickets.controller.ts` shapes. K4 added
  `AllDaySummaryEntryView`/`allDaySummary()` this way, verbatim from
  restiq-backend's `tickets.dtos.ts`/`tickets.controller.ts` (`GET
  outlets/:outletId/all-day-summary`).
- **KdsHeader's `activeMode`** already has `"expo" | "bumped" | "all-day"`
  cases wired to real routes - a sibling story's page.tsx just needs to
  replace its `ComingSoon` body with the real screen and pass its own
  `activeMode` (K4 did exactly this for `"all-day"`; K2/K3 still owe it for
  `"expo"`/`"bumped"`).

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
- **The all-day grid sorts highest-count-first, not the backend's
  alphabetical order.** `GET .../all-day-summary` (restiq-backend's real,
  merged `tickets.service.ts`) returns entries alphabetical-by-`itemName`.
  SPEC.md's CAP-5 success line only requires counts to derive from real
  queued lines and decrement on bump within a poll cycle - it names no
  order. This client's call: a wall display exists to be scanned in
  passing, so what's busiest belongs first, not what starts with "A".
  `all-day-summary-state.ts`'s `sortHighestCountFirst` re-sorts client-side;
  ties keep the backend's alphabetical order (`Array.sort` is stable) so the
  grid doesn't jitter between polls when two counts happen to match.
  Revisit if a future story wants this configurable.
- **No `refresh()` escape hatch on `use-all-day-summary.ts`.** K1's
  `use-station-queue.ts` exposes `refresh()` so a just-issued bump/recall/
  refire can force an immediate re-poll. The all-day screen has no mutating
  actions of its own (SPEC's CAP-5 scope is read-only), so there is nothing
  to force a re-poll after - keeping it out avoids dead API surface.
- **Bump/recall/refire have no automated live-backend verification in this
  story.** No local restiq-backend/Postgres instance was available in this
  build's environment, so the fire->queue->bump loop is covered only by
  mocked-fetch integration tests against the real, merged
  `tickets.dtos.ts`/`tickets.controller.ts` shapes (read directly, not
  guessed) - not exercised against a live server. Flagged for whoever next
  has a running backend to spot-check.
