# POS Cashier & Waiter (Web Prototype) - web

Frontend for the `/pos` realm (SPEC's AD-13): a fourth disjoint auth realm, deliberately
not device-bound, standing in for the real native Android POS Core Loop target (see
`restiq-design/docs/specs/spec-pos-cashier-waiter/SPEC.md`'s "Why" for the logged
deviation). See that SPEC for the full capability set (CAP-1..11),
`restiq-design/docs/specs/spec-pos-cashier-waiter/stories.yaml` for the 11-story build
order, and `restiq-design/docs/ux/ux-pos-cashier-waiter-2026-08-25/` (DESIGN.md,
EXPERIENCE.md) for the design system and behavioral spine; this doc tracks what's
actually built here, story by story. Backend counterpart:
`restiq-backend/wiki/features/pos-cashier-waiter.md` (once it exists).

## CAP-1 - PIN login and shift clock (story 1)

- **Intent:** staff authenticate at a shared device with a 4-digit PIN; 5 wrong attempts
  locks that PIN for 30 seconds with a real countdown; a correct PIN starts a `pos`-realm
  session and records a clock-in event if none is open for that staff member today; a
  tenant with more than one outlet is prompted to pick one right after PIN entry.
- **Built:**
  - **Realm wiring** (AD-13, mirrors `/admin`'s AD-10 wiring exactly): `src/lib/pos-session.ts`
    (`pos_session` httpOnly cookie, 12h max-age matching the real backend's
    `POS_SESSION_TTL_SECONDS`; `decidePosRoute` shares the JWT-expiry check via
    `src/lib/session-token.ts`, same as `ops-session.ts`/`admin-session.ts`; a second
    `pos_staff` httpOnly cookie carries just the display name/outlet name the shell needs,
    since the real backend has no session read-back endpoint - see below). `src/proxy.ts`
    branches on `/pos` alongside the existing `/ops`/`/admin` branches. Public without a
    session: `/pos/login` and the `/pos/auth/login` / `/pos/auth/select-outlet` route
    handlers. `src/app/pos/api/[...path]/route.ts` mirrors `/admin/api`'s pass-through
    (attaches the `pos_session` cookie's JWT as a bearer token to
    `${NEXT_PUBLIC_API_URL}/pos/v1/*`).
  - **P1 PIN Login** (`/pos/login`, `src/app/pos/login/`): a full-screen numeric keypad
    (`pin-pad.tsx`), auto-submitting once 4 digits are entered (the design's keypad grid
    has no explicit confirm key) rather than requiring a separate submit tap.
    Physical-keyboard digit/Backspace input works alongside on-screen taps
    (EXPERIENCE.md's Accessibility Floor). Pure state/countdown math lives in
    `pin-login-state.ts` (`appendDigit`, `backspacePin`, `secondsRemaining` - mirrors
    `devices-state.ts`'s enrolment-code countdown math) so it's unit-tested without a DOM.
    Three states: entering a PIN, choosing an outlet, or locked out.
    - **Wrong PIN:** inline error with the backend's message, PIN cleared, no redirect.
    - **Lockout:** the real backend enforces a fixed 30-second window per
      `(tenantId, pin)` pair but doesn't echo a `lockedUntil` timestamp back, so the
      client times its own countdown from the moment the `429` arrives, using the same
      30s constant the backend's `lockout.ts` hardcodes - the keypad disabled/hidden
      behind a "Terminal locked" panel until real elapsed time says it's expired, at
      which point the screen resets to entering-pin on its own.
    - **Outlet picker:** only rendered when the backend returns
      `status: "select_outlet"` (a multi-outlet tenant - single-outlet tenants never see
      it, SPEC constraint). Resubmits the backend-issued short-lived `pendingToken` plus
      the chosen `outletId` to `POST /pos/auth/select-outlet` - a dedicated second step,
      not a re-post to the login endpoint.
  - **Shift chrome** (`src/app/pos/(shell)/`): a lightweight persistent top bar
    (`shift-bar.tsx`) is this story's whole shell - later stories add table map/order-taking
    nav alongside it, same layering as `/admin`'s `(shell)` group. The shell layout reads
    the `pos_staff` cookie server-side and passes the staff/outlet display down as a prop,
    so a page reload keeps showing the right name with no client fetch and no invented
    `/pos/v1/auth/me` endpoint. Shows the staff name, the outlet name, a single "Clock Out"
    control (`POST /pos/api/clock/out`, then signs out and returns to `/pos/login`), and a
    separate Sign out action - the real backend has no clock-in toggle (clock-in is
    automatic on login, once per local calendar day), so there is no "Clock In" state to
    render here. A mocked "Online" status pill (green, `title="... (demo)"`) appears here
    and on the login screen's brand panel, per EXPERIENCE.md's no-fake-telemetry pattern -
    honestly marked, never claiming to be live connectivity telemetry.
  - **Landing after login** (`/pos`, `src/app/pos/(shell)/page.tsx`): EXPERIENCE.md routes
    a successful login to the Table Map (dine-in) or QSR Counter (counter-only outlets) by
    outlet capability - neither exists inside this shell yet (later stories, CAP-2/CAP-6;
    CAP-2's table map already exists as its own route tree, see below), so this story lands
    on a `ComingSoon` placeholder *inside* the real shell (shift bar included) rather than a
    route that 404s.
  - **Theme:** `.pos-theme` added to `src/app/globals.css`, same charcoal+amber ground as
    Console Dark/Tenant Admin with POS's own fixed status vocabulary
    (`--status-available/occupied/warning/alert/reserved` - DESIGN.md: never repurposed for
    anything decorative).
- **Verified against the real backend contract.** `restiq-backend`'s
  `feature/44-pos-auth-clock` branch (real, pushed, this story's own backend counterpart -
  not yet merged to `restiq-backend/dev`) was read directly: `src/pos/auth/auth.dtos.ts`,
  `auth.controller.ts`, `auth.service.ts`, `clock.controller.ts`, `clock.service.ts`,
  `lockout.ts`. `POST /pos/v1/auth/login { tenantId, pin }` returns either
  `{ status: "authenticated", token, staff, outlet }` or `{ status: "select_outlet",
  pendingToken, staff, outlets }`; `POST /pos/v1/auth/select-outlet { pendingToken,
  outletId }` resolves the second step the same way; `POST /pos/v1/clock/out` (bearer-authed)
  is the only clock write CAP-1's UI makes. This story's original guessed contract (see Key
  decisions) has been reconciled against these real shapes - `requiresOutletSelection`,
  the login-time `clockedIn`/`clockedInAt` fields, `clock/toggle`, and `auth/me` never
  existed on the real backend and have been removed from the web code entirely.
- **Tests:** pure logic (`pin-login-state.test.ts`), full component tests
  (`pin-pad.test.tsx`, `shift-bar.test.tsx`) against the real contract shapes above, and the
  route handlers' own tests (`login/route.test.ts`, `select-outlet/route.test.ts`,
  `pos-session.test.ts` for the route guard, including the two new public paths).

## CAP-2 - Table map and order ownership/transfer (story 3)

- **Intent:** staff sees live per-table status (empty/occupied/needs-bill) and opens or
  claims a table's order; a second staff member can never silently edit an order already
  owned by someone else - they must go through an explicit transfer action naming the new
  owner (SPEC CAP-2 success criterion; EXPERIENCE.md's Priya flow).
- **Built:** P2 Table Map (`src/app/pos/table-map/`, routed at `/pos/table-map`). A grid
  of `TableTile`s (`table-shape.tsx`, DESIGN.md's `TableShape` component) grouped by floor
  tabs, color-coded by status per DESIGN.md's fixed semantic palette (green=available,
  blue=occupied, amber=needs-bill) with the status name always rendered as visible text
  alongside the color (`table-tile-status-{id}`) - the Accessibility Floor's "color is
  never the only signal" rule, verified by a test that reads the text label directly, not
  just the color class. Tap routing is a pure function (`deriveTapAction` in
  `table-map-state.ts`, unit-tested in isolation): an empty table starts a new order
  (`POST tables/:id/start-order`); a table the current staff member already owns opens
  directly; a table owned by someone else routes to `TransferOwnershipDialog`
  (`transfer-ownership-dialog.tsx`) instead of opening - named "Transfer ownership - Table
  {label}", the current owner named in the body, a reason field that's optional (transfer
  is audited but isn't one of CAP-8's six manager-gated actions, so no PIN and no required
  reason). Confirming calls `POST orders/:id/transfer` and only then opens the order.
  Starting, opening, or transferring all navigate to `/pos/orders/[orderId]`
  (`src/app/pos/orders/[orderId]/`), a deliberately minimal placeholder (`order-stub.tsx`)
  that fetches and shows the table label and owner - enough to prove the id/ownership
  round-trip works end to end without building any real order-taking yet.
  `needs_bill` is modeled as a real status value (color, label, tile rendering all exist
  for it) but nothing in this story's own UI can ever set it - no fake trigger was added
  just to demonstrate the color, matching the no-fake-data discipline the CAP-8 dashboard
  established.
- **Realm plumbing added by this story** (didn't exist before it - see Integration points):
  `src/lib/pos-session.ts` (`pos_session` cookie, `decidePosRoute`, mirrors
  `admin-session.ts`/`ops-session.ts`), `src/proxy.ts` gating `/pos/:path*` alongside
  `/admin`/`/ops`, `src/app/pos/api/[...path]/route.ts` (bearer-forwarding pass-through to
  `${NEXT_PUBLIC_API_URL}/pos/v1/...`, mirrors `admin/api/[...path]/route.ts`),
  `src/app/pos/layout.tsx` (own Hanken Grotesk/Inter/Public Sans fonts) and a `.pos-theme`
  block in `globals.css` with DESIGN.md's exact color tokens
  (`status-available/occupied/warning/alert/reserved`).
- **Backend not available at build time.** `restiq-backend#46` ("Table map and order
  ownership/transfer") had no branch and no commits when this was built - confirmed by
  reading the actual `restiq-backend` working tree (`git branch -a`, `git log`), not a
  summary. The only table-shaped model anywhere is `DiningTable` (Tenant Admin's
  floor-plan work, CAP-5) - no `Order` model, no `/pos/v1` module at all. Table status is
  therefore modeled as *derived* from whether an open `Order` exists for a table, never a
  stored column on `DiningTable` itself, per stories.yaml's explicit "reuse Floor/
  DiningTable read paths - do not duplicate the table model." Self-authored contract (see
  `table-map/table-map-state.ts`'s file header for the full reasoning): `GET
  /pos/v1/table-map` -> `{ outletId, currentStaff, floors, tables }`; `POST
  /pos/v1/tables/:id/start-order`; `POST /pos/v1/orders/:id/transfer` (`{ reason? }`);
  `GET /pos/v1/orders/:id`. **Must be reconciled against the real restiq-backend#46 DTOs
  once that lands** - same discipline as `wiki/features/tenant-admin.md`'s CAP-8 dashboard
  reconciliation.
- **CAP-1 (story 1, PIN login, issue #38) also not available at build time** - its branch
  existed but had zero POS-specific commits when this story was built, so there was no
  real `/pos/login` screen yet to issue a `pos_session` cookie through, and `pos-session.ts`/
  `proxy.ts` gated every `/pos` route behind a real session check that had nowhere to redirect
  to besides a 404. **Resolved by story 1 above**: a real `/pos/login` now exists, the login
  and select-outlet route handlers issue a real `pos_session` cookie carrying the same `sub`
  claim shape `pos-session.ts` already assumed, and every `/pos` route (including this
  story's table map) redirects to a working login screen.
- **Tests:** 32 new tests - pure logic (`table-map-state.test.ts`: tap-routing including
  the "never silently opens someone else's order" case, floor grouping, elapsed-time
  formatting), the pass-through route's auth/forwarding (`route.test.ts`), and full
  component tests (`table-map.test.tsx`, `order-stub.test.tsx`: loading/error states,
  status color+label rendering, start/open/transfer/cancel flows, `pos-session.test.ts`
  for the route guard). 467/467 tests passing repo-wide; lint/typecheck/build clean.
- **Live verification:** none possible (no backend, no `/pos/login` to authenticate
  through). Verified entirely via the test suite above, stubbing global `fetch` against
  the self-authored contract - the same convention every other realm's component tests
  already use, so nothing here depends on the proxy or a real cookie.

## CAP-3 - Order taking with modifiers, variants (story 4)

- **Intent:** staff builds an order via grid/category/search, configuring modifier groups
  per item; a line violating a modifier group's min/max can't be added, and every line
  records which staff member added it (SPEC CAP-3 success criterion).
- **Built:** replaced story 3's `order-stub.tsx` placeholder outright, in the same route
  (`/pos/orders/[orderId]`, `src/app/pos/orders/[orderId]/`) it explicitly told story 4 to
  build into - no second order route was created.
  - **`order-taking-state.ts`** - all modifier-group min/max validation, variant/price
    resolution, and grid search/category filtering as pure functions (unit-tested in
    `order-taking-state.test.ts`, 28 tests), mirroring `table-map-state.ts`'s split
    between logic and UI. `itemNeedsModifierSheet(item)` decides the one behavioral fork
    the task called for: an item with no variant to pick and no modifier group to
    configure (e.g. Butter Naan) adds straight to the order on a single tap, no sheet;
    anything with a variant or a modifier group (required or optional) routes through the
    sheet.
  - **P4 `ModifierSheet`** (`modifier-sheet.tsx`) - bottom sheet, a variant chip row (if
    the item has variants) plus one chip-group block per modifier group, each with a
    visible `Required · choose N` / `Optional · up to N` badge
    (`modifierGroupBadgeLabel`). A `maxSelections <= 1` group is single-select (a new chip
    replaces the old one); a `maxSelections > 1` group is a capped multi-select (a tap past
    the cap is silently ignored, any selected chip can always be removed). The confirm
    button (`modifier-sheet-confirm`) is disabled, never hidden, until the variant (if any)
    and every required group are satisfied (`canConfirmSelection`) - EXPERIENCE.md's
    Component Patterns rule, verified directly by a test that drives the button through
    unsatisfied -> variant-only -> fully-satisfied. Special instructions (free text) and a
    quantity stepper round out the sheet; confirm reports `{variantId, modifierIds,
    quantity, specialInstructions}` back to the caller, which is all the caller needs to
    build the API's `AddOrderLineInput`.
  - **P3 order-taking screen** (`order-taking-view.tsx`) - a category-tab rail (left) +
    item grid (`pos-item-tile.tsx`, `POSItemTile`: name, resolved price, "86'd" label for
    an unavailable item shown-disabled rather than hidden) + a running `OrderPanel`
    (right rail: line items, per-line qty +/-/remove, running total, "Added by {staff}" on
    every line). A search bar searches every category at once (ignoring the active tab)
    once a query is typed, falling back to the active tab when empty. Two independent GETs
    (`orders/:id`, `menu`) land the screen through the same five-state
    skeleton/error/loaded pattern as every other `/pos` screen. Quantity +/- calls
    `PATCH .../lines/:lineId`; decrementing a qty-1 line calls
    `DELETE .../lines/:lineId` instead of sending `quantity: 0`.
  - **`OrderPanel`'s total has no tax/discount line** - CAP-7 Bill & Settle owns tax
    breakdown and discounts (SPEC.md), so this screen shows a real, honestly-computed sum
    of line totals and a one-line note ("Tax and discounts apply at Bill & Settle")
    instead of fabricating a GST rate the P3 mock shows but no tenant setting backs yet -
    same no-fake-data discipline as the owner dashboard and CAP-1's mocked-status chips.
  - **`POSItemTile`'s veg/non-veg dot (DESIGN.md) is omitted** - the real `MenuItem` model
    has no dietary-type field (only free-form tenant-defined `Allergen` tags), so nothing
    reliable exists to derive it from; guessing from an allergen tag's name would be
    exactly the kind of fabricated-looking data this codebase's honesty pattern forbids.
  - **Combos (also named in stories.yaml story 4's title) are out of scope for this
    pass** - the task's own build list and test plan never call for them, and a combo is a
    meaningfully different concept (a bundle of items) from a single `OrderLine`. Flagged
    here as an explicit, documented gap rather than silently dropped.
- **Backend not available at build time, verified via the real GitHub tree, not a stale
  local checkout.** `restiq-backend#52` ("Order taking with modifiers, variants, combos")
  has no branch and no commits (`gh issue view 52`/`gh api .../branches` against
  `AusPosRest/restiq-backend`, both confirming it's unstarted). The local `restiq-backend`
  working tree on disk was **6 commits behind** the real `origin/dev` when checked (missing
  `src/pos` entirely on disk) - reading `gh api repos/AusPosRest/restiq-backend/contents/...
  ?ref=dev` directly instead confirmed the real, currently-merged state: story 3's `Order`
  model is exactly base-fields-only as promised (`{id, tenantId, outletId, tableId,
  ownerId, status: open|sent|closed, createdAt, updatedAt}`, no `OrderLine` anywhere), and
  `PosOrdersController` only exposes table-map/get/status/transfer - no `/lines` endpoint,
  no `/pos/v1/menu` read. This story's self-authored contract
  (`order-taking-state.ts`/`api.ts`'s `fetchMenu`/`fetchOrderDetail`/`addOrderLine`/
  `updateOrderLineQuantity`/`removeOrderLine`) fills exactly that gap - `OrderView` keeps
  restiq-web's own already-shipped display shape (`tableLabel`/`ownerStaffName`/
  `status: occupied|needs_bill`) rather than the real bare `Order` row's raw
  `tableId`/`ownerId`/`open|sent|closed`, since the real row has no display names to hand
  back at all (see `order-taking-state.ts`'s file header for the full reasoning, including
  a flagged-but-out-of-scope observation that story 3's own already-shipped status
  vocabulary doesn't match the real `Order.status` enum either - a pre-existing CAP-2 gap,
  not this story's to fix).
- **Tests:** 45 new tests - pure logic (`order-taking-state.test.ts`, 28: modifier-group
  min/max, single-vs-multi-select toggling, variant/price resolution, category+search
  filtering), a full component suite for the sheet (`modifier-sheet.test.tsx`, 7: badge
  copy, confirm-button gating through every unsatisfied/partial/satisfied state,
  single-select swap, multi-select cap, the exact confirm payload shape, cancel), and a
  full integration suite for the screen (`order-taking-view.test.tsx`, 10, stubbing global
  `fetch` against this story's self-authored contract, same convention as
  `table-map.test.tsx`): loading/error states for both GETs independently, a no-modifier
  item adding directly with no sheet, a required-modifier item blocking add until
  satisfied, the order panel updating as lines are added, qty increment/decrement
  (including decrement-to-zero calling `DELETE`, not `PATCH .../{quantity:0}`), and search
  finding an item outside the active category tab. 573/573 tests passing repo-wide;
  lint/typecheck/build clean.
- **Live verification:** none possible - same constraint as CAP-2/CAP-10 above, now
  additionally confirmed by reading the real `dev` branch directly rather than assuming
  from a stale local checkout (see above): no `/pos/v1/menu` or `/lines` endpoint exists
  anywhere to verify against yet. Verified entirely via the 45 tests above, stubbing
  global `fetch`.

## CAP-4 - Group ordering (story 5, issue #52)

- **Intent:** staff can split one table's order into named seats/covers for later
  per-seat billing; every item must be assigned to a seat number before the order can be
  sent to the kitchen - unassigned items block fire (SPEC CAP-4 success criterion).
- **Built:** extends story 4's order-taking screen and panel in place - EXPERIENCE.md's
  IA calls this "optional seat-splitting, reached from the order panel's 'Split by seat'
  action", not a separate P5 route, so that's exactly what got built (P5's full
  per-seat-subtotal/split-options screen belongs to CAP-7 Bill & Settle, out of scope
  here per YAGNI - only the seat picker and the fire-gate were asked for).
  - **`order-taking-state.ts`** - `OrderLineView.seatNumber?: number | null` and
    `OrderView.firedAt?: string | null` (both optional, not just nullable, so story 4's
    already-shipped literals/tests keep type-checking with no edits). Pure logic:
    `allLinesSeated`/`unseatedLineCount` (vacuously true/0 for an order with no lines -
    nothing to block yet) and `canSendToKitchen` (also requires at least one line and
    that the order hasn't already fired), unit-tested in `order-taking-state.test.ts`
    (12 new tests).
  - **`OrderPanel`** (`order-panel.tsx`) - a "Split by seat" toggle in the panel header
    (`split-by-seat-toggle`, hidden on an empty order) reveals a per-line seat stepper
    (`order-line-seat-{id}`, `-increment-`/`-decrement-`) reusing the exact same
    Minus/Plus tap-target pattern already built for the quantity stepper, per ponytail's
    reuse-over-rewrite rung rather than inventing a new control. Decrementing seat 1
    clears the line back to "Unseated" (`seatNumber: null`) instead of stopping at 1, so
    a mis-tap is always reversible without a separate "clear" affordance.
  - **"Send to kitchen"** (`send-to-kitchen`) - a new footer action (this action didn't
    exist anywhere in the UI before this story). Disabled, never hidden, while
    `!canSendToKitchen(order)` - EXPERIENCE.md's Component Patterns convention (same as
    ModifierSheet's confirm button). While blocked by an unseated line, an inline message
    (`send-to-kitchen-blocked`) names the fix at the point of the violation ("N items need
    a seat before sending to the kitchen"), with an inline link back to the seat toggle if
    it isn't already open - Voice and Tone's "name the fix, not the failure mode" and
    State Patterns' "block forward progress at the point of the violation, not after a
    later submit". Once fired, the button reads "Sent to kitchen" and stays disabled - a
    quiet success state, no toast (EXPERIENCE.md State Patterns).
  - **`OrderView.status` was deliberately left untouched** - it already diverges from the
    real `Order.status` enum (a pre-existing CAP-2/CAP-3 gap, flagged in story 4's own
    section above) and piling CAP-4's "sent to kitchen" concept onto that mismatched field
    would compound the gap instead of isolating this story's addition. `firedAt` is a new
    field instead, following the same insert-only ISO-string convention already used for
    `openedAt`/`createdAt`.
- **Backend contract - built against the real, merged CAP-3 endpoints, anticipating
  issue #58's still-unbuilt extension.** `restiq-backend#58` ("Group ordering - seats and
  covers", branch `feature/58-group-ordering`) has no branch or commits as of this build
  (`gh api repos/AusPosRest/restiq-backend/branches` lists only `dev`/`main`/
  `feature-15`; `gh issue view 58` confirms open/unstarted - a parallel agent was building
  it concurrently but hadn't pushed anything). What's real and directly verified off
  `restiq-backend`'s `dev` (`orders.controller.ts`/`orders.service.ts`/`orders.dtos.ts`,
  read via `gh api .../contents/...?ref=dev`, story 4's PR #57, merged): `PATCH
  /pos/v1/orders/:orderId/status {status}` already exists and already accepts
  `status: 'sent'` (forward-only `open -> sent -> closed`, owner-only) with no seat-gate
  yet; `PATCH /pos/v1/orders/:orderId/lines/:lineId` is real too, but `UpdateOrderLineDto`
  today only carries `quantity`/`modifierIds`, no `seatNumber`. Issue #58's own framing
  ("extends story 4's real, merged line add/edit endpoints with an optional seatNumber
  field") is taken at face value: this story's `assignSeat`/`sendOrderToKitchen`
  (`src/app/pos/api.ts`) call those exact same real endpoints/methods, only anticipating
  the request/response fields (`seatNumber`, `firedAt`) that #58 hasn't added yet. **Must
  be reconciled once #58 lands** - same discipline as CAP-3's own reconciliation notes.
- **Tests:** 16 new tests - 12 pure-logic (`order-taking-state.test.ts`:
  `allLinesSeated`/`unseatedLineCount` across empty/fully-seated/partially-seated/
  missing-field orders, `canSendToKitchen` across no-lines/unseated/fully-seated/
  already-fired) and 4 integration (`order-taking-view.test.tsx`, stubbing global `fetch`
  same convention as story 4): assigning a seat updates the line and posts the exact
  `{seatNumber}` body; an unseated line disables "Send to kitchen" with the inline
  message; sending succeeds once every line is seated and the button flips to "Sent to
  kitchen"; an empty order hides the seat toggle and keeps "Send to kitchen" disabled with
  no message (nothing to block yet). 611/611 tests passing repo-wide; lint/typecheck/build
  clean.
- **Live verification:** none possible - same constraint as CAP-3 above. Verified
  entirely via the 16 tests above, stubbing global `fetch` against the anticipated
  contract described above.

## Integration points for later stories

- **Story 4 (CAP-3, order taking, P3/P4) - done, see its own section above.**
- **Story 5 (CAP-4, group ordering/seats) - done, see its own section above.** Story 8
  (CAP-7, bill & settle) builds directly on story 4/5's `OrderLine`/`OrderView` shape
  (`order-taking-state.ts`, now including `seatNumber`/`firedAt`) - read that file's
  actual shape before extending it, per stories.yaml's own warning that field names may
  have shifted during that story's build.
- **Story 8 (CAP-7) owns tax breakdown and discounts** - story 4's `OrderPanel`
  deliberately shows only a line-total sum, no GST/discount line (see CAP-3's Built
  section above for why).
- **Story 6 (CAP-5, open/held orders) - done, see its own section below.** It calls
  story 3's `transferOrder` action (`src/app/pos/api.ts`) directly for take-over, per
  stories.yaml: "reused, not reimplemented."
- **`.pos-theme` / `pos-session.ts` / `/pos` proxy wiring / `src/app/pos/layout.tsx`** were
  added independently by both story 1 and story 3 (neither existed when either story
  started) and have since been reconciled into one implementation - see Key decisions.
- **Table map still doesn't get the persistent shift bar** since it isn't nested under the
  `(shell)` route group story 1 added - whoever builds the real post-login routing (Table
  Map / QSR Counter replacing the `ComingSoon` placeholder, per EXPERIENCE.md's Information
  Architecture) should fold `/pos/table-map` under `(shell)` at that point rather than
  leaving parallel shells. `/pos/shift` and `/pos/shift/close` (CAP-10, story 2) already made
  this move during their own reconciliation - see that section below - as the concrete
  precedent to follow.
- **`restiq-backend#46` has since landed** (`feature/46-table-map-ownership`, merged to
  `dev` as PR #49) but has **not** been reconciled here yet - noticed while reading the
  real `dev` tree for this story's own CAP-3 work (see that section below), not acted on,
  since reconciling CAP-2 is outside this story's scope. For whoever picks this up: the
  real `Order` row is `{id, tenantId, outletId, tableId, ownerId, status: open|sent|
  closed, ...}` (no display names) and `PosOrdersController`'s table-map read is
  `GET /pos/v1/outlets/:outletId/table-map` (outlet-scoped in the path, not a query param) -
  both differ from `table-map-state.ts`/`api.ts`'s current self-authored guess
  (`ownerStaffName`/`ownerStaffId` inline on the table entry, `occupied`/`needs_bill`
  status, no outlet segment in the table-map URL).
- **Real tenant/outlet terminal scope is still an open question.** CAP-1's login has no
  tenant-picker step and a pos session isn't device-bound (AD-13), so the web app has no
  way to learn which tenant a terminal belongs to; `POS_TENANT_ID` (a server-only env var
  read only by the login route handler) is the concrete placeholder until real multi-tenant
  terminal provisioning is designed.

## Key decisions

- Table status is derived (empty/occupied/needs_bill from whether an open `Order` exists),
  never a column added to `DiningTable` - keeps this story from duplicating the table
  model story 3 was told explicitly to reuse, not rebuild.
- `needs_bill` is a real, fully-rendered status with no way to reach it yet in this story's
  own UI - modeled honestly rather than either omitting it (SPEC names it explicitly) or
  faking a trigger for it.
- Transfer has an optional reason, not a required one, and no PIN gate - stories.yaml is
  explicit that transfer is audited but isn't one of CAP-8's six manager-gated actions.
- The ageing/elapsed-time threshold (15 minutes) is a documented assumption, same pattern
  as SPEC.md's own Open Questions on the discount-above-threshold amount - no real tenant
  setting exists for it yet.
- **CAP-1's login/clock UI now calls the real `restiq-backend` contract** (see CAP-1
  above) rather than the guess it originally shipped with. The guess assumed
  `{ pin, outletId? }` resubmission with no pending-token concept, login-time
  `clockedIn`/`clockedInAt` fields, a `clock/toggle` write, and an `auth/me` read-back -
  none of which the real backend has. All four have been removed; the real
  `pendingToken`/`select-outlet` handshake and `clock/out`-only write replace them.
- **No tenant/outlet-set selection before PIN entry**, and the real backend's
  `PosLoginDto` requires an explicit `tenantId` - `POS_TENANT_ID` (server-only env var) is
  the concrete stand-in for "this terminal deployment belongs to this tenant" until real
  multi-tenant terminal provisioning exists (see Integration points).
- **Lockout has no server-echoed `lockedUntil`** - the real backend's 30s window
  (`lockout.ts`'s `LOCKOUT_MS`) is a fixed constant, not part of the response, so the
  client times its own countdown against that same constant from the moment the `429`
  arrives.
- **Shift-bar staff/outlet display comes from a second httpOnly cookie (`pos_staff`), not
  a session read-back endpoint** - the real backend has no `/pos/v1/auth/me`, so rather
  than inventing one, the login/select-outlet route handlers persist exactly what the
  login response said (never fabricated) alongside the session cookie, and the `(shell)`
  layout reads it server-side. This keeps the "reload always shows real state" property
  the guessed design wanted without a backend endpoint that doesn't exist.
- **Left brand panel on P1 shows a live device clock, not outlet/terminal identity** -
  the design mock shows a fixed outlet name/terminal id/app version in that panel, but
  none of that is knowable before a PIN resolves who's signing in and at which outlet (no
  device binding per AD-13) - showing it would be exactly the kind of fabricated-looking
  data EXPERIENCE.md's honesty pattern forbids. Kept the brand mark, live clock/date, and
  the two mocked status chips; dropped the outlet-specific text.
- **PIN auto-submits at 4 digits rather than a separate confirm tap** - the design's
  keypad grid (`1-9`, `0`, backspace) has no dedicated confirm key, and EXPERIENCE.md's
  voice is "fewest taps to the next state" - matches every common PIN-pad UX convention
  besides.
- **"Clock In / Out" renders as a static caption under the keypad on the login screen**
  (matching the design screenshot's amber label placement), not an interactive control
  there - the actual clock-in event is a side effect of a successful PIN per SPEC's
  success criterion (and, per the real backend, entirely automatic), not a separately
  tapped action at login. The real interactive Clock Out control lives in the post-login
  shift bar, for ending a shift later - there is no Clock In control anywhere in the UI
  since the backend never exposes one.

## Live verification

CAP-1's realm wiring was verified **live** against a dedicated Next dev server during
story 1's own build (proxy redirects, PIN-length validation short-circuiting before any
backend call). The full login/select-outlet/clock-out round trip against a real
`restiq-backend` instance running `feature/44-pos-auth-clock` is the right follow-up once
that branch is deployed somewhere shared - not yet done here. Everything else (correct
PIN, wrong PIN, outlet picker, lockout countdown, shift-bar states including Clock
Out/Sign out, the API pass-through's cookie/bearer-token mechanics, and both auth route
handlers' success/select-outlet/error branches) is covered by mocked-fetch component
tests and pure-logic unit tests stubbed against the real DTOs read directly from
`restiq-backend`'s `feature/44-pos-auth-clock` branch, not a guess.

## CAP-10 - Shift & cash management (story 2)

- **Intent:** staff opens a shift with a starting float, logs cash movements
  (paid-outs, bank drops) through the shift each with a reason, and closes it
  with a blind cash count - the counted amount is entered before the system
  reveals the expected amount computed from the shift's transactions, never
  the other order (SPEC CAP-10 / ARCHITECTURE-SPINE AD-14).
- **Built:**
  - `/pos/shift` (`src/app/pos/shift/shift-screen.tsx`, P11 Shift & Cash
    Management, now nested under `src/app/pos/(shell)/` so it gets the real
    persistent shift bar - see Reconciliation below) - five-state pattern:
    skeleton while `GET /pos/api/shifts/current?outletId=...` is in flight,
    inline retry on failure, an `OpenShiftForm` (starting float via the
    shared `AmountKeypad`) when there is no open shift for the session's
    outlet, and a dashboard (opened time, starting float, cash movement log,
    "Log cash movement") once one is open. `CashMovementLog` renders every
    paid-out/bank-drop newest-first with its reason and amount - no per-
    movement staff name (the real backend returns `createdByStaffId`, not a
    name, and there's no staff-directory lookup in scope to resolve it).
    `LogMovementDialog` requires a positive amount and a non-blank reason
    before submit enables - not one of CAP-8's six manager-gated actions, so
    no manager PIN here, just the reason requirement.
  - `/pos/shift/close` (`src/app/pos/shift/close/close-shift-screen.tsx`, P12
    Close Shift - Blind Count) - the story's climax screen. Step 1,
    `BlindCountKeypad`: counted-amount entry only, via the same shared
    `AmountKeypad` component (EXPERIENCE.md: numeric entry never uses the
    OS's native keyboard) - there is no expected-amount field anywhere in its
    props, state, or render output. Step 2, `CloseShiftResult`: an immutable
    reveal (counted/expected/over-short, green for over-or-exact, red for
    short) shown only once `POST /pos/api/shifts/:id/close`'s response
    arrives; no edit or recount action (AD-14: a closed shift's over/short
    record is insert-only once written).
  - **Server-side blindness, not render-order blindness:** `ShiftView`
    (`src/app/pos/api.ts`) - the type every pre-close read/write returns -
    declares no `countedMinor`/`expectedMinor`/`overShortMinor` field at all,
    so there is no variable anywhere in `close-shift-screen.tsx` that could
    hold an expected amount before the count is submitted, even though the
    real backend's actual wire payload carries those three keys as `null` on
    every pre-close response (see Reconciliation below for why that's still
    a meaningful guarantee). The only call that can return a populated value
    is `closeShift()`'s own `POST .../close`, typed as a separate
    `ClosedShift`, stored in state that starts `null` and is set exactly
    once, inside that call's `.then`. See `close-shift-screen.tsx`'s file
    header for the full walkthrough and `close-shift-screen.test.tsx` for the
    test that deep-scans every mocked network response landed before "Submit
    count" is clicked and fails if any of them carries a *populated*
    expected/over-short-shaped field, plus confirms the reveal
    (`close-shift-result` testid) is entirely absent from the DOM until then.
  - `data-testid` on every interactive element (`open-shift-*`,
    `movement-*`, `blind-count-*`, `result-*`, `close-shift-*`); the shared
    `AmountKeypad`/`BlindCountKeypad` also accepts physical keyboard digit/
    backspace/escape input for testing and demo purposes per EXPERIENCE.md's
    Accessibility Floor.
  - The persistent shift bar (`src/app/pos/(shell)/shift-bar.tsx`, story 1)
    now also carries a "Shift" nav link to `/pos/shift`, so every `/pos`
    screen under the shell has a way into shift status and the open/close
    screens, per EXPERIENCE.md's "shift gates the main loop". It's a plain
    link, not a live status fetch: `shift-bar.test.tsx`'s first test asserts
    zero client fetches on mount (staff/outlet display is server-cookie-only,
    deliberately not refetched), so duplicating a shift-status fetch into the
    bar would have broken that already-merged guarantee; the actual open/
    float/closed state instead renders on `/pos/shift` itself, which already
    fetches it for its own dashboard.

## Reconciliation (this story's placeholder auth -> the real `/pos` shell)

Neither issue #38 (base `/pos` shell + real CAP-1 PIN login) nor
restiq-backend#45 (this story's own backend) had landed any commits when this
story started, so it built a self-authored standalone `/pos` auth realm and a
provisional API contract, both explicitly flagged below for reconciliation
once #38 and #45 landed. This section replaces the original "Key decisions"
entries that described that placeholder as forward-looking TODOs - they're
done now, this is what actually happened:

- **Deleted entirely, in favor of story 1's real, merged `/pos` shell:**
  `src/app/pos/auth/dev-session/route.ts` (minted an unsigned, unverified
  session token locally) and `src/app/pos/login/dev-login-button.tsx` (the
  "Continue as demo cashier" button) - `pos_session` is now only ever issued
  by story 1's real `POST /pos/auth/login`/`select-outlet` route handlers.
  `src/app/pos/login/page.tsx` and `src/app/pos/layout.tsx` (this story's
  "PIN login is on its way" placeholder copy and standalone layout) were
  replaced outright with story 1's real PIN keypad page and shell-aware
  layout - nothing from this story's versions survived, since story 1's is
  the real thing, not something to merge with.
- **Kept and extended, unchanged in shape:** `src/lib/pos-session.ts`
  (`pos_session`/`pos_staff` cookies, `decidePosRoute`) and
  `src/app/pos/api/[...path]/route.ts` (the pass-through) are story 1's real
  versions - `/pos/shift` and `/pos/shift/close` only ever depended on
  `POS_SESSION_COOKIE`/`decidePosRoute`/`sanitizePosNextPath` and the
  pass-through's `/pos/api/*` convention, both of which kept working
  unchanged.
- **`src/app/pos/(shell)/shift-bar.tsx` gained a "Shift" nav link and
  `/pos/shift` + `/pos/shift/close` moved under `src/app/pos/(shell)/`** so
  they render inside the real persistent shell instead of keeping a second,
  parallel minimal header - the route group doesn't change the URL, so
  `/pos/shift` and `/pos/shift/close` are unaffected externally.
- **API contract reconciled against the real backend.**
  restiq-backend's `feature/45-shift-cash-management` branch (real, pushed,
  not yet merged to `restiq-backend/dev` - `src/pos/shifts/shifts.
  controller.ts`/`.dtos.ts`/`.service.ts`, read directly) replaced this
  story's self-authored guess in `src/app/pos/api.ts`:
  - `openShift` now takes `{ outletId, floatMinor }` (was `{
    openingFloatMinor }` with no outlet) - `outletId` comes from the signed-in
    session's `pos_staff` cookie, never user-entered.
  - Cash movements post to `POST /pos/v1/shifts/:id/cash-movements` (was
    `/movements`).
  - `closeShift` sends `{ countedMinor }` (was `{ countedCashMinor }`) and
    its response is the real `ShiftView` shape with `countedMinor`/
    `expectedMinor`/`overShortMinor` populated, not a bespoke
    `CloseShiftResult` envelope - typed client-side as `ClosedShift`.
  - `getShift(id)` (`GET /pos/v1/shifts/:id`) was added - the self-authored
    contract never had a single-shift read.
  - `CashMovementView` dropped `staffName` (the real backend returns
    `createdByStaffId`, no display name) - `CashMovementLog` no longer
    renders a per-movement staff name.
  - The blindness guarantee survives in a different, more accurate form: the
    real backend's `ShiftView` always includes `countedMinor`/
    `expectedMinor`/`overShortMinor` keys, just `null` until close, rather
    than omitting them outright. The client-side `ShiftView` type (used by
    every pre-close call) simply doesn't declare those three fields, so no
    component can read a value from them even though the wire payload
    carries the (null) keys - and `close-shift-screen.test.tsx`'s deep-scan
    was updated to flag a *populated* expected/over-short value pre-close,
    not merely the key's presence, since the real contract makes bare key
    presence an expected, harmless artifact rather than a bug signal.

## Key decisions (CAP-10)

- **Money entry never uses the OS numeric keyboard.** `AmountKeypad`
  (`src/app/pos/shift/amount-keypad.tsx`) is a shared calculator-style digit
  grid (press digits to build up minor units, cents-first) used for the
  opening float, a movement's amount, and the blind count - reused rather
  than three separate `<input type="number">` fields, per EXPERIENCE.md's
  "numeric entry always via a large on-screen keypad component" rule.
  `BlindCountKeypad` wraps it with the close-shift-specific submit/error
  affordances DESIGN.md names it for.
- **Realm isolation duplicated a few small admin patterns on purpose.**
  AD-4's lint rule (`app/pos` may not import from `app/admin` or `app/ops`)
  means `src/app/pos/shift/data-states.tsx` (skeleton + load-error panel) and
  `shift-state.ts`'s money formatter are pos's own small copies of the
  equivalent admin/ops helpers, not stray duplication.
- **Currency defaults to INR**, same convention as CAP-4's menu management
  (`menu-management.tsx`'s `CURRENCY` constant) - the real backend's
  `ShiftView` carries no tenant-currency field to read instead.
- Verified **live** in a browser during this story's original build, against
  a temporary local mock backend (not committed) standing in for the real,
  not-yet-landed `restiq-backend#45` - confirmed the full open-shift ->
  log-movement -> close-shift -> blind-count -> reveal loop end to end,
  including that the `GET /pos/api/shifts/current` response the UI receives
  before "Submit count" genuinely carries no *populated* expected/over-short
  field (inspected via the browser's network panel, not just the rendered
  DOM). The reconciliation pass above was verified against the real
  backend's source directly plus the full automated test suite, not a fresh
  live click-through.

## CAP-11 - Device and staff attendance status (story 11)

- **Intent:** staff or a manager can see who is clocked in on this outlet
  today (real CAP-1 clock-in/out events, no fabricated staff or times) plus a
  mocked printer/connectivity status panel, since there is no real hardware
  in this prototype (SPEC CAP-11).
- **Built:** `/pos/status` (`src/app/pos/(shell)/status/`, P13 Device Status &
  Attendance), nested under the real `(shell)` route group from the start so
  it renders inside the persistent shift bar rather than a parallel header -
  no reconciliation needed here, unlike CAP-2/CAP-10 above, since the real
  shell already existed when this story was built.
  - `device-status-screen.tsx`: five-state pattern (skeleton, inline retry,
    content) fetching `GET /pos/api/outlets/:outletId/attendance/today` via
    `usePosLoad`. Two panels: **Attendance today** (`attendance-list.tsx`,
    name + clock-in time, `Out {time}` once clocked out, a real empty state
    - "No one has clocked in ... today" - when the list is genuinely empty,
    never a fabricated row) and **Device status**, DESIGN.md's
    `PrinterStatusChip`/`OfflineIndicatorPill` components rendered against
    the response's `device` field.
  - **The mocked-status honesty pattern is in the DOM, not just a tooltip.**
    Both `printer-status-chip.tsx` and `offline-indicator-pill.tsx` render a
    literal `(demo)` text node next to the status label, in addition to a
    `title="Mocked - no real ... in this prototype (demo)"` attribute -
    `device-status-screen.test.tsx` asserts on `.textContent` for exactly
    this reason (EXPERIENCE.md: "always rendered with a small '(demo)'
    affordance", but this story's own acceptance bar requires the marker be
    asserted in the DOM, not merely present in a comment or only reachable
    via hover).
  - `src/app/pos/(shell)/shift-bar.tsx` gained a "Status" nav link
    (`pos-shift-bar-status-link`) to `/pos/status`, same plain-link shape as
    CAP-10's "Shift" link - the shift bar's zero-client-fetch-on-mount test
    still holds, the actual fetch lives on `/pos/status` itself.
  - `status/data-states.tsx` is this subtree's own `Skeleton`/`LoadErrorPanel`
    copy - `(shell)/data-states.tsx` one level up only exports
    `LoadErrorPanel`, no `Skeleton`, so this follows `shift/data-states.tsx`'s
    already-established precedent of a per-subtree copy rather than reaching
    past the shell-level file or refactoring it for an unrelated story.
- **Backend not available at build time.** The paired backend story
  (restiq-backend issue #54, branch `feature/54-pos-device-status`) had no
  branch and no commits - `gh api repos/AusPosRest/restiq-backend/branches`
  listed only `dev`/`main`/`feature/15-device-fleet`. restiq-backend's `dev`
  branch does have the real `ClockEvent` model and a real clock-out write
  (`src/pos/clock/*`, read directly), confirming CAP-1's clock events are the
  right source of truth, but no endpoint anywhere lists them back out - only
  the write side exists so far. Self-authored contract (see `api.ts`'s CAP-11
  file-header comment for the full reasoning): `GET
  /pos/v1/outlets/:outletId/attendance/today` -> `{ outletId, staff: [{
  staffId, staffName, clockInAt, clockOutAt }], device: { printer,
  connectivity } }`. **Must be reconciled against the real
  restiq-backend#54 DTOs once that lands** - same discipline as CAP-2's
  table-map contract and CAP-1/CAP-10's now-completed reconciliations above.
- **Tests:** `device-status-screen.test.tsx` - real staff render from a
  mocked response (name + clock-in time, plus a clocked-out row rendering
  "Out {time}"), the empty-attendance state, the `(demo)` marker asserted in
  both chips' DOM text and `title`, and the load-error/retry path.
  `shift-bar.test.tsx` extended with the new "Status" link. 534/534 tests
  passing repo-wide; lint/typecheck/build clean.
- **Live verification:** none possible (no real backend endpoint to hit,
  same posture as CAP-2's table map). Verified via the test suite above,
  stubbing global `fetch` against the self-authored contract.

## CAP-5 - Open and held orders, outlet-wide (story 6)

- **Intent:** staff sees every open/held order outlet-wide and resumes their own or takes
  over someone else's - taking over requires the same explicit-transfer action as CAP-2,
  never a silent switch (SPEC CAP-5 success criterion; stories.yaml story 6: "call story
  3's transfer action directly for take-over - this screen is a list view over existing
  Order state, not a new ownership mechanism").
- **Built:** P6 Open & Held Orders (`src/app/pos/(shell)/open-orders/`, routed at
  `/pos/open-orders`, nested under the real shell so it gets the persistent shift bar).
  Pure list/format logic lives in `open-orders-state.ts` (`isOwnOrder`, `originLabel`,
  `elapsedLabel`, `summarize`), unit-tested in isolation same as `table-map-state.ts`. The
  screen (`open-orders-screen.tsx`) is a five-state view over `GET
  /pos/api/outlets/:outletId/orders`: skeleton while loading, inline retry on failure, a
  true empty state ("No open orders") for zero rows, and otherwise a table of every
  non-closed order with its origin (`Table {label}` or `Counter`), server name, status
  (Open / Sent to kitchen - no fabricated "held" status, see Key decisions), elapsed time,
  and item count/total *only when the backend actually provides them* - both render `—`
  rather than crashing or guessing when null, and the footer's running total only sums when
  every row has one (`summarize()`), never a partial/misleading figure. The signed-in
  staff's own orders get a plain **Resume** link straight to the existing
  `/pos/orders/[orderId]` route (story 3's destination, no new endpoint); everyone else's
  orders get a **Take over** button that opens story 3's real, reused
  `TransferOwnershipDialog` (`../../table-map/transfer-ownership-dialog.tsx`) and calls its
  real `transferOrder()` action (`../../api.ts`) on confirm - no second dialog, no second
  transfer endpoint, exactly stories.yaml's instruction.
  - **Reachable from anywhere**, per EXPERIENCE.md's IA: a persistent "Open orders" nav
    link was added to the shell's `shift-bar.tsx` (same plain-link-not-a-fetch pattern as
    the existing "Shift" link) so every `(shell)`-nested `/pos` screen can reach it. The
    table map (`table-map.tsx`) isn't nested under `(shell)` yet (a pre-existing gap - see
    CAP-2's Integration points above), so it doesn't get the shift bar's nav; a second,
    matching link was added directly to its own header for the same reason, rather than
    leaving the table map - the other half of the main loop - unable to reach P6 at all.
- **Backend not available at build time.** `restiq-backend`#53 ("Open and held orders,
  outlet-wide") had no branch and no commits when this story was built - confirmed by
  `git ls-remote` against the real `restiq-backend` remote (only `dev`/`main`/
  `feature/15-device-fleet` existed), not a summary. Self-authored contract (see
  `open-orders-state.ts`'s file header for the full reasoning): `GET
  /pos/v1/outlets/:outletId/orders -> { outletId, orders: OpenOrderEntry[] }`, where each
  `OpenOrderEntry` carries `id, origin ("table"|"counter"), tableLabel, ownerStaffId,
  ownerStaffName, status ("open"|"sent"), openedAt, itemCount, totalMinor` - the last two
  nullable by design. This follows story 3's real, *verified* `GET
  /pos/v1/outlets/:outletId/table-map` shape (outlet id in the path) rather than story 3's
  own still-unreconciled `table-map` guess. **Must be reconciled against the real
  restiq-backend#53 DTOs once that lands** - same discipline as `table-map-state.ts`'s own
  pending reconciliation.
- **Tests:** 22 new tests - pure logic (`open-orders-state.test.ts`: own-order detection,
  table vs. counter origin labels, elapsed-time formatting including a clock-skew case, and
  `summarize()`'s "only sum when every order has a total" rule) and a full component suite
  (`open-orders-screen.test.tsx`: loading/error/empty states, rendering origin/server/
  status/elapsed for a mixed table+counter list, Resume-vs-Take-over branching by
  ownership, the reused transfer dialog's confirm/cancel paths including that a cancelled
  transfer fires no network request, and that a missing item-count/total renders `—`
  without crashing while a complete one sums correctly) plus a nav-link assertion added to
  both `shift-bar.test.tsx` and `table-map.test.tsx`. 556/556 tests passing repo-wide;
  lint/typecheck/build clean.
- **Live verification:** none possible (no real backend for this story or story 3 to run
  against, same posture as CAP-2). Verified entirely via the test suite above, stubbing
  global `fetch` against the self-authored contract - the same convention every other
  not-yet-backed realm story in this doc already uses.

## Key decisions (CAP-5)

- **No fabricated "held" status.** SPEC/UX call this "open and held orders", but the real
  `Order` model (story 3's `orders.service.ts`) only has `open`/`sent`/`closed` - there is
  no distinct "held" state to render. The screen shows every non-closed order (both `open`
  and `sent`) under its real status label instead of inventing a "Held" badge with nothing
  behind it, matching the `needs_bill` honesty precedent CAP-2 already established.
- **Counter-origin orders render `tableLabel: null` as "Counter", not a blank cell** - CAP-6
  (QSR counter mode) isn't built yet, so nothing in this prototype can actually produce one
  today, but the contract models it now since a real Order's `tableId` is nullable (story
  3's own `OrderView`) and stories.yaml's brief explicitly calls for "table or counter
  origin".
- **Item count/total are nullable, not defaulted to 0** - a missing summary must read as
  "not available" (`—`), never as a fabricated real zero, since CAP-3/CAP-4 order-lines and
  pricing may not exist for a given order yet. `summarize()`'s footer total only appears
  once every row actually has one, for the same reason.
- **No new dialog, no new transfer endpoint.** Take-over reuses story 3's
  `TransferOwnershipDialog` and `transferOrder()` verbatim - stories.yaml is explicit this
  screen is "a list view over existing Order state, not a new ownership mechanism."
