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
- **Reconciled against the real backend (2026-08-27, restiq-web#61).** The self-authored
  guess above was wrong on every count once `restiq-backend#46` landed on `dev` and was read
  directly (`orders.controller.ts`/`orders.dtos.ts`): the real route is outlet-scoped
  (`GET /pos/v1/outlets/:outletId/table-map`, not the bare `table-map` path this story
  called - the reported 404), the response is a **flat `TableMapEntry[]`**, not a
  `{ outletId, currentStaff, floors, tables }` envelope (no floor-name lookup, no
  currentStaff read anywhere server-side), and each entry is flat too
  (`tableId`/`floorId`/`label`/`seatCapacity`/`status`/`orderId`/`ownerId`, two-valued
  status only - `needs_bill` is real but not settable until CAP-7's `Bill` model exists,
  same TODO the backend's own DTO carries). `table-map-state.ts`'s `toTableMapEntry` now
  does that mapping; `currentStaff` comes from the `pos_staff` cookie server-side
  (`table-map/page.tsx`, same pattern `(shell)/open-orders/page.tsx` established for
  restiq-web#60); floor grouping is derived purely from each table's own `floorId` (no
  separate floor list exists to group against); the elapsed-time label and `needs_bill`'s
  UI are dropped outright rather than fabricated, since the backend has no per-table
  "opened at" or bill-request state to compute them from. `startOrder`/`transferOrder`
  (`api.ts`) now hit the real outlet/table-scoped POST and send `newOwnerStaffId` (confirmed
  required live via a real 400, "newOwnerStaffId must be a UUID").
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
- **Reconciled against the real backend (2026-08-27, restiq-web#61).** `GET /pos/v1/menu`
  (`restiq-backend#66`) is now real and verified (`test/pos-menu.e2e-spec.ts`) - the
  `PosMenuView` shape this story guessed at was never wrong, just unbacked; one real bug
  surfaced writing that test (an item/variant with no resolvable price was still returned
  instead of dropped, fixed in `menu.service.ts`). `Order`/`OrderLine` are real too
  (`restiq-backend#52`/`#58`, `orders.dtos.ts`, read directly): raw ids only
  (`itemId`/`variantId`/`addedByStaffId`/`tableId`/`ownerId`), no `itemName`/`variantName`/
  `addedByStaffName`/`tableLabel`/`ownerStaffName`, no `currency` on `Order` at all (it
  lives on the menu), and a real three-valued forward-only `status`
  (`open`/`sent`/`closed`) instead of the old `occupied`/`needs_bill` guess or a fabricated
  `firedAt` timestamp. `order-taking-state.ts`'s new `toOrderView`/`toOrderLineView` join
  `itemId`/`variantId` against the already-loaded menu for real display names (raw-id
  fallback if a menu isn't in scope, or the item's since been deleted), derive
  `lineTotalMinor` via the existing `computeUnitTotalMinor` rather than trusting a wire
  field that doesn't exist, and `canSendToKitchen` now gates on `status === "open"` - real
  data the backend already enforces the same way. `specialInstructions` has no backing
  column anywhere in `OrderLine`; dropped from the read side so nothing displays a value
  the backend never actually stored (the write-side capture is left in place, unreconciled,
  only because `counter-view.tsx`/CAP-6 - out of scope for restiq-web#61 - shares the same
  `ModifierSheetConfirmValue` type). `OrderView.ownerStaffName`/`tableLabel` field names
  are kept (rather than renamed/removed) purely because `counter-view.tsx` reads
  `order.ownerStaffName` directly and wasn't touched by this pass - the *value* behind that
  name is now the real raw owner id, never a fabricated one.
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

### Deviation (2026-09-02): Split by seat removed - seats optional

- **Product reason:** the owner found "Split by seat" confusing on the order screen and
  decided to remove it (restiq-web#120), paired with a backend change (restiq-backend
  issue "Make seat assignment optional: stop rejecting unseated lines on send-to-kitchen")
  that drops the `unseated_lines` rejection on send - `seatNumber` becomes purely optional
  metadata, never a fire-gate.
- **What was removed from `order-taking-view.tsx`/`order-panel.tsx`/`order-taking-state.ts`:**
  the "Split by seat" toggle (`split-by-seat-toggle`), the per-line seat stepper rows
  (`order-line-seat-{id}` and its increment/decrement buttons), the "N items need a seat
  before sending to the kitchen" gate message (`send-to-kitchen-blocked`), and the pure
  helpers `allLinesSeated`/`unseatedLineCount`. The `assignSeat` wiring
  (`handleSeatIncrement`/`handleSeatDecrement`) was removed from `order-taking-view.tsx`
  since nothing else called it; `assignSeat` itself stays in `src/app/pos/api.ts` as a thin
  wrapper the backend's assign-seat endpoint still supports, just unused by this screen now.
- **What stayed:** `seatNumber` remains on `OrderLineView`/`RawOrderLine` (still real wire
  data) but is no longer rendered on this screen. `canSendToKitchen` is now just "at least
  one line, and the order hasn't already been sent" - no seat requirement.
  `src/app/kds/(shell)/station/ticket-card.tsx`'s seat chip (`kds-line-{id}-seat`) already
  rendered nothing for a `null` seatNumber and a chip for a real one, so no change was
  needed there beyond adding the missing regression assertion for the null case.
  `src/app/pos/counter/` and open-orders never had seat UI to remove.
- **Tests:** the CAP-4 seat-gate tests above (12 pure-logic + the seat-assignment/blocked
  integration tests) were replaced with tests asserting send-to-kitchen is enabled with
  unseated (or entirely unseated) lines, that no split toggle or seat row renders, and that
  a race-condition `unseated_lines` rejection from the backend surfaces as a plain inline
  error rather than reinstating the gate.

## Integration points for later stories

- **Story 4 (CAP-3, order taking, P3/P4) - done, see its own section above.**
- **Story 5 (CAP-4, group ordering/seats) - done, see its own section above.**
- **Story 8 (CAP-7, bill & settle) - done, see its own section below.** It builds directly
  on story 4/5's `OrderLine`/`OrderView` shape (`order-taking-state.ts`, now including
  `seatNumber`/`firedAt`), reusing `OrderLineView` verbatim for the bill's line items
  rather than reshaping them, and owns the tax breakdown/discount line CAP-3's `OrderPanel`
  explicitly left out (see CAP-3's Built section above for why).
- **Story 6 (CAP-5, open/held orders) - done, see its own section below.** It calls
  story 3's `transferOrder` action (`src/app/pos/api.ts`) directly for take-over, per
  stories.yaml: "reused, not reimplemented."
- **Story 7 (CAP-6, QSR counter and token mode) - done, see its own section below.** It
  composes story 4's item grid and story 8's `BillSummary`/`TenderKeypad` into one screen
  rather than building new ring-up or settle UI - see that section for the additive
  `BillSummary` props this required and the real-backend divergence discovered while
  researching it.
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
  connectivity } }`. **RECONCILED (2026-09-02, restiq-web#98)** against the
  real, merged `attendance.controller.ts`/`attendance.dtos.ts` - see the
  Reconciliation section near the end of this doc for what was actually
  wrong and fixed.
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
  `elapsedLabel`, `summarize`, `toOpenOrderEntry`), unit-tested in isolation same as
  `table-map-state.ts`. The screen (`open-orders-screen.tsx`) is a five-state view over the
  real, verified `GET /pos/api/outlets/:outletId/orders` (reconciled 2026-08-27, restiq-web#60
  - see Reconciliation below): skeleton while loading, inline retry on failure, a true empty
  state ("No open orders") for zero rows, and otherwise a table of every non-closed order with
  its origin (`Table {tableId}` or `Counter` - raw table id, no label lookup exists
  server-side yet), server ("You" for the signed-in staff's own orders via `isOwnOrder`, else
  the raw owner id - no staff-name lookup exists server-side yet), status (Open / Sent to
  kitchen - no fabricated "held" status, see Key decisions), elapsed time, and item
  count/total derived client-side from each order's real `lines` (`toOpenOrderEntry` sums
  quantity for itemCount and reuses `order-taking-state.ts`'s `computeUnitTotalMinor` -
  unitPrice + modifiers - per line for totalMinor, widened to accept just `{ priceMinor }` so
  both screens share one formula) - a true zero for an order with no lines yet, never a
  guessed or missing figure, and the footer's running total (`summarize()`) is an
  unconditional sum since totalMinor is always computable now. The signed-in staff's own
  orders get a plain **Resume** link straight to the existing `/pos/orders/[orderId]` route
  (story 3's destination, no new endpoint); everyone else's orders get a **Take over** button
  that opens story 3's real, reused `TransferOwnershipDialog`
  (`../../table-map/transfer-ownership-dialog.tsx`) and calls its real `transferOrder()`
  action (`../../api.ts`) on confirm - no second dialog, no second transfer endpoint, exactly
  stories.yaml's instruction.
  - **Reachable from anywhere**, per EXPERIENCE.md's IA: a persistent "Open orders" nav
    link was added to the shell's `shift-bar.tsx` (same plain-link-not-a-fetch pattern as
    the existing "Shift" link) so every `(shell)`-nested `/pos` screen can reach it. The
    table map (`table-map.tsx`) isn't nested under `(shell)` yet (a pre-existing gap - see
    CAP-2's Integration points above), so it doesn't get the shift bar's nav; a second,
    matching link was added directly to its own header for the same reason, rather than
    leaving the table map - the other half of the main loop - unable to reach P6 at all.
- **Reconciled against the real backend (2026-08-27, restiq-web#60).** At build time,
  `restiq-backend`#53 ("Open and held orders, outlet-wide") had no branch and no commits -
  confirmed by `git ls-remote` against the real `restiq-backend` remote (only `dev`/`main`/
  `feature/15-device-fleet` existed), not a summary - so this story shipped a self-authored,
  unverified contract: `GET /pos/v1/outlets/:outletId/orders -> { outletId, orders:
  OpenOrderEntry[] }`. That guess was wrong on both counts once restiq-backend#53 landed on
  `dev` and was read directly (`orders.controller.ts`/`orders.dtos.ts`): the real endpoint
  returns a **bare `OrderView[]`**, not a `{ outletId, orders }` envelope - `data.orders` was
  always `undefined` against the real payload, crashing every staff member who opened the
  screen (restiq-web#60). And the real `OrderView` carries no `tableLabel`/`ownerStaffName`/
  `itemCount`/`totalMinor` - only raw `tableId`/`ownerId` and `lines`
  (quantity/unitPriceMinor/modifiers, always present now that CAP-3 order-lines has landed).
  `open-orders-state.ts`'s new `toOpenOrderEntry` derives itemCount/totalMinor from `lines`
  and falls back to the raw id for table/owner display (the UI shows "You" for the viewer's
  own orders via `isOwnOrder`) until a staff-name/table-label lookup exists server-side -
  **same gap still open in `table-map-state.ts`, flagged but not fixed here** (out of scope
  for restiq-web#60, needs its own issue).
- **Tests:** pure logic (`open-orders-state.test.ts`: `toOpenOrderEntry`'s mapping off the
  real wire shape, own-order detection, table vs. counter origin labels, elapsed-time
  formatting including a clock-skew case, and `summarize()`'s unconditional sum) and a full
  component suite (`open-orders-screen.test.tsx`: loading/error/empty states, a regression
  test for the bare-array payload, rendering origin/server/status/elapsed for a mixed
  table+counter list, the "You" fallback for the viewer's own order, Resume-vs-Take-over
  branching by ownership, the reused transfer dialog's confirm/cancel paths including that a
  cancelled transfer fires no network request, and that an order with no lines yet renders a
  true zero without crashing) plus a nav-link assertion in both `shift-bar.test.tsx` and
  `table-map.test.tsx`. 652/652 tests passing repo-wide; lint/typecheck clean.
- **Live verification:** none possible in this session (no running restiq-backend instance to
  hit). Verified via the test suite above (stubbing global `fetch` against the real,
  read-directly wire shape, not a guess) plus `tsc --noEmit` and `pnpm lint`.

## Key decisions (CAP-5)

- **No fabricated "held" status.** SPEC/UX call this "open and held orders", but the real
  `Order` model (story 3's `orders.service.ts`) only has `open`/`sent`/`closed` - there is
  no distinct "held" state to render. The screen shows every non-closed order (both `open`
  and `sent`) under its real status label instead of inventing a "Held" badge with nothing
  behind it, matching the `needs_bill` honesty precedent CAP-2 already established.
- **Counter-origin orders render `tableLabel: null` as "Counter", not a blank cell** - at the
  time this story was built, CAP-6 (QSR counter mode) didn't exist yet, so nothing in this
  prototype could actually produce one; the contract modeled it anyway since a real Order's
  `tableId` is nullable (story 3's own `OrderView`) and stories.yaml's brief explicitly calls
  for "table or counter origin". **Now real** - story 7/CAP-6 (below) landed
  `/pos/counter`, whose orders carry `tableId: null` and `tableLabel: "Takeaway"` (not
  literally `null`, so `open-orders-state.ts`'s own `originLabel` - which branches on a
  `null` `tableLabel` - still needs a look once someone reconciles the two, flagged here for
  whoever does).
- **Item count/total are nullable, not defaulted to 0** - a missing summary must read as
  "not available" (`—`), never as a fabricated real zero, since CAP-3/CAP-4 order-lines and
  pricing may not exist for a given order yet. `summarize()`'s footer total only appears
  once every row actually has one, for the same reason.
- **No new dialog, no new transfer endpoint.** Take-over reuses story 3's
  `TransferOwnershipDialog` and `transferOrder()` verbatim - stories.yaml is explicit this
  screen is "a list view over existing Order state, not a new ownership mechanism."

## CAP-6 - QSR counter and token mode (story 7)

- **Intent:** for counter-service outlets, one staff member rings up items and takes payment
  in a single continuous flow, issuing a queue token instead of assigning a table -
  completing a counter order issues a sequential token number and finalises the bill in the
  same action, no separate waiter hop (SPEC CAP-6 success criterion; EXPERIENCE.md's Ravi
  counter-rush flow).
- **Built:** P7 QSR Counter (`src/app/pos/counter/`, routed at `/pos/counter`) - a genuinely
  new route, but built almost entirely out of already-merged parts:
  - **The item grid** - category-tab rail, search, `PosItemTile`, `ModifierSheet`, and every
    piece of `order-taking-state.ts`'s pure logic (`filterMenuItems`,
    `itemNeedsModifierSheet`, price/modifier resolution) - reused verbatim from the real,
    already-merged story 4 order-taking screen. The layout glue (category-tab rail + grid
    JSX) is a small, deliberate duplication of `order-taking-view.tsx`'s own layout rather
    than an extraction into a shared component - refactoring that already-shipped, already-
    tested screen (45 tests) to share a subcomponent wasn't worth the regression risk for a
    second caller this story is the first to need (YAGNI/ponytail: reuse the substantial
    pieces, don't risk-refactor already-working code for a few dozen lines of layout).
  - **The settle half** - `BillSummary` and `TenderKeypad` (`orders/[orderId]/settle/`,
    story 8/#53) reused directly, keyed off the same order id the ring-up half uses (no
    separate `/settle` route, no navigation hop - `fetchBill`/`addBillTender`/`finalizeBill`
    all already take an `orderId`, which this screen never leaves). `BillSummary` gained
    four **additive, optional** props (`busyLineId`/`onIncrement`/`onDecrement`/`onRemove`) -
    unused by story 8's own caller (`bill-settle-view.tsx`, which never passes them, so its
    already-tested read-only rendering is byte-identical to before) - so the exact same
    line/qty/amount table that renders a dine-in bill read-only can also render a still-being-
    rung-up counter order's lines with qty steppers and a remove button, rather than building
    a second, parallel line-item component just for this screen. Discount is not offered here
    at all (YAGNI - the P7 mock has no discount affordance and this story's brief never asks
    for one); `onAddDiscount` is now optional on `BillSummary` for exactly this reason (its
    button simply doesn't render when the prop is omitted).
  - **`TokenBadge`** (`token-badge.tsx`, new - DESIGN.md names it, nothing built it yet) - a
    large, high-contrast token number, shown in the header throughout ring-up and settlement
    (not only after charging), per the P7 mock showing "Order #47"/"Token #47" together from
    the moment ring-up starts. Only rendered when a real `tokenNumber` is present on the
    order - never a fabricated placeholder if it's ever missing.
  - **`startCounterOrder()`** (new, `api.ts`) - the one genuinely new backend action this
    story needed: opens a table-less order and assigns it a token number in the same call,
    called once on mount. `OrderView` gained an optional `tokenNumber?: number | null` field
    (same story-4-compatibility convention as `seatNumber`/`firedAt`) and its `tableId` was
    widened from `string` to `string | null` (nothing else in the app ever read that field,
    confirmed by search, so this was a safe widening) - a counter order's `tableId` is
    genuinely `null`, never a fabricated placeholder id; its `tableLabel` is the real string
    `"Takeaway"` instead.
  - **One continuous screen, no navigation hop:** ring up (`addOrderLine`/
    `updateOrderLineQuantity`/`removeOrderLine`, all from story 4's already-merged `api.ts`)
    and settle (`addBillTender`/`finalizeBill`, story 8's) both act on the same order id for
    the lifetime of one counter order; after every line mutation, the bill is re-fetched
    (`fetchBill`) to refresh the tax/total figures `BillSummary` shows, same "replace the
    whole view from the server's response, no optimistic local patch" convention every other
    `/pos` screen already follows (there is a brief lag between a line mutation landing and
    the refreshed tax total appearing - two sequential round trips, not one - flagged here as
    a real, minor UX cost of reusing `BillView`-driven `BillSummary` as the single line-item
    source of truth, rather than building a merged view type nothing else needs).
  - **Starting the next order:** once a bill finalises, a "Start next order" action calls
    `startCounterOrder()` again (a fresh token number) and the whole ring-up screen remounts
    keyed on the new order id, rather than hand-resetting a dozen pieces of in-progress local
    state (search query, active modifier sheet, busy flags, ...) - EXPERIENCE.md's "the next
    customer is already at the counter before Ravi looks up."
  - **Reachable via a direct nav link, not capability-based routing.** EXPERIENCE.md's real
    IA picks Table Map vs. QSR Counter at login by outlet capability, but nothing in this
    prototype's session model carries that capability yet (`src/app/pos/(shell)/page.tsx`'s
    placeholder still flags this as unresolved, predating this story). Solving that is a
    separate, larger concern (a real capability field would need to exist on the session/
    outlet somewhere first) - out of this story's scope. Instead, same precedent as CAP-5's
    direct "Open orders" link on the table map, a reciprocal "Switch to Counter Mode" /
    "Switch to Table Mode" link pair was added between `/pos/table-map` and `/pos/counter` so
    both entry points are actually reachable today.
- **Backend not available at build time.** `restiq-backend#62` ("QSR counter and token mode")
  had no branch and no commits when this was built (`gh issue view 62`/`gh api
  repos/AusPosRest/restiq-backend/branches` both confirming only `dev`/`main`/
  `feature/15-device-fleet` exist) - `startCounterOrder`'s `POST /pos/v1/orders/counter`
  contract is self-authored from SPEC.md's CAP-6 description and the P7 mock, documented in
  full in `api.ts`'s header.
  - **A note on which backend contract this story builds against.** While researching #62,
    the real, already-merged `restiq-backend` `dev` branch's actual `src/pos/orders/`/
    `src/pos/bills/` modules were read directly (`orders.controller.ts`/`.dtos.ts`/
    `.service.ts`, `bills.controller.ts`/`.dtos.ts`) - and they diverge substantially from
    restiq-web's own self-authored `OrderView`/`BillView` shapes that stories 3/4/5/8 already
    shipped against and this story reuses: the real `OrderView` has no display names
    (`tableLabel`/`ownerStaffName`) or computed line totals at all (just raw
    `itemId`/`variantId`/`unitPriceMinor`), and the real Bill flow is one atomic
    `POST /bills/:id/finalize {discountMinor?, discountReason?, managerPin?, tenders[]}` call
    rather than story 8's separate discount/tender/finalize endpoints. Reconciling CAP-3/
    CAP-4/CAP-7 against those real shapes is a separate, much larger undertaking than this
    story's own scope (composing already-built UI, per this story's brief) - flagged here,
    not attempted, same discipline as CAP-3's own out-of-scope CAP-2 status-vocabulary
    observation. This story's own addition (`tokenNumber`, `startCounterOrder`) is kept
    consistent with restiq-web's existing self-authored contract rather than the real
    backend's, for exactly that reason - the real backend's `OrderView.tableId: string | null`
    does, encouragingly, already confirm a table-less order is structurally sound.
  - **RECONCILED (2026-09-02, restiq-web#98).** `startCounterOrder` now hits the real,
    merged `POST outlets/:outletId/counter-orders` (`orders.controller.ts`'s
    `createCounterOrder`) instead of the guessed `POST orders/counter` - see the
    Reconciliation section near the end of this doc for the full accounting, including the
    Bill/settle rewrite this screen's `BillSummary`/`TenderKeypad` reuse inherited.
- **Tests:** 4 new integration tests (`counter-view.test.tsx`, stubbing global `fetch` against
  this story's self-authored contract, same convention as `order-taking-view.test.tsx`/
  `bill-settle-view.test.tsx`): starting a counter order on mount and showing its assigned
  token number, a retryable error panel if starting fails, a full ring-up-then-settle flow
  with no navigation away from `/pos/counter` (adding an item, filling the exact remaining
  tender, finalizing, and landing on a read-only settled panel with no mutation UI left), and
  starting the next order issuing a fresh token number. Deliberately does not re-test
  `ModifierSheet`/`PosItemTile`/`TenderKeypad`/`BillSummary`'s own internals - those already
  have dedicated coverage from stories 4/8 - only the composition. 630/630 tests passing
  repo-wide; lint/typecheck/build clean.
- **Live verification:** no real backend reachable (same posture as every other not-yet-
  backed POS story). Checked on a local dev server pointed at this branch with no backend
  behind it: `/pos/counter` renders and its menu-load failure surfaces the same styled
  `LoadErrorPanel`/retry affordance every other `/pos` screen uses, rather than crashing -
  confirming the composition mounts cleanly outside the test harness too. The full ring-up-
  through-token-through-charge flow is verified entirely by the integration suite above,
  stubbing `fetch` against the self-authored contract.

## Key decisions (CAP-6)

- **Discount is not offered on the counter screen at all** - the P7 mock has no discount
  affordance and this story's brief never asks for one (YAGNI); `BillSummary.onAddDiscount`
  became optional so the button simply doesn't render rather than wiring up an unused
  `DiscountDialog`.
- **The token number is a new field on the shared `OrderView`, not a new parallel type** -
  `tokenNumber?: number | null` follows the exact optional-not-nullable convention
  `seatNumber`/`firedAt` already established for CAP-4, so story 4/5's own already-shipped
  literals and tests keep type-checking unchanged.
- **`BillSummary`'s line-edit steppers are additive opt-in props, not a new component** -
  reuse over rewrite: the counter screen needed exactly the line/qty/amount table
  `BillSummary` already renders, just with steppers; a second component would have
  duplicated that table's markup for no behavioral difference story 8's own dine-in caller
  needs.
- **No merged "live" view type blending `Order` and `Bill` state** - line mutations refresh
  the bill via a second `fetchBill` call rather than optimistically overlaying the order's
  freshly-returned lines onto the last-known bill figures; the resulting one-round-trip lag
  before totals refresh is a real, documented cost, accepted for consistency with every
  other `/pos` screen's "replace the whole view from the server's response" convention
  rather than inventing a new merge convention only this screen would use.
- **Capability-based post-login routing (Table Map vs. QSR Counter) is still not wired up** -
  a pre-existing gap this story didn't create and doesn't attempt to fix (see Built section
  above); a direct nav link between the two screens is the concrete, working stand-in.

## CAP-7 - Bill & Settle (story 8)

- **Intent:** cashier reviews a tax breakdown of the order, optionally applies a discount
  (gated by manager PIN once above a threshold), tenders payment across one or more
  methods until the remaining-to-settle figure hits zero, then finalises - after which the
  bill is read-only, no edit path anywhere (AD-14 insert-only-past-finalisation).
- **A note on this story's source material.** The task brief for this story cites
  `restiq-design/docs/specs/spec-pos-cashier-waiter/SPEC.md`,
  `.../stories.yaml`, and `restiq-design/docs/ux/ux-pos-cashier-waiter-2026-08-25/`
  (DESIGN.md/EXPERIENCE.md) - the same paths this whole doc's header cites. None of them
  exist anywhere in the real `restiq-design` repo (checked every branch's full git tree via
  `gh api .../git/trees?recursive=1`, not just `main`) - only `spec-platform-console` and
  `spec-tenant-admin` have real SPEC/stories.yaml/DESIGN/EXPERIENCE docs; the POS capability
  only ever got as far as `design-system.md` + Stitch screen mocks under
  `design/screens/pos-core-loop/` (on the `design/pull-stitch-screens` branch). This story
  was therefore built from the real P8 mock
  (`restiq-bill-settle-order-1042--a6cdc714.png`) and `design-system.md`'s component list
  (`BillSummary`, `TenderKeypad`) alone - see `settle/bill-state.ts`'s file header for the
  full accounting. Flagged for whoever owns `restiq-design` to either author the missing
  docs or correct this doc's header, which has cited them since story 1 without anyone
  having verified they exist.
- **Built:** `src/app/pos/orders/[orderId]/settle/`, a new route
  (`/pos/orders/[orderId]/settle`) reached from the real, already-merged order-taking
  screen's new "Settle" button (`order-panel.tsx`'s footer, disabled with no line items).
  - **`bill-state.ts`** - `BillView`/`BillDiscountView`/`BillTaxLineView`/`BillTenderView`
    types plus pure logic (`canFinalizeBill`, `isBillReadOnly`,
    `discountRequiresManagerApproval`), unit-tested without a DOM, same split as every
    other `/pos` screen's `*-state.ts`.
  - **`BillSummary`** (left panel) - qty/item/amount lines (reusing `OrderLineView`
    straight from CAP-3's `order-taking-state.ts`, no reshaping), then subtotal, an
    optional discount line (green, `-amount`, tagged "Manager approved" when it went
    through the PIN gate), CGST/SGST tax lines, a round-off line, and the grand total -
    matches the P8 mock's own layout exactly. Split-bill (by seat/item/equal/amount, also
    visible in the mock) is not built - not in this story's task list (YAGNI, noted in
    `bill-state.ts`'s header).
  - **`TenderKeypad`** (right panel) - a running "remaining amount due" figure, a
    Cash/UPI method toggle, the already-merged shift `AmountKeypad` reused directly for
    amount entry (an "exact remaining" quick-fill button added on top), and a captured-
    tenders list. Each "Add tender" posts one tender and replaces the whole `BillView` from
    the response - supports split/multiple tenders exactly as asked, with no client-side
    running-total math the server response doesn't already carry.
  - **Discount, below vs. above threshold** (`discount-dialog.tsx`) - percent-only (matches
    the mock's own "Discount 10%" line; a fixed-amount discount isn't shown in the mock or
    asked for). Below `DISCOUNT_MANAGER_APPROVAL_THRESHOLD_PERCENT` (10%, this story's own
    documented judgment call - no numeric threshold exists anywhere to read), the dialog
    collects a plain free-text reason and applies directly. At or above it, the plain
    reason field disappears and the dialog instead renders the real, already-merged
    **`ManagerPinDialog`** (`src/app/pos/components/manager-pin-dialog.tsx`, story 9/#42) -
    not a second PIN dialog - with `actionTitle="Discount above threshold"` and
    discount-specific `reasonCodeOptions` (Regular guest / Service recovery / Manager
    discretion / Other, matching the mock's "Regular guest" tag). `onApprove` calls the
    same `applyBillDiscount()` the below-threshold path calls, just with the PIN attached;
    a rejected/thrown approval surfaces inline in `ManagerPinDialog`'s own error slot
    without closing, exactly its existing contract. See "How to use this component" in
    story 9's original wiki entry for the general pattern - this is that pattern's first
    real caller.
  - **Finalize** - disabled until `tenderedMinor` exactly equals `grandTotalMinor`
    (`canFinalizeBill`, never allows over-tendering to silently pass either). Once the bill
    comes back `status: "finalised"`, the whole mutation half of the screen (discount
    button, `TenderKeypad`, Finalize button) stops rendering outright and is replaced by a
    plain "Bill finalised" panel - there is no toggle, flag, or hidden route back to the
    mutable view, matching the task's "no edit UI at all" requirement.
  - **`AmountKeypad` gained an additive `display` prop** (`(shell)/shift/amount-keypad.tsx`)
    so the discount dialog's percent entry could reuse it instead of writing a second
    digit-grid component - every existing money caller is unaffected (the prop is optional
    and only this story passes it).
- **Backend not available at build time.** `restiq-backend#59` ("Bill and settle (CAP-7)")
  was open with no branch and no commits when this was built (`gh issue view 59`/`gh api
  .../branches` against `AusPosRest/restiq-backend`, confirming only `dev`/`main`/
  `feature/15-device-fleet` exist) - the issue body itself calls this a "greenfield
  Bill/Tender models, AD-14 insert-only, gapless outlet-scoped numbering" build, so unlike
  CAP-3's order lines there was no real schema anywhere to read either. Self-authored
  contract (`GET .../bill`, `POST .../bill/discount`, `POST .../bill/tenders`, `POST
  .../bill/finalize`) documented in full in `bill-state.ts`'s and `api.ts`'s file headers,
  including the CGST/SGST 2.5%+2.5% tax computation (the only concrete tax rule available
  anywhere - `TenantTaxRegistration.taxProfile` exists in the real merged schema but has no
  computation logic yet) and the bill-numbering convention (`TN1-000482` in the mock; this
  client only ever displays whatever the response carries, never fabricates one).
  **RECONCILED (2026-09-02, restiq-web#98)** against the real, merged
  `src/pos/bills/*` (`bills.controller.ts`/`.service.ts`/`.dtos.ts`/`bill-core.ts`) - the
  real contract turned out to be only four endpoints (create/get/finalize/refund), a flat
  5% tax with no CGST/SGST split, and a 20%-of-subtotal manager-approval threshold, not the
  above guesses. See the Reconciliation section near the end of this doc for the full
  accounting.
- **Tests:** 15 new tests - pure logic (`bill-state.test.ts`, 9: discount threshold
  boundary at/above/below, finalize-gating including the never-over-settle case, read-only
  detection) and a full integration suite (`bill-settle-view.test.tsx`, 6, stubbing global
  `fetch` against the self-authored contract, same convention as
  `order-taking-view.test.tsx`): tax breakdown rendering, remaining-to-settle updating
  across two tenders (a manual entry plus an exact-remaining fill), Finalize staying
  disabled until tenders exactly cover the total then enabling, a below-threshold discount
  applying with just a reason and no PIN dialog appearing, an above-threshold discount
  routing through the real `ManagerPinDialog` (confirming Approve stays disabled on PIN
  alone until a reason is also picked, then proceeding only once both are present), and
  that no mutation control of any kind renders once the bill is finalised. 626/626 tests
  passing repo-wide (after merging story 5's concurrently-landed CAP-4 work);
  lint/typecheck/build clean.
- **Live verification:** none possible - same constraint as CAP-3/CAP-5 above, now also
  true of story 9's `ManagerPinDialog` itself (its own wiki entry already noted no screen
  existed yet to verify it live in - this is that screen). Verified entirely via the 15
  tests above, stubbing global `fetch` against the self-authored contract.

## Key decisions (CAP-7)

- **Discount is percent-only**, not percent-or-amount - the P8 mock only ever shows a
  percent discount, and the task didn't ask for a fixed-amount variant either (YAGNI).
- **The 10% manager-approval threshold is this story's own documented judgment call**,
  chosen so the mock's own 10%-with-"Manager approved" discount sits exactly on the
  boundary - no real threshold exists anywhere to read yet (see `bill-state.ts`).
- **No tender-removal UI** - the mock itself has no such affordance either, and AD-14's
  insert-only posture on the money path (already established by CAP-10's cash movements)
  suggests a wrong tender is corrected by adding more tenders and reconciling at
  finalisation/close, not by deleting a row. Flagged as a real usability gap worth
  revisiting once the real backend's tender semantics land, not silently assumed away.
- **Split-bill (by seat/item/equal/amount) is out of scope** - visible in the P8 mock but
  not named anywhere in this story's task list.

## CAP-9 - Refunds and adjustments (story 10, issue #57)

- **Intent:** staff can refund one or more items (by quantity, up to the original line's
  quantity) against an already-finalised, immutable Bill, always gated by the CAP-8
  manager-authorisation dialog, with a proportional tax reversal. Success never mutates
  the original Bill - it is issued as a separate, linked credit note, matching the real
  backend's insert-only `CreditNote` design.
- **Built:** `src/app/pos/orders/[orderId]/refund/`, a new route
  (`/pos/orders/[orderId]/refund`) reached from a new "Refund…" button on the real,
  already-merged bill-settle screen's "Bill finalised" panel (`settle/bill-settle-view.tsx`,
  story 8) - the only entry point, since a bill must already be finalised to be refund-
  eligible.
  - **`refund-state.ts`** - `RefundSelection`/`CreditNoteView`/`CreateRefundInput` types plus
    pure logic (`toggleLineSelected`, `setLineQuantity` clamped to `[1, line.quantity]`,
    `computeRefundTotals`, `hasRefundSelection`, `toRefundLineInputs`, `canRefundBill`),
    unit-tested without a DOM, same split as every other `/pos` screen's `*-state.ts`.
    Refund tax reversal mirrors CAP-7's own forward-direction rule (a flat combined rate -
    CGST 2.5% + SGST 2.5% = 5% - applied to the refunded subtotal), verified to reproduce
    the P10 mock's own numbers exactly (2 x Butter Naan @ ₹60 -> ₹120 subtotal, ₹6 tax
    reversal, ₹126 total).
  - **Two real, already-merged pieces reused directly, neither rebuilt:**
    - **`BillSummary`** (CAP-7/story 8, `settle/bill-summary.tsx`) renders the "Original
      Invoice" read-only, unmodified - passed the fetched finalised `BillView` with a no-op
      `onAddDiscount`. Because `bill.status` is already `"finalised"`, `BillSummary` itself
      already hides its discount affordance; nothing new needed wiring for that. This is
      also *why* the original bill can never look "edited" here - the refund screen never
      writes to the `BillView` it displays, at all.
    - **`ManagerPinDialog`** (CAP-8/story 9, `components/manager-pin-dialog.tsx`) gates the
      one and only path to `createRefund()` - refund has no below-threshold exception (CAP-8
      lists it as always one of the six gated actions), so unlike CAP-7's discount dialog
      there is no plain-reason fallback at all; the mandatory reason code always comes from
      the dialog's own `reasonCodeOptions` (Customer complaint / Order entry error / Quality
      issue / Duplicate charge / Other).
  - **`RefundConfigPanel`** (new) - a checkbox + qty-stepper row per original bill line
    (stepper reuses the same Minus/Plus icon-button convention as `order-panel.tsx`'s line
    quantity controls, bounded to the line's original quantity), a live refund
    subtotal/tax-reversal/total readout (`computeRefundTotals`), an optional manager-notes
    textarea, and a Cash/UPI-Reversal method toggle (same `aria-pressed` button-group
    pattern as `TenderKeypad`'s method selector). "Process refund" only opens
    `ManagerPinDialog` - `createRefund()` is called exclusively from its `onApprove`, so
    there is no code path that issues a refund without a valid PIN + reason.
  - **`CreditNoteResult`** (new) - the success state: credit note number, refunded lines,
    subtotal/tax-reversal/total, reason, notes, and refund method. `refund-view.tsx` swaps
    this in wholesale in place of the two-pane refund UI once `createRefund()` resolves -
    there is no code path that re-renders the original bill with the refund "applied" to it.
- **Backend not available at build time.** `restiq-backend#63` ("Refunds and adjustments
  (CAP-9)") had no branch and no commits when this was built (`gh api
  repos/AusPosRest/restiq-backend/branches` and `gh pr list --repo AusPosRest/restiq-web`
  both checked - no `feature/63-refunds-adjustments` branch anywhere, and no PR against
  `restiq-web` either). Built directly from `docs/specs/spec-pos-cashier-waiter/SPEC.md`'s
  CAP-9 section and the real P10 mock
  (`restiq-refund-adjustments-bill-tn1-000482--50f49f87.png`, read from the sibling
  `restiq-design` repo) - unlike the CAP-7 note above, `SPEC.md` and `screens.md` *did*
  exist and were readable this time. Self-authored contract (`POST .../bill/refund`,
  reusing the existing `GET .../bill` read rather than inventing a second one) documented in
  full in `refund-state.ts`'s and `api.ts`'s file headers.
  **RECONCILED (2026-09-02, restiq-web#98)** against the real, merged `POST
  bills/:id/refund` (`bills.controller.ts`/`.service.ts`/`.dtos.ts`) - the real endpoint
  targets the Bill (not the Order), has no `refundMethod` field at all, and takes one plain
  `reason` string rather than a reason code + notes pair. See the Reconciliation section
  near the end of this doc for the full accounting.
- **Tests:** 16 new tests - pure logic (`refund-state.test.ts`, 10: selection
  toggling/clamping, partial- and full-quantity refund totals matching the P10 mock exactly,
  multi-line selection filtering, and the finalised-only eligibility gate) and a full
  integration suite (`refund-view.test.tsx`, 6, stubbing global `fetch` against the
  self-authored contract): selecting items/quantities computes the correct running partial
  amount while the original invoice's own totals never change, the manager PIN dialog blocks
  `createRefund()` until both PIN and reason are supplied, a rejected PIN leaves the config
  panel in place with no credit note issued, a successful refund shows the credit note with
  only the one original `GET` and no bill-mutating request ever made, and a non-finalised
  bill shows no refund controls at all. 642/642 tests passing repo-wide; lint/typecheck/build
  clean.
- **Live verification:** none possible - same constraint as every other not-yet-backed POS
  story above. Verified entirely via the 16 tests above, stubbing global `fetch` against the
  self-authored contract.

## Key decisions (CAP-9)

- **No below-threshold exception for refund's reason code** - CAP-8 lists refund as always
  gated (unlike CAP-7's discount, which has a below-threshold plain-reason path), so the
  mandatory reason always comes from `ManagerPinDialog`'s own reason-code select; there is
  no separate reason field on the main config panel.
- **Tax reversal is a flat combined rate on the refunded subtotal**, not reproportioned
  through any discount that was on the original bill - matches the P10 mock exactly and
  nothing in the task or mock asks for discount-aware reversal (YAGNI, flagged in
  `refund-state.ts` to revisit once the real backend's reversal rule is read).
- **No multi-refund history/remaining-quantity tracking across several credit notes** - this
  screen refunds against the original bill's quantities directly; nothing in the task or the
  read-only `GET .../bill` response gives it a "already refunded" figure to subtract, and
  building one wasn't asked for.
- **The original `BillView` is reused verbatim, never a second read-only rendering** -
  `BillSummary` needed no changes at all to serve this screen's "read-only, never edited"
  requirement, since it already renders exactly that for a finalised bill.

## Printable tax invoice (issue #137, restiq-backend#103/PR #105)

- **Intent:** a printable tax invoice for a finalised bill - the actual GST/ABN-compliant
  document a guest takes away, distinct from the in-app `BillSummary` line-item panel used
  while settling. Built against the real, merged `GET /pos/v1/bills/:id/invoice` contract
  (restiq-backend PR #105) - a single, fully server-computed `InvoiceView` (seller
  registration block, per-item lines, subtotal, discount, a `taxBreakdown` array so
  India's CGST/SGST split and Australia's flat GST both render as one loop over the same
  rows, total, a `pricesIncludeTax` flag, tenders, credit notes, and free-text `notes`
  printed verbatim) - this page only formats and prints it, no client-side computation of
  any figure.
- **Built:** `src/app/pos/bills/[billId]/invoice/` - a new top-level route
  (`/pos/bills/[billId]/invoice`, mirroring the backend's own bill-scoped path rather than
  nesting under `/pos/orders/[orderId]`, since the invoice endpoint is keyed by bill id
  only) with `page.tsx` (reads `billId` from the route param, no cookie/session lookup
  needed) and `bill-invoice-view.tsx`:
  - a small `useInvoice` hook (same "landed keyed by attempt" shape every other `/pos`
    screen's local fetch hook uses - see `bill-settle-view.tsx`/`refund-view.tsx`) adds one
    branch existing hooks don't need: a 409 `not_finalized` response renders a plain "This
    bill isn't finalized yet." state, distinct from the retryable `LoadErrorPanel` a 404 or
    any other failure still gets.
  - the loaded view renders every contract section - seller block (legal name, outlet
    name/address, `registrationLabel: number` so GSTIN and ABN share one line, FSSAI license
    only when present), invoice number + issued-at, a line table, subtotal, a discount row
    only when `discountMinor` is non-null, one row per `taxBreakdown` entry (label + rate +
    amount - this is what lets CGST+SGST and a flat GST render from the exact same markup),
    grand total, a "Prices include tax" line gated on `pricesIncludeTax`, a tenders list, a
    credit notes list, and `notes` printed verbatim - each list section only renders when
    non-empty.
  - **Print** (`window.print()`) and **Back to table map** sit in a `print:hidden` row -
    Tailwind's `print:` variant (the same mechanism `floor-plan/qr-print-sheet.tsx` already
    uses for its QR sheet) rather than a hand-written `@media print` block, so only the
    invoice content itself prints.
  - **Entry points:** a "Print invoice" link on the real, already-merged finalised-bill
    panels that already have a bill id in hand - `settle/bill-settle-view.tsx`'s
    `bill-finalised-panel` (alongside the existing Refund… link) and `counter/counter-view.tsx`'s
    `counter-settled-panel` (alongside Start next order) - both link to
    `/pos/bills/${bill.id}/invoice`. No table/token-number line on the invoice itself: the
    route only ever has a bill id, not the order, so there's nothing to derive it from
    without a second fetch the contract doesn't ask for (YAGNI).
- **Tests:** 8 new (`bill-invoice-view.test.tsx`) - an India fixture (GSTIN, FSSAI, CGST+SGST
  rows, a discount, tenders, a credit note, and notes) asserting every section renders, an
  Australia fixture (ABN, one flat GST row, `pricesIncludeTax: true`) asserting the
  "Prices include tax" line renders and the discount/tenders/credit-notes/notes sections
  correctly stay absent, the Print button calling `window.print`, the 409 not-finalized
  state, the 404 error panel plus its retry path - plus one assertion added to each of the
  two existing entry-point tests (`bill-settle-view.test.tsx`'s "after finalization" test,
  `counter-view.test.tsx`'s settle-in-one-flow test) confirming `print-invoice-link` points
  at the right bill id. 1042/1042 tests passing repo-wide; lint/typecheck/build clean.
- **Live verification:** none possible in this worktree (no running backend). Verified via
  the 8 tests above stubbing global `fetch` against the real, merged contract.

## Reconciliation (2026-09-02, restiq-web#98)

Every remaining self-authored `src/app/pos/api.ts` path (everything CAP-1/CAP-2/CAP-3/
CAP-4/CAP-10's earlier reconciliation, restiq-web#61, hadn't already covered) verified
against the real, merged `restiq-backend` and fixed. Read directly, not guessed: `src/pos/
{bills,orders,clock}/*.controller.ts`/`.service.ts`/`.dtos.ts`, `bill-core.ts`.

- **CAP-7 Bill & Settle** - the real contract is only four endpoints:
  `POST orders/:orderId/bill` (create), `GET bills/:id`, `POST bills/:id/finalize`,
  `POST bills/:id/refund` - there is no per-order `GET`, and no separate discount/tender
  endpoints at all. Every tender and any discount now ride together inside the one
  `finalize` call (`FinalizeBillDto`); `settle/bill-settle-view.tsx`/`counter/counter-view.tsx`
  accumulate them locally (`PendingTender`/`PendingDiscount`, `bill-state.ts`) and submit once.
  Tax is one flat 5% figure (`bill-core.ts`'s `TAX_RATE_PLACEHOLDER_PERCENT`), not a CGST/SGST
  split with a round-off line - neither exists anywhere in the schema. The manager-approval
  threshold is 20% of the subtotal (`bills.service.ts`'s `DISCOUNT_THRESHOLD_PERCENT`), not
  the old flat-10%-of-percent guess. `BillStatus` is `"open"`/`"finalized"`, not
  `"draft"`/`"finalised"`. A Bill carries no order lines, table label, or currency of its own
  - `bill-settle-view.tsx`/`counter-view.tsx`/`refund-view.tsx` now read the real Order
    (for lines) and Menu (for currency) separately and pass them into `BillSummary`.
  - **No lookup-by-orderId exists** (at the time of this pass). `POST orders/:orderId/bill`
    409s (`{code:'bill_already_exists'}`) with no id in the body when a bill already exists
    (`bill-core.ts`'s `createBillRecord`, read directly - it never looks the existing row
    up), and `OrderView` carries no `billId` field either. `api.ts`'s new
    `fetchOrCreateBill()` works around this the only way a client can: it remembers a
    bill's real id in `sessionStorage` (keyed by orderId, same pattern as
    `admin/(shell)/outlet-context.tsx`'s outlet-id cache) the moment it's ever seen one, and
    falls back to that cache on a 409. A fresh tab hitting an order another device already
    billed, with nothing cached, gets an honest error rather than a guess. **Superseded
    2026-09-02 by restiq-backend#98/restiq-web#117 - see the Reconciliation section at the
    end of this doc: the real fix was on the backend (make the POST itself idempotent), not
    a client-side cache.**
  - `settle/bill-settle-view.tsx`'s "Refund…" link now carries `?billId=` in the query
    string - the one place that already has a finalized bill's real id in hand - since the
    real refund endpoint targets the Bill, not the Order, and there's no other way to
    recover it (`refund/page.tsx` reads it back out).
- **CAP-9 Refunds** - `POST bills/:id/refund` (not `orders/:id/bill/refund`), body
  `{managerPin, reason, lines?}` (`RefundBillDto`) - one plain required `reason` string, no
  `refundMethod` field at all (a refund only ever produces a credit note, it doesn't choose
  how money moves - the old Cash/UPI-Reversal picker had nothing to bind to and is dropped).
  `refund-config-panel.tsx` composes `reason` from the reused `ManagerPinDialog`'s picked
  label plus any free-text manager notes. Tax reversal is still the same flat 5% placeholder
  and still folds a line's selected modifiers into its refundable unit price
  (`bills.service.ts`'s `refund()`) - the math the original self-authored guess used turned
  out to already be the right shape, just needed the field names (`orderLineId`, not
  `lineId`) and the endpoint/target fixed.
- **CAP-6 QSR Counter** - `startCounterOrder` now hits the real, merged
  `POST outlets/:outletId/counter-orders` (`orders.controller.ts`'s `createCounterOrder`),
  outlet-scoped like every other order-mutation route, not the guessed table-less
  `POST orders/counter`. `counter/page.tsx` now reads `outletId` server-side from the
  session cookie (same pattern as `table-map/page.tsx`/`shift/page.tsx`) and passes it down.
  Returns the same raw `RawOrder` wire shape every other order mutation does, mapped through
  `toOrderView` - not an already-mapped `OrderView`. Inherits every CAP-7 bill/settle fix
  above since this screen composes `BillSummary`/`TenderKeypad` directly.
- **CAP-11 Device & staff attendance status** - the real route is
  `GET outlets/:outletId/attendance` (no `/today`), and the response shape is entirely
  different: `staff` only ever lists staff *currently* clocked in (the latest `ClockEvent`
  per staff member today being a clock-in with no later clock-out -
  `attendance.service.ts`'s own filter) - there's no clocked-out entry to show, ever, so
  `clockOutAt` is gone. The mocked printer placeholder is a top-level `printerStatus: {
  status, mocked }` (`MockedPrinterStatus`), not nested under a `device` object, and
  `status` is a true `"connected"`-only literal type. There is no connectivity/offline
  signal anywhere in this response, or anywhere else in `pos/*` - not even a mocked one,
  unlike the printer's real field - so `device-status-screen.tsx` now passes
  `OfflineIndicatorPill` a permanently-static `"online"` prop instead of a fabricated
  response field, keeping DESIGN.md's two-chip layout honest about what's real (the printer
  chip) vs. purely decorative (this one). `printer-status-chip.tsx`'s dead "disconnected"
  branch (a state the real backend can structurally never send) was dropped along with it.
- **Everything else in `api.ts` was already correct** (table-map/order-taking/transfer/menu/
  clock-out/shifts, reconciled in restiq-web#61, plus `addOrderLine`'s DTO shape) - re-verified
  against the real controllers/DTOs during this pass, no changes needed. The one accepted,
  documented exception: `AddOrderLineInput.specialInstructions` is still sent on every add-line
  call and silently dropped server-side (`ValidationPipe({whitelist:true})`, no backing
  `OrderLine` column) - a harmless, already-flagged gap (`order-taking-state.ts`'s CAP-3
  header) left as-is, since removing the capture UI itself is a product/UX call outside an
  API-contract reconciliation's scope, not a wire mismatch.
- **Tests:** every test file touched by the above rewritten against the real contracts, not
  weakened - `bill-state.test.ts`, `bill-settle-view.test.tsx`, `refund-state.test.ts`,
  `refund-view.test.tsx`, `counter-view.test.tsx`, `device-status-screen.test.tsx`. Full
  suite green (924/924), `tsc --noEmit`/lint/build all clean.
- **Live verification:** none possible - no reachable restiq-backend instance from this
  environment, same constraint as every other not-yet-backed story in this doc. Verified by
  reading the real controller/service/DTO source directly (cited per bullet above) rather
  than guessing from a spec, plus the full rewritten test suite.

## Reconciliation (2026-09-02, restiq-backend#96) - floor/table display names close the last raw-id gaps

restiq-web#96 reported the table map's floor headings and the order-taking/bill-settle
headers rendering raw UUIDs (`FLOOR 01a06107-…`, `TABLE 01a06108-…`) instead of names.
restiq-backend#96 (merged to `main`) closes exactly this by adding two additive fields,
verified directly against `src/pos/orders/orders.dtos.ts`/`orders.service.ts` on that repo's
`main`:

- **`TableMapEntry.floorName: string`** - the real Floor's name, joined server-side
  (`orders.service.ts`: `floorName: t.floor.name`) - alongside the existing `floorId`.
  `table-map-state.ts`'s `RawTableMapEntry`/`TableMapEntry`/`FloorGroup` all carry it now;
  `groupTablesByFloor`'s heading is `floorName`, falling back to the raw `floorId` only if
  the field is somehow missing - never the other way round. Closes the gap this doc's CAP-2
  section previously flagged ("there is no floor-name lookup endpoint for pos").
- **`OrderView.tableLabel: string | null`** - the DiningTable's real label for a dine-in
  order, `null` for a counter order (`orders.service.ts`: `tableLabel: table?.label ?? null`)
  - present on every endpoint that returns an `OrderView` (get/lines/status/transfer,
  open-orders, start-order, counter-orders). `order-taking-state.ts`'s `RawOrder`/`OrderView`
  carry it now; `orderOriginLabel` reads it (`Table {tableLabel}` / `Counter`), falling back
  to the raw `tableId` only if the field is somehow missing. `open-orders-state.ts`'s
  `RawOpenOrder`/`toOpenOrderEntry` follow the same fallback rule for the open-orders list.
  Closes the gap this doc's CAP-3/CAP-5 sections previously flagged (`tableLabel` as a
  raw-id-fallback field, no label lookup existing server-side).
- **Screens fixed:** table map's floor group heading (`table-map.tsx`), the order-taking
  header and order panel (`order-taking-view.tsx`/`order-panel.tsx`), the Bill & Settle
  header (`settle/bill-settle-view.tsx` via `BillSummary`'s `originLabel`), and the open &
  held orders list (`open-orders-screen.tsx`) - every one of them was reading
  `orderOriginLabel`/`groupTablesByFloor` already, so fixing the two shared functions fixed
  every caller in one pass, no per-screen patch.
- **Tests:** fixtures across `table-map-state.test.ts`, `table-map.test.tsx`,
  `order-taking-state.test.ts`, `order-taking-view.test.tsx`, `bill-settle-view.test.tsx`,
  `open-orders-state.test.ts`, `open-orders-screen.test.tsx` (plus `counter-view.test.tsx`/
  `refund-view.test.tsx` for the now-required `tableLabel` field) updated to the real
  `floorName`/`tableLabel` shape, with explicit regression assertions that a rendered header
  contains the name and never the raw UUID, plus the fallback-to-id and counter-order
  (`null` label) cases. Full suite green (1002/1002), `tsc --noEmit`/lint/build all clean.
- **Live verification:** none possible from this environment (same constraint as every other
  story above) - verified by reading `restiq-backend`'s real, merged `main` DTOs/service
  directly rather than guessing from the issue's description.

## Reconciliation (2026-09-02, restiq-backend#98/restiq-web#117) - the bill POST is now idempotent, the sessionStorage cache is gone

restiq-backend#98/PR #99 (merged) made `POST /pos/v1/orders/:orderId/bill` idempotent per
order: the first call still returns 201 with a new `BillView`, but every later call for the
same order (open or finalized) now returns 200 with that *same* `BillView` - never a 409
`bill_already_exists`, never a second row (`bill-core.ts`'s `createOrGetBillRecord`, read
directly, replaces the old throw-on-existing `createBillRecord`). Only an order closed with
no bill ever created still 409s (`{code:'conflict'}`). The guest realm's
`POST /guest/v1/orders/:orderId/bill` got the identical treatment.

This retires the client-side workaround the CAP-7 reconciliation above documented for
exactly this gap:

- **`src/app/pos/api.ts`'s `fetchOrCreateBill()`** - the `sessionStorage` bill-id cache
  (`rememberBillId`/`recallBillId`) and the 409-then-`GET bills/:id` fallback are gone.
  `posApi()` already treats any 2xx as success, so a plain `POST orders/:orderId/bill` is
  now the entire function - the same call now correctly answers a fresh tab hitting an
  already-billed order too, which the old cache-dependent fallback could not (its only
  honest option there was to rethrow the 409).
- **`src/app/qr/checkout/checkout-api.ts`'s `createOrFetchBill()`** - never held a
  `sessionStorage` cache (the guest side already had a real `GET orders/:orderId/bill` to
  fall back to), but its 409-catch fallback existed only to resolve the *create* race
  between two guests requesting the bill at once - a race the backend itself now resolves
  atomically (the same `createOrGetBillRecord` guest/bills reuses through `pos/bills`'
  scoped barrel). That race can no longer surface as a `bill_already_exists` 409 at all, so
  the fallback was dead code; simplified to the same plain `POST`. The now-unused
  `fetchBill()` (`GET orders/:orderId/bill`) was removed with it - nothing else called it.
- **Tests:** `bill-settle-view.test.tsx` and `checkout-screen.test.tsx` no longer stub a
  `bill_already_exists` 409 or seed `sessionStorage`; both now assert the 200-repeat-call
  path renders the same bill, and `bill-settle-view.test.tsx` adds an explicit fresh-tab
  case (a `sessionStorage` getter that throws if touched at all) plus a genuine-409
  (closed order, no bill) error-state case. Full suite green, `tsc --noEmit`/lint/build all
  clean.
- **Live verification:** none possible from this environment, same constraint as every
  other story in this doc - verified by reading restiq-backend's real, merged
  `src/pos/bills/{bill-core.ts,bills.service.ts,bills.controller.ts}` and
  `src/guest/bills/{bills.service.ts,bills.controller.ts}` directly.
