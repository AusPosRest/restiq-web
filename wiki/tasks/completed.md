# Completed

- **2026-08-29** - QR self-order story 3: shared group cart and table order
  review (CAP-3). `/qr/cart` (`src/app/qr/cart/`) - grouped by guest with
  per-guest subtotals and a combined total, own lines editable (quantity
  stepper, remove), everyone else's read-only, ~5s polling that converges
  in place with `aria-live="polite"`, a 410 session-closed state, and a
  disabled "Place order" CTA for the next story (CAP-4). Added `guestId` to
  the `guest_display` cookie (decoded from the guest JWT's `sub` claim) so
  the cart can tell "my line" from everyone else's. Corrected the guest
  realm's routing convention from nested to flat post-session paths and
  end-anchored `decideGuestRoute`'s entry regex, closing a gap where a
  nested screen route would have bypassed the session gate entirely. See
  [wiki/features/qr-self-order.md](../features/qr-self-order.md). Issue
  AusPosRest/restiq-web#68.

- **2026-08-24** - Tenant Admin story 1: owner invite acceptance (CAP-1) and
  go-live checklist UI (CAP-2). `/admin/invite/[token]`, `/admin/onboarding`,
  new `/admin` auth realm in `src/proxy.ts` (AD-10, `aud:"admin"`,
  `admin_session` cookie), `/admin/api/[...path]` pass-through. See
  [wiki/features/tenant-admin.md](../features/tenant-admin.md). Issue
  AusPosRest/restiq-web#18.

- **2026-08-24** - Tenant Admin story 2: AI-assisted menu import review UI
  (CAP-3). `/admin/menu/import` (`src/app/admin/menu-import.tsx`) - dropzone,
  per-field confidence chips, inline edit with optimistic rollback, single
  "Commit menu" gated on every row being reviewed, celebratory success state
  linking back to `/admin/onboarding`. Fixed the `/admin/api` pass-through to
  forward multipart uploads with their original boundary and raw bytes
  instead of forcing JSON. See
  [wiki/features/tenant-admin.md](../features/tenant-admin.md) for the
  contract mismatches found against the backend's actual (uncommitted)
  `feature/28-menu-import` code. Issue AusPosRest/restiq-web#20.

- **2026-08-24** - Tenant Admin story 3: menu management UI (CAP-4).
  `/admin/menu` (`src/app/admin/(shell)/menu/`) - category sidebar + item
  DataTable with search, item editor drawer (variants, modifier-group and
  allergen catalog pickers with min/max validation messaging, combos,
  per-outlet availability override), price editing that always shows the
  current price plus a "schedule a price change" action requiring a reason,
  and an optimistic 86 (availability) toggle with rollback-on-failure toast.
  Introduces the first post-go-live app shell (`src/app/admin/(shell)/`:
  sidebar nav, `ComingSoon` placeholders for Dashboard/Floor Plan/Devices/
  Staff/Reports/Settings). See
  [wiki/features/tenant-admin.md](../features/tenant-admin.md) for the
  substantial contract differences found against the backend's actual
  (uncommitted) `feature/30-menu-management` code - notably that modifier
  groups/allergens are tenant-wide catalogs, not per-item fields, and that
  there is no endpoint to list an item's scheduled future prices. Issue
  AusPosRest/restiq-web#22.

- **2026-08-24** - Tenant Admin story 4: branding & capabilities UI
  (CAP-10). `/admin/settings/branding` - color-token editor, font, corner
  radius, logo (local preview + hosted-URL field), receipt header/footer,
  with a live receipt preview pane updating on every change before Save.
  `/admin/settings/capabilities` - per-outlet capability toggles
  (QR ordering, kiosk, token queue), optimistic with rollback-on-failure
  toast. Wires the real `GET /admin/v1/outlets` into the shell's outlet
  switcher (built hidden in story 3 for lack of the endpoint). Verified
  **live** against the real backend (`feature/32-branding-capabilities`,
  both servers up together, migration already applied to the shared test
  DB) - see [wiki/features/tenant-admin.md](../features/tenant-admin.md)
  for the contract mismatches found and reconciled: `BrandingTokens` is a
  flat token set (not nested under `colors`), corner radius clamps to 0-64
  (not 0-24), `OutletView` carries `address/type/timezone` (not
  `city`/`area`), a picked logo file only ever previews locally since the
  backend's `logoUrl` is capped at 2048 chars with no upload endpoint, and
  outlet capabilities render a client-owned known-key set merged with
  whatever the backend has actually recorded. Issue
  AusPosRest/restiq-web#24.

- **2026-08-24** - Tenant Admin story 5: floor plan & stations UI (CAP-5).
  `/admin/floor-plan` - draggable-table canvas (pointer + keyboard, grid
  snap, live overlap tint) with a floor tab strip, an accessible list-view
  fallback (editable X/Y/capacity table) for non-pointer interaction, and a
  Kitchen Routing stations panel (ageing threshold, printer dropdown, and an
  explicit "no printer" acknowledgement checkbox that gates the save). See
  [wiki/features/tenant-admin.md](../features/tenant-admin.md) for the
  contract read directly from the backend's actual (concurrently-built,
  uncommitted) `feature/34-floor-plan` code - notably the overlap policy it
  settled on (reject with 409, not auto-adjust) and that one GET returns
  floors/stations/printers together rather than three separate endpoints.
  Issue AusPosRest/restiq-web#26.

- **2026-08-24** - Tenant Admin story 6: devices & printers UI (CAP-6).
  `/admin/devices` - read-only device table (name/type/role/app version/last
  seen/status), an "Enrol device" flow that generates a one-time code shown
  with a live `m:ss` countdown (mirrors Platform Console's Code Chip
  behavior, admin-themed and reimplemented rather than cross-realm imported
  per AD-4), and a printer render-mode/fallback config panel reusing story
  5's printers/stations. Verified **live** against the real backend
  (`feature/36-tenant-devices`, both servers up together against the shared
  test DB, backend's own CAP-6 and floor-plan e2e suites green) - see
  [wiki/features/tenant-admin.md](../features/tenant-admin.md) for the
  contract gap found and reconciled: the device list response omits
  `appVersion`/`lastContactAt` even though the `Device` row carries both
  columns, confirmed by seeding both fields directly and still seeing the
  UI's graceful "-"/"Never" fallback render. Issue AusPosRest/restiq-web#28.

- **2026-08-24** - Tenant Admin story 7: staff & roles UI (CAP-7).
  `/admin/staff` - staff list with a per-row role dropdown constrained to
  the six seeded system roles, an "Add staff" form, PIN issue (plaintext
  shown once via toast) and PIN revoke through a confirm-modal naming the
  affected person by name ("This removes Priya Nair's access to the till.").
  Role change is also pessimistic-with-confirm-and-reason, reusing CAP-4's
  `ConfirmReasonDialog`. Role permission matrix is a read-only reference
  table. **Not verified against a real backend**: restiq-backend#38 (the
  CAP-7 API) had no branch, controller, or Prisma model beyond the bare
  `Role` table at implementation time - see
  [wiki/features/tenant-admin.md](../features/tenant-admin.md) for the full
  provisional-contract note and the deviation this forces (the permission
  matrix is sourced from a static reference, not the roles endpoint, since
  `Role` carries no permission metadata). Covered by mocked-fetch component
  tests and pure-logic unit tests; additionally verified live in a browser
  (shell rendering, graceful load-error with no backend, and full UI
  interaction against a client-side fetch patch). Issue
  AusPosRest/restiq-web#30.

- **2026-08-24** - Tenant Admin story 8: owner dashboard UI (CAP-8).
  `/admin` (dashboard home, `src/app/admin/(shell)/dashboard/`) - real-count
  KPI tiles (outlets/staff/menu items/devices), per-outlet
  sales/margin/labour/waste tiles with an honest no-data state
  ("No sales data yet. Connect POS to see live figures.") since no
  Order/Bill/Payment model exists yet, a cross-outlet comparison table for
  multi-outlet tenants, and an "As of [time]" freshness badge. First built
  against a self-authored contract before restiq-backend#41 was checkable;
  reconciled afterward against the real response - `tenant` not `counts`,
  no `stale` field on the wire (backend computes `asOf` fresh every request),
  and all four financial metrics share one flat `{amountMinor, currency,
  hasData, message}` shape (margin is a currency amount, not a percentage -
  the original percent-based rendering was wrong and corrected). See
  [wiki/features/tenant-admin.md](../features/tenant-admin.md) for the full
  reconciliation note. 400 tests passing. Issue AusPosRest/restiq-web#32.

- **2026-08-24** - Tenant Admin story 9: reports catalogue UI (CAP-9).
  `/admin/reports` - a report card grid grouped by category (Sales
  Performance/Financial & Compliance/Menu Engineering/Operations/Inventory/
  Labour), each card either a working "Export CSV" for the two reports
  backed by real data (menu catalogue, staff roster) or an honest "Pending"
  state with the backend's own message for the rest (no fake report data,
  same `hasData`/`message` convention as CAP-8). An "Accounting tools" picker
  lists Tally/Xero/MYOB/Zoho/QuickBooks live from the backend, all honestly
  "Not connected" - no fake connected state, no OAuth flow. Extended
  `src/app/admin/api/[...path]/route.ts` to pass non-JSON upstream responses
  (the CSV export's raw `text/csv` body) through as bytes with their
  content-type/content-disposition intact, instead of forcing every response
  into a JSON envelope. Verified two ways: the backend's own e2e suite (13
  tests) run directly against real Postgres, and a live browser
  click-through against a contract-faithful local stub (the real backend's
  `dist/` was being concurrently rebuilt by the backend-building agent's own
  watch processes in the same checkout) that confirmed the real proxy
  pass-through, category grid, export click, and destinations dialog all
  work end to end. See
  [wiki/features/tenant-admin.md](../features/tenant-admin.md) for the full
  reconciliation against restiq-backend#42's actual (uncommitted at the
  time) contract - found and fixed after this story's first pass, before
  restiq-backend#42 existed, guessed a different envelope, field names, and
  export mechanism. Issue AusPosRest/restiq-web#34.

- **2026-08-24** - Tenant Admin story 10: floor, table, and station
  authoring UI (CAP-5 gap-fix). Story 5 shipped floor-plan *layout* editing
  (drag existing tables, edit existing stations) with no way to create a
  floor plan's first floor, table, station, or printer - a brand-new outlet
  could never actually reach the Go-Live Checklist's `floor_plan` step
  through the console. Closed entirely on the frontend against story 5's
  already-merged backend create endpoints (`POST .../floor-plan/{floors,
  tables,stations,printers}`, no backend changes needed): an empty state
  (icon + "No floor plan yet" + "Add your first floor", matching
  EXPERIENCE.md's empty-state formula) for zero floors; an add-floor/
  add-table toolbar sitting above the canvas/list split so both views get
  create affordances without a second implementation; add-table as a
  compact form (label/shape/seats) with a computed non-overlapping default
  position, still respecting the real `table_overlap` 409; add-station and
  add-printer forms in the stations panel, add-station reusing the existing
  printer-required-or-acknowledge gate verbatim. See
  [wiki/features/tenant-admin.md](../features/tenant-admin.md)'s CAP-5
  section for the full design notes. Verified **live**: seeded a brand-new
  tenant/outlet with zero floors and a real `OwnerInvite` directly via
  Prisma, signed in through the actual invite-accept UI flow, then drove a
  full add-floor -> add-table -> add-printer -> add-station click-through
  against real running backend and web servers - `GET /admin/v1/checklist`
  confirmed `floor_plan: completed: true` as a direct result, closing the
  exact gap this story targets. 435 tests passing. Issue
  AusPosRest/restiq-web#36.

- **2026-08-25** - POS Cashier & Waiter story 1: PIN login and shift clock
  UI (CAP-1). New fourth disjoint auth realm `/pos` (AD-13, `aud:"pos"`,
  `pos_session` cookie) wired into `src/proxy.ts` alongside `/ops`/`/admin`,
  with `/pos/api/[...path]` pass-through mirroring `/admin/api`'s. Full-
  screen PIN keypad (`/pos/login`) auto-submitting at 4 digits, with an
  inline wrong-PIN error, a live client-timed lockout countdown after 5
  wrong attempts, and an outlet picker (a dedicated `select-outlet` step
  with a backend-issued `pendingToken`) that only appears for multi-outlet
  tenants. A lightweight persistent shift bar (`src/app/pos/(shell)/
  shift-bar.tsx`) shows the staff name/outlet and a Clock Out control (the
  real backend has no clock-in toggle - clock-in is automatic on login), plus
  sign-out, reachable after login. **Verified against the real backend
  contract**: restiq-backend's `feature/44-pos-auth-clock` branch (real,
  pushed, not yet merged to `restiq-backend/dev`) was read directly -
  `auth.dtos.ts`, `auth.controller.ts`, `auth.service.ts`,
  `clock.controller.ts`, `lockout.ts` - and this story's originally-guessed
  contract (`requiresOutletSelection`, `clock/toggle`, `auth/me`, a
  server-echoed `lockedUntil`) was replaced with the real
  `tenantId`+`pin`/`pendingToken`+`outletId`/`clock/out`-only shapes. See
  [wiki/features/pos-cashier-waiter.md](../features/pos-cashier-waiter.md)
  for the full reconciliation note. Covered by pure-logic and mocked-fetch
  component tests plus the route handlers' own tests, all rewritten against
  the real contract shapes. Issue AusPosRest/restiq-web#38.

---

**Tenant Admin: all 10 stories complete.** CAP-1 through CAP-9 plus this
story's CAP-5 gap-fix now cover the full owner console end to end: invite
acceptance and the go-live checklist (CAP-1/2), AI-assisted menu import
(CAP-3), menu management (CAP-4), floor plan authoring and layout editing
together (CAP-5), devices and printers (CAP-6), staff and roles (CAP-7), the
owner dashboard (CAP-8), and the reports catalogue (CAP-9). A brand-new
tenant can now go from an accepted invite to every Go-Live Checklist step
completable through the console alone, with no backend gap left standing on
the frontend's side. Follow-ups already on record rather than hidden:
CAP-7's permission matrix still sources from a static reference pending
`Role` gaining permission metadata, and CAP-9's non-CSV report cards remain
honest "Pending" states until their backends exist - both documented in
[wiki/features/tenant-admin.md](../features/tenant-admin.md), not silently
faked.

- **2026-08-25** - POS Cashier & Waiter story 3 (CAP-2 table map and order
  ownership/transfer), web-only build (`restiq-web`, branch
  `feature/40-table-map-ownership`, closes #40): P2 Table Map
  (`src/app/pos/table-map/`), plus the `/pos` realm plumbing that didn't exist
  yet (`src/lib/pos-session.ts`, `src/proxy.ts` gating `/pos/:path*`,
  `src/app/pos/api/[...path]/route.ts`, `.pos-theme` in `globals.css`,
  `src/app/pos/layout.tsx`). A grid of color-coded `TableTile`s
  (empty/occupied/needs_bill) grouped by floor, each always pairing its
  status color with a visible text label (Accessibility Floor: color is
  never the only signal). Tapping an empty table starts a new order; tapping
  one the current staff member already owns opens it directly; tapping one
  owned by someone else never opens it silently - it surfaces a named
  `TransferOwnershipDialog` (owner named, reason optional) per
  EXPERIENCE.md's Priya flow, and only after confirming does it open.
  Starting, opening, or transferring all land on `/pos/orders/[orderId]`, a
  deliberately minimal placeholder proving the id/table/owner round-trip -
  this is the exact route story 4 (CAP-3 order taking) should build its real
  screen into, not a second route. `restiq-backend#46` (this story's own
  backend) and `restiq-web`'s own story 1/#38 (PIN login, so no real
  `/pos/login` or `pos_session` cookie existed yet) were both unbuilt at the
  time - self-authored contract and an honest, documented auth gap, same
  discipline as the CAP-8 dashboard story above. **Resolved by story 1 above**:
  a real `/pos/login` and `pos_session` cookie now exist, so table map's own
  route guard has a working login to redirect to. 32 new tests, 467/467
  passing repo-wide; lint/typecheck/build clean. See
  [wiki/features/pos-cashier-waiter.md](../features/pos-cashier-waiter.md)
  for the full writeup and the parallel-build dedupe note for any other
  in-flight POS story that also touches `/pos` realm plumbing.

- **2026-08-25** - POS Cashier & Waiter story: shift & cash management UI
  (CAP-10). `/pos/shift` (P11) - open-shift-with-float form, cash movement
  log with paid-out/bank-drop actions each requiring a reason.
  `/pos/shift/close` (P12) - `BlindCountKeypad` counted-amount entry, then an
  immutable counted/expected/over-short reveal, computed server-side and
  genuinely not sent to the client until after the count is submitted (a real
  two-step network flow, not a client that already holds the value). Neither
  issue #38 (base `/pos` shell/PIN login) nor restiq-backend#45 (this story's
  own backend) had landed any commits when this story started, so it built a
  self-authored standalone `/pos` auth realm and a provisional API contract,
  both explicitly flagged for reconciliation. **Reconciled** (this pass,
  rebasing #39 onto `dev` after #38, #40, and #42 all landed): the entire
  self-authored auth realm (`dev-session` route, `DevLoginButton`, the
  placeholder login page/layout copy) is deleted in favor of story 1's real,
  merged `/pos` shell (`pos_session`/`pos_staff` cookies, real PIN login,
  `src/app/pos/(shell)/shift-bar.tsx`); the shift bar now also carries a
  "Shift" nav link into `/pos/shift` (itself moved under `(shell)/` so it
  renders inside the real persistent bar), folding this story's "shift gates
  the main loop" affordance into the shared shell instead of a second
  auth-adjacent screen - the actual open/float/closed status still renders on
  `/pos/shift` itself rather than in the bar, since the bar's own test
  asserts zero client fetches on mount. The
  self-authored `api.ts` contract was replaced against restiq-backend's real
  `feature/45-shift-cash-management` branch (`shifts.controller.ts`/
  `.dtos.ts`/`.service.ts`, read directly): `openShift` now takes the
  session's `outletId` automatically instead of asking for it, movement
  logging posts to `cash-movements` (not `movements`), `closeShift`'s
  `countedMinor` request field and response shape match the real DTOs
  exactly, and `getShift(id)` was added. See
  [wiki/features/pos-cashier-waiter.md](../features/pos-cashier-waiter.md)
  for the full reconciliation writeup. The server-side-blindness test for the
  close flow still deep-scans every response for a populated expected/over-
  short value, now against the real backend's actual wire shape (which
  carries those keys as `null` on every pre-close response, not absent
  entirely) rather than the self-authored guess. Also fixed an unrelated
  pre-existing date-dependent flaky test in the CAP-8 dashboard suite
  (missing a fake-clock pin, broke once the real calendar moved past its
  fixture date) found while getting this story's CI green. Issue
  AusPosRest/restiq-web#39.

- **2026-08-25** - POS Cashier & Waiter story 11: device and staff
  attendance status UI (CAP-11). `/pos/status` (P13), nested under the real
  `(shell)` route group from the start (built after wave 1's `/pos` shell,
  PIN login, table map, and shift management had all landed) - a read-only
  attendance list (name + real CAP-1 clock-in time, "Out {time}" once
  clocked out, a genuine empty state rather than any fabricated row) plus a
  device status panel using DESIGN.md's `PrinterStatusChip`/
  `OfflineIndicatorPill`, both rendering a literal `(demo)` text node in the
  DOM (not just a tooltip) so the mocked printer/connectivity status can
  never be mistaken for live telemetry - asserted directly in
  `device-status-screen.test.tsx`. The paired backend story
  (restiq-backend#54) had no branch yet, so this ships a self-authored `GET
  /pos/v1/outlets/:outletId/attendance/today` contract flagged for
  reconciliation, same discipline as CAP-2's table-map contract. Added a
  "Status" nav link to the persistent shift bar alongside CAP-10's "Shift"
  link. See
  [wiki/features/pos-cashier-waiter.md](../features/pos-cashier-waiter.md)
  for the full writeup. Issue AusPosRest/restiq-web#48.

- **2026-08-25** - POS Cashier & Waiter story 6: open and held orders UI
  (CAP-5). `/pos/open-orders` (`src/app/pos/(shell)/open-orders/`), nested
  under the real shell so it gets the persistent shift bar. An outlet-wide,
  five-state list of every non-closed order (table or counter origin,
  server, status, elapsed time, item count/total shown as `—` rather than
  crashing when the backend hasn't provided them yet) with a plain "Resume"
  link to `/pos/orders/[orderId]` for the signed-in staff's own orders and a
  "Take over" button that reuses story 3's real `TransferOwnershipDialog`
  and `transferOrder()` action verbatim for everyone else's - no second
  dialog, no second transfer endpoint. A persistent "Open orders" nav link
  was added to the shift bar (`shift-bar.tsx`) and, since the table map
  isn't nested under the shell yet, directly to the table map's own header
  too, so the screen is reachable from both main-loop entry points per
  EXPERIENCE.md's IA. Self-authored contract (`GET
  /pos/v1/outlets/:outletId/orders`) - restiq-backend#53 had no branch yet
  (confirmed via `git ls-remote` against the real remote) - flagged for
  reconciliation once it lands. See
  [wiki/features/pos-cashier-waiter.md](../features/pos-cashier-waiter.md)'s
  CAP-5 section. 22 new tests, 556/556 passing repo-wide; lint/typecheck/
  build clean. Issue AusPosRest/restiq-web#47.

- **2026-08-25** - POS Cashier & Waiter story 4 (CAP-3 order taking with
  modifiers/variants), web-only build (`restiq-web`, branch
  `feature/46-order-taking-modifiers`, closes #46): the real P3 Order Taking
  screen (`src/app/pos/orders/[orderId]/order-taking-view.tsx`), replacing
  story 3's `order-stub.tsx` placeholder in place, same route. Category-tab
  + search item grid (`POSItemTile`, 86'd items shown disabled not hidden);
  tapping an item with a variant or a modifier group opens P4's
  `ModifierSheet` (chip groups, a visible "Required - choose N"/"Optional -
  up to N" badge, confirm disabled - never hidden - until every required
  group and any variant is satisfied); an item with neither adds straight to
  the order, no sheet. A running `OrderPanel` (line items, qty +/-/remove,
  "Added by {staff}" per line, running total) updates live as lines are
  added. `restiq-backend#52` (this story's own backend) has no branch yet -
  confirmed against the real GitHub `dev` tree via `gh api` (not the local
  checkout, which was 6 commits stale and missing `src/pos` entirely on
  disk): `Order` is genuinely base-fields-only, no `OrderLine`, no `/lines`
  or `/menu` endpoint anywhere - so this story's menu-read/order-line
  contract in `order-taking-state.ts`/`api.ts` is self-authored, same
  discipline as story 3's table-map contract. Also noted, but out of this
  story's scope to fix: `restiq-backend#46` (story 3's own backend) has since
  landed and its real `Order`/table-map shape differs from
  `table-map-state.ts`'s existing self-authored guess - flagged in
  `wiki/features/pos-cashier-waiter.md`'s Integration points for whoever
  reconciles CAP-2 next. 45 new tests (28 pure-logic, 7 `ModifierSheet`
  component, 10 screen integration), 573/573 passing repo-wide;
  lint/typecheck/build clean. No live backend reachable for CAP-3
  specifically, so verification is entirely the stubbed-fetch suite above,
  same posture as every other POS story built ahead of its own backend. See
  [wiki/features/pos-cashier-waiter.md](../features/pos-cashier-waiter.md)
  for the full writeup.

- **2026-08-25** - POS Cashier & Waiter story 5 (CAP-4 group ordering -
  seats and covers), web-only build (`restiq-web`, branch
  `feature/52-group-ordering`, closes #52): extends story 4's order-taking
  screen and panel in place, not a separate route - EXPERIENCE.md's IA calls
  this "optional seat-splitting, reached from the order panel's 'Split by
  seat' action". `OrderPanel` gains a "Split by seat" toggle that reveals a
  per-line seat stepper (reusing the existing quantity stepper's Minus/Plus
  pattern) and a new "Send to kitchen" footer action - this action didn't
  exist in the UI before this story. "Send to kitchen" is disabled, never
  hidden, while any line lacks a seat number, with an inline message naming
  the fix at the point of the violation (EXPERIENCE.md's Component/State
  Patterns), mirroring the real backend's anticipated 400 for the same rule
  (SPEC CAP-4: "unassigned items block fire"). `restiq-backend#58` (this
  story's own backend, branch `feature/58-group-ordering`) had no branch or
  commits yet when this was built (`gh api .../branches`, `gh issue view 58`
  both confirming open/unstarted - a parallel agent was building it
  concurrently) - so `assignSeat`/`sendOrderToKitchen`
  (`src/app/pos/api.ts`) target the real, already-merged CAP-3 endpoints
  (`PATCH .../lines/:lineId`, `PATCH .../status`, both verified directly off
  restiq-backend's real `dev` tree, story 4's PR #57) while anticipating the
  request/response fields (`seatNumber`, `firedAt`) issue #58 hasn't added
  yet - must be reconciled once it lands. `OrderLineView.seatNumber`/
  `OrderView.firedAt` are both optional so story 4's already-shipped
  tests/call sites keep type-checking unchanged - existing order-taking
  behavior (menu browsing, adding items, qty +/-/remove) is unaffected. 16
  new tests (12 pure-logic in `order-taking-state.test.ts`, 4 screen
  integration in `order-taking-view.test.tsx`), 611/611 passing repo-wide;
  lint/typecheck/build clean. No live backend reachable, same posture as
  every other POS story built ahead of its own backend. See
  [wiki/features/pos-cashier-waiter.md](../features/pos-cashier-waiter.md)
  for the full writeup.

- **2026-08-25** - POS Cashier & Waiter story 7 (CAP-6 QSR counter and token
  mode), web-only build (`restiq-web`, branch `feature/56-qsr-counter-token`,
  closes #56): the real P7 QSR Counter screen (`src/app/pos/counter/`,
  routed at `/pos/counter`) composes the real, already-merged order-taking
  grid (`PosItemTile`/`ModifierSheet`/`order-taking-state.ts`, story 4/#51)
  and the real, already-merged `BillSummary`/`TenderKeypad` (story 8/#53)
  into one continuous ring-up-and-settle screen, per SPEC CAP-6's success
  criterion - no separate table/order-detail navigation hop, and no separate
  `/settle` route the way dine-in orders use. A fresh `startCounterOrder()`
  call opens a table-less order and assigns it a sequential token number
  (new `OrderView.tokenNumber`, `api.ts`), shown via a new `TokenBadge`
  (DESIGN.md) throughout ring-up and settlement. `BillSummary` gained
  additive, opt-in qty-stepper/remove props (unused by story 8's own caller,
  which renders exactly as before) so the same line-item table serves both
  the read-only dine-in settle screen and this screen's still-editable
  counter order. Once the bill finalises, a "Start next order" action opens
  a brand-new counter order with the next token number, remounting the
  screen's state fresh rather than hand-resetting it - all still on
  `/pos/counter`, matching EXPERIENCE.md's "next customer is already at the
  counter" framing. `restiq-backend#62` ("QSR counter and token mode") had no
  branch or commits at build time (confirmed via `gh issue view`/`gh api
  .../branches`) - `startCounterOrder`'s contract is self-authored from
  SPEC.md and the P7 mock, documented in full in `api.ts`'s header, including
  why this story keeps building on restiq-web's own already-shipped
  self-authored `OrderView`/`BillView` shapes rather than the real backend's
  (substantially different) merged `dev` shapes discovered while researching
  this story - reconciling CAP-3/CAP-4/CAP-7 against those is flagged as a
  separate, much larger undertaking, out of this story's scope. Also added a
  reciprocal "Switch to Counter Mode"/"Switch to Table Mode" link pair
  between `/pos/table-map` and `/pos/counter`, since neither the login flow
  nor the post-login shell route by outlet capability yet (a pre-existing
  gap, not this story's to fix). 4 new integration tests (starting a counter
  order and showing its token, a retryable start failure, a full ring-up-
  through-finalize flow with no navigation, and starting the next order
  issuing a fresh token), 630/630 passing repo-wide; lint/typecheck/build
  clean. No live backend reachable for CAP-6, so verification is the stubbed-
  fetch suite above plus a local dev-server check that the screen renders and
  error-handles cleanly with no backend behind it, same posture as every
  other POS story built ahead of its own backend. See
  [wiki/features/pos-cashier-waiter.md](../features/pos-cashier-waiter.md)
  for the full writeup.

- **2026-08-25** - POS Cashier & Waiter story 8 (CAP-7 bill & settle),
  web-only build (`restiq-web`, branch `feature/53-bill-and-settle`, closes
  #53): the real P8 Bill & Settle screen
  (`src/app/pos/orders/[orderId]/settle/`), reached from a new "Settle"
  button on the real, already-merged order-taking screen. `BillSummary`
  (left panel) renders line items, subtotal, an optional discount line,
  CGST/SGST tax lines, round-off, and grand total; `TenderKeypad` (right
  panel) reuses the already-merged shift `AmountKeypad` for cash/UPI tender
  entry, supports multiple/split tenders, and shows a running
  remaining-to-settle figure. A discount below a 10%
  (self-documented-judgment-call) threshold takes a plain reason field;
  at/above it, the same flow instead renders the real, already-merged
  `ManagerPinDialog` (story 9/#42) with discount-specific reason codes - not
  a second PIN dialog. Finalize is disabled until tenders exactly cover the
  grand total; once finalised, the whole mutation half of the screen (discount
  button, keypad, Finalize) stops rendering outright, replaced by a read-only
  "Bill finalised" panel - no edit path survives (AD-14). `restiq-backend#59`
  (this story's own backend) had no branch or commits at build time - unlike
  CAP-3, there was no real schema to read either, since the issue itself
  calls this a greenfield Bill/Tender build - so the whole bill contract
  (`GET/POST .../bill*`) plus the CGST/SGST 2.5%+2.5% tax computation is
  self-authored, documented in full in `settle/bill-state.ts`'s header. Also
  discovered and flagged (not fixed, out of this story's scope): the
  `docs/specs/spec-pos-cashier-waiter/` and
  `docs/ux/ux-pos-cashier-waiter-2026-08-25/` paths this whole wiki doc's
  header has cited since story 1 do not exist anywhere in the real
  `restiq-design` repo (checked every branch), and story 9's `ManagerPinDialog`
  landed without a `wiki/features/pos-cashier-waiter.md` section of its own -
  both spawned as separate follow-up tasks. 15 new tests (9 pure-logic, 6
  screen integration covering tax breakdown, multi-tender remaining-to-settle,
  finalize gating, both discount paths, and post-finalisation read-only
  state), 626/626 passing repo-wide (after merging story 5's
  concurrently-landed CAP-4 work); lint/typecheck/build clean. No live
  backend reachable for CAP-7, so verification is entirely the stubbed-fetch
  suite above, same posture as every other POS story built ahead of its own
  backend. See
  [wiki/features/pos-cashier-waiter.md](../features/pos-cashier-waiter.md)
  for the full writeup.

- **2026-08-25** - POS Cashier & Waiter story 10 (CAP-9 refunds and
  adjustments), web-only build (`restiq-web`, branch
  `feature/57-refunds-adjustments`, closes #57): the real P10 Refund &
  Adjustments screen (`src/app/pos/orders/[orderId]/refund/`), reached from a
  new "Refund…" button on the real, already-merged bill-settle screen's
  post-finalisation panel (story 8). Reuses two real, already-merged pieces
  outright rather than rebuilding either: `BillSummary` (story 8) renders the
  original, finalised bill read-only and unmodified (it already hides its
  discount affordance once `status: "finalised"`, so nothing new needed
  wiring there), and `ManagerPinDialog` (story 9/#42) gates the one and only
  path to submitting a refund - refund has no below-threshold exception
  (CAP-8 always gates it), so the mandatory reason code comes solely from the
  dialog's own reason-code select, with no plain-reason fallback the way
  CAP-7's discount has. A new `RefundConfigPanel` lets staff check items and
  adjust refund quantity (clamped to the original line's quantity) with a
  live-computed subtotal/tax-reversal/total, matching the P10 mock's own
  numbers exactly (2 x Butter Naan @ ₹60 -> ₹126 total at the same 5%
  combined CGST+SGST rate CAP-7 established). On approval, a new
  `CreditNoteResult` screen replaces the whole refund UI wholesale - the
  original bill is never re-rendered as "edited" because it was never
  written to in the first place (AD-14/CAP-9 insert-only design).
  `restiq-backend#63` (this story's own backend) had no branch or commits at
  build time (`gh api .../branches` against `AusPosRest/restiq-backend`
  checked - a parallel agent was building it concurrently, not yet pushed);
  unlike CAP-7's story, this story's `docs/specs/spec-pos-cashier-waiter/`
  SPEC.md and screens.md *were* reachable from the sibling `restiq-design`
  repo this time, so the contract and design basis is doubly grounded (SPEC
  CAP-9 + the real P10 mock), self-authored and documented in full in
  `refund-state.ts`'s and `api.ts`'s file headers. 16 new tests (10
  pure-logic in `refund-state.test.ts`, 6 screen integration in
  `refund-view.test.tsx` covering partial-selection totals, the manager-PIN
  gate blocking submission until both PIN and reason are present, a rejected
  PIN leaving the config panel untouched, a successful refund showing the
  credit note with the original bill never re-fetched or mutated, and a
  non-finalised bill showing no refund controls), 642/642 passing repo-wide;
  lint/typecheck/build clean. No live backend reachable for CAP-9, so
  verification is entirely the stubbed-fetch suite above, same posture as
  every other POS story built ahead of its own backend. See
  [wiki/features/pos-cashier-waiter.md](../features/pos-cashier-waiter.md)
  for the full writeup.

- **2026-08-29** - QR Self-Order story 1: guest welcome and session PIN
  screens (CAP-1). New fifth auth realm `/qr` (`aud: guest`, `guest_session`
  httpOnly cookie, `src/lib/guest-session.ts`'s `decideGuestRoute` wired into
  `src/proxy.ts`) - the first RESTIQ realm whose principals aren't staff.
  Table-QR entry URL `/qr/t/[outletId]/[tableId]` resolves the `qr_ordering`
  capability gate and session-open status server-side before rendering
  anything, so a disabled outlet always gets the warm "please order with our
  staff" page (`unavailable-view.tsx`), never the menu. Q1 Welcome + Q2
  Session PIN ship as one client component (`welcome-flow.tsx`) with a
  single mode picked by live session state - name+phone "Start ordering"
  (auto-proceeding straight to a large shareable PIN, no ceremony) when no
  session is open, or name + 4-digit auto-submitting keypad "Join your
  table" when one is - plain inline errors on a wrong PIN, WCAG 2.1 AA
  basics (labeled fields, focus rings, `aria-live` convergence region).
  `src/app/qr/auth/{start,join}/route.ts` and `src/app/qr/api/[...path]/route.ts`
  mirror the POS realm's auth-exchange and pass-through patterns. Backend
  counterpart (issue #68/`feature/68-guest-session`) had no reachable branch
  at build time and this worktree has no access to the `restiq-backend`
  checkout, so the `/guest/v1/*` contract is built against
  `spec-qr-self-order/SPEC.md` alone and flagged NOT YET RECONCILED - see
  [wiki/features/qr-self-order.md](../features/qr-self-order.md)'s
  "Backend contract" section for the exact assumed shapes and the
  reconciliation action for the next Q-screen story. 39 new tests (route
  handlers, `decideGuestRoute`, pure flow-state helpers, `fetchTableStatus`,
  the server-rendered entry page's capability/not-found branches, and the
  `WelcomeFlow` component covering start-lands-on-PIN, join
  success/wrong-PIN, and a11y basics), 685/685 passing repo-wide;
  lint/typecheck/build clean. Issue AusPosRest/restiq-web#64.

- **2026-08-29** - QR Self-Order CAP-1: reconciled against the real, merged guest
  backend contract (restiq-backend PR #69). The biggest guess was wrong: there is no
  per-table session-status endpoint, only a per-outlet `GET /guest/v1/outlets/:id/
  availability` gate check - `table-status.ts` deleted, replaced with `availability.ts`.
  `welcome-flow.tsx`/`welcome-flow-state.ts` now show both "Start ordering" and "Join
  your table" affordances up front and flip modes reactively from real error codes
  (start 409 `session_already_open` -> join mode; join 404 `no_open_session` -> start
  mode), each with an explicit test. Fixed real status/code mismatches throughout
  (`types.ts`, routes, tests): wrong PIN is 403 `invalid_pin` not 401, join lockout is
  429 `locked_out` (5/30s), capability gate is `qr_ordering_disabled` not
  `capability_disabled`, `TableSessionView` matches the real richer shape. Confirmed
  permanent gap: the real contract has no outlet-name/table-label lookup pre-session, so
  the welcome screen's header and `unavailable-view.tsx`'s outlet name are gone, not
  retrofitted. Live-verified against restiq-backend's `dev` branch running locally
  (Postgres `restiq_demo`) - start, the real 409->join flip, wrong-PIN 403, successful
  join, the real 404->start flip, and the qr_ordering-disabled unavailable page all
  exercised through the browser against genuine backend responses, not mocks. See
  [wiki/features/qr-self-order.md](../features/qr-self-order.md)'s "Reconciliation"
  section for the full writeup. 6 new/changed test files, 692/692 passing repo-wide;
  lint/typecheck/build clean. PR AusPosRest/restiq-web#65 (issue #64).

- **2026-08-29** - Kitchen Display (KDS) story 2: `/kds` shell and K1 station
  queue (CAP-2). New sixth surface that reuses the `pos` auth realm verbatim
  (`src/proxy.ts` routes `/kds/:path*` through the same `decidePosRoute` as
  `/pos`, redirecting to the existing `/pos/login?next=/kds/...`;
  `sanitizePosNextPath` widened to accept `/kds`), plus
  `/kds/api/[...path]` passing through to the real, merged
  `/kitchen/v1/*` (restiq-backend PR #70, issue #67 - read directly, not
  guessed). Station picker persisted per browser (`localStorage`), a quiet
  shared header (`KdsHeader`) with Station/Expo/Bumped/All-Day nav (the
  latter three are real routes rendering `ComingSoon` placeholders for
  stories 3-5), and K1: oldest-left `TicketCard` columns on a ~5s poll,
  client-computed ageing colors (blue/yellow/red) that flip between polls,
  ADD-ON section separation, struck-through red VOID lines, a real-data
  RECALLED banner, and single-tap Bump/Recall/Refire with a per-ticket
  pending lock and one automatic retry on failure. Stale board stays on
  screen through poll failures with a "Reconnecting - last updated Xs ago"
  notice. See [wiki/features/kitchen-display.md](../features/kitchen-display.md)
  for the full shell/poll/API conventions established for K2-K4, and its Key
  decisions for the documented gaps (no second ageing threshold field in the
  real schema, no server-attribution or per-ADD-ON-batch fired time in the
  real `TicketView`, no live-backend run available in this build's
  environment). 6 new test files (pure ageing/grouping/sort logic, the
  station-picker persistence flow, the API pass-through route, and a
  fake-timer integration suite covering oldest-left rendering, ageing
  threshold crossings, ADD-ON/void rendering, bump/recall/refire wiring, and
  poll-failure stale-board behavior), 737/737 passing repo-wide;
  lint/typecheck/build clean. PR AusPosRest/restiq-web#69 (issue #66).
