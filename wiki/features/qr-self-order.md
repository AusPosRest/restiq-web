# QR Self-Order (Guest Mobile Web) - web

Frontend for the `/qr` realm: the fifth disjoint auth realm (spec-qr-self-order
SPEC.md Constraints, `aud: guest`) and the first RESTIQ realm whose principals aren't
staff - guests with no account, no app, no login, ever. See
`restiq-design/docs/specs/spec-qr-self-order/SPEC.md` for the full capability set
(CAP-1..6), `screens.md` for the seven designed screens (Q1-Q7), and
`restiq-design/docs/ux/ux-qr-self-order-2026-08-27/` (DESIGN.md, EXPERIENCE.md) for the
design system and behavioral spine; this doc tracks what's actually built here, story by
story. Backend counterpart: `restiq-backend`'s guest realm (issue #68, merged to `dev`
as PR #69 - `src/guest/sessions/`) - see CAP-1's Reconciliation section below for what
changed once it landed.

## CAP-1 - QR entry and table session (story 1, issue #64)

- **Intent:** a guest scans the table QR and reaches the outlet's menu in their browser
  with no app or account; the first guest starts the session (name + phone) and gets a
  shareable 4-digit PIN; later guests join with that PIN; an outlet with `qr_ordering`
  disabled serves a polite unavailable page, never the menu.
- **Built:**
  - **Realm wiring** (extends AD-4's pattern once more, mirroring `/pos`'s AD-13 wiring):
    `src/lib/guest-session.ts` (`guest_session` httpOnly cookie, 4h max-age matching the
    SPEC's idle-TTL backstop; `decideGuestRoute` shares the JWT-expiry check via
    `src/lib/session-token.ts`, same as every other realm). `src/proxy.ts` branches on
    `/qr` alongside the existing `/ops`/`/admin`/`/pos` branches. This story only ships
    the QR entry point itself (welcome + session PIN), which is reachable with or
    without a session - `decideGuestRoute` already has the session-gate shape later
    screens (menu/cart/checkout/status) will need, redirecting an expired/missing token
    back to bare `/qr` rather than a dead end.
  - **Table-QR entry URL:** `/qr/t/[outletId]/[tableId]` (SPEC Assumptions: "a
    documented per-table URL pattern suffices for the demo" - physical QR generation is
    Tenant Admin territory, out of scope here). `src/app/qr/t/[outletId]/[tableId]/page.tsx`
    is a server component: it resolves the `qr_ordering` capability gate *before* any
    guest-facing UI renders (`availability.ts`'s `checkAvailability`), so the menu is
    never reachable when ordering is off, and an unavailable/unreachable outlet fails the
    same warm way (`unavailable-view.tsx`) rather than a raw error. See Reconciliation
    below - this replaced a pre-merge `table-status.ts` that also resolved a per-table
    session-open status, which the real backend doesn't expose.
  - **Q1 Welcome + Q2 Session PIN** (`welcome-flow.tsx`, `welcome-flow-state.ts`): one
    client component covering both designed screens as view states, not separate routes
    - EXPERIENCE.md's IA treats them as one linear step and nothing yet needs to
      deep-link into the middle of starting/joining. There is no backend lookup that
      says whether a table already has an open session, so the screen shows both
      affordances up front - "Start ordering" (name+phone form) primary, "Join your
      table" (name field + 4-digit keypad, auto-submitting at 4 digits like the POS PIN
      pad) secondary - and discovers the truth reactively from the start/join responses
      themselves (see Reconciliation below).
    - **Starting** proceeds straight to the PIN screen with no extra ceremony
      (EXPERIENCE.md "The solo lunch") - the PIN is shown large with a "share this PIN"
      caption and a copy-to-clipboard action.
    - **Joining** shows a plain inline error on a wrong PIN ("That PIN didn't match -
      ask your table for the 4-digit code" - the backend's own message, passed through
      untouched) and clears the PIN dots for another attempt; no lockout drama on a
      merely-wrong PIN, since this PIN gates a cart, not money (SPEC Constraints) - a
      real 5-attempts/30s lockout (429 `locked_out`) still renders its own plain message.
    - **a11y (WCAG 2.1 AA floor):** labeled inputs, visible focus rings on every
      interactive control, inline errors via `role="alert"`, and an `aria-live="polite"`
      region wrapping the whole state area so a screen-reader guest hears the
      start→PIN, join→joined, or mode-flip convergence.
  - **Auth route handlers** (`src/app/qr/auth/start/route.ts`,
    `src/app/qr/auth/join/route.ts`): exchange name+phone or PIN+name for a guest JWT,
    stored in an httpOnly `guest_session` cookie the browser never reads directly
    (mirrors every other realm's auth route pattern) plus a small non-sensitive
    `guest_display` cookie (outlet/table/name/PIN) for later screens to render from
    without a session-read endpoint.
  - **API pass-through** (`src/app/qr/api/[...path]/route.ts`): mirrors
    `/pos/api/[...path]`'s pattern exactly, attaching the `guest_session` cookie's JWT
    as a bearer token to `${NEXT_PUBLIC_API_URL}/guest/v1/*`. No screen in this story
    calls it yet (start/join have no session token to attach) - later Q-screens (menu,
    cart, checkout, status) are the first real callers.
  - **`.qr-theme`** (`src/app/globals.css`): same charcoal-and-amber ground as every
    staff surface, but the one 12px-radius exception in the family (every staff surface
    uses 8px) plus its own FSSAI veg/non-veg and stepper-status color vocabulary, set up
    now for the menu/status screens that will use it.

### Reconciliation (pre-merge guessed contract -> the real `/guest/v1/*`)

Issue #68 (`feature/68-guest-session`) hadn't pushed a reachable branch when story 1
shipped, so it built against `spec-qr-self-order/SPEC.md`'s stated contract alone and
flagged the result NOT YET RECONCILED, same discipline `pos-cashier-waiter.md` uses for
its own pre-merge contract reads. That branch has since merged to `restiq-backend/dev`
as PR #69 (`src/guest/sessions/sessions.{controller,dtos,service}.ts`, read directly).
This pass reconciled the guess against it:

- **There is no per-table session-status lookup - the biggest assumption was wrong.**
  The guessed `GET /guest/v1/tables/{outletId}/{tableId}` (`{ outlet, table,
  qrOrderingEnabled, sessionOpen }`) does not exist on the real backend at all. The only
  public pre-session endpoint is per-*outlet*, not per-table, and says nothing about
  session state: `GET /guest/v1/outlets/:outletId/availability` -> `{ available: boolean,
  reason?: "not_found" | "qr_ordering_disabled" }`. `table-status.ts` and its test were
  deleted outright and replaced with `availability.ts`/`availability.test.ts`, which only
  resolve the `qr_ordering` gate.
- **Consequence: the Welcome screen can no longer pick a single mode server-side.**
  `welcome-flow-state.ts`'s `initialFlowState` dropped its `sessionOpen` parameter and
  always starts in `start-form`; `welcome-flow.tsx` shows both affordances up front
  ("Start ordering" primary, a "Join your table" link secondary) and discovers the truth
  reactively from the real error codes: a start that 409s with `session_already_open`
  flips into `join-form` with a friendly notice line ("Your table already has an order
  going - join it with the PIN below") instead of surfacing it as a failed submission;
  a join that 404s with `no_open_session` flips back to `start-form` the same way
  ("This table doesn't have an order started yet..."). Manual switch links exist too, so
  a guest isn't forced through a failed attempt just to change mode. Both flip paths and
  the underlying state machine got explicit tests (`welcome-flow.test.tsx`,
  `welcome-flow-state.test.ts`).
- **Real error codes/statuses differ from the SPEC-only guess and were fixed
  throughout** (`types.ts`, the route handlers' comments, `welcome-flow.tsx`'s
  status/code branching, and every affected test): a wrong PIN is **403** `invalid_pin`
  (guessed 401), joining a table with no open session is **404** `no_open_session`
  (guessed a generic "no active session" without a stable code), the join lockout is
  **429** `locked_out` at 5 attempts/30s per outlet+table (guessed a looser "rate
  limited"), and the capability gate's code is `qr_ordering_disabled` (guessed
  `capability_disabled`). Every error still follows the house `{ error: { code, message
  } }` envelope, which the pre-merge guess had already gotten right (`GuestApiError`),
  so the route handlers' pass-through logic needed no change - only their types and
  comments did.
- **`TableSessionView` is richer than the guessed `{ outletId, tableId }`** - real shape
  is `{ sessionId, status, table: { id, label }, outletId, guests: [{ id, name,
  joinedAt }], createdAt, expiresAt, closedAt }`. `types.ts` now matches it exactly, but
  nothing in this story's UI consumes the extra fields yet (later Q-screens will, once
  `GET /guest/v1/session` has a caller).
- **A confirmed, permanent gap, not a bug:** the real contract has no endpoint that
  returns an outlet's display name or a table's label before a session exists - not
  `availability` (`{ available, reason }` only) and not even `TableSessionView` (it
  carries a table `label`, but no outlet name at all, anywhere). The pre-merge welcome
  screen's `qr-outlet-name`/`qr-table-label` header was built on the assumed
  `table-status` endpoint and is gone along with it; `unavailable-view.tsx` similarly
  lost its `outletName` prop (it never has a real one to show now) and always renders
  "This restaurant". Whoever builds CAP-2's menu screen should expect to source outlet
  branding from wherever the menu-fetch endpoint (not yet built) puts it, not retrofit a
  pre-session outlet-name lookup here.
- **Live-verified**, not just mocked: `restiq-backend`'s `dev` branch was run locally
  (Postgres `restiq_demo`, `GUEST_JWT_SECRET` set) against this build's dev server for a
  full click-through - start a session (real PIN returned), a second start on the same
  table 409ing into join mode with the real message, joining with the wrong PIN (403,
  real message), joining with the right PIN (200, real guest added to the real session),
  joining a table with no session 404ing back into start mode, and the outlet-disabled
  unavailable page - all against the genuine `sessions.controller.ts`, not a stub.

## Conventions established for later Q-screens (stories 2-6 build on these)

- **Route group:** `src/app/qr/` is the guest realm root; today it holds
  `t/[outletId]/[tableId]` (entry, pre-session), `auth/{start,join}` (route handlers),
  `api/[...path]` (backend pass-through), and `cart/` (CAP-3, story 3 - see below).
  **Corrected from this doc's earlier guidance:** later post-session screens (menu,
  cart, checkout, status) are **flat** paths directly under `/qr/` (`/qr/menu`,
  `/qr/cart`, ...), **not** nested under `t/[outletId]/[tableId]/`. The previous version
  of this doc said to nest them there for URL continuity, but `decideGuestRoute`'s entry
  regex (`^\/qr\/t\/[^/]+\/[^/]+(\/|$)`, unanchored at the end) matches *any* path
  starting with the entry point, including a nested `/qr/t/o1/t1/cart` - so nesting a
  session-scoped screen there would have made it reachable with no session at all,
  silently bypassing the gate the code's own comments said it would get. Story 3
  end-anchored the regex (`\/?$`) to close that gap and confirmed a session is always
  required for anything past the bare entry point; the flat-path convention sidesteps it
  entirely for every future screen. Outlet/table context after a session starts comes
  from the JWT (`GuestPrincipal.outletId`/`tableId`, embedded server-side), not the URL -
  it never needed to be a path segment.
- **Cookie:** `guest_session` (httpOnly JWT, `aud: guest`) + `guest_display` (small
  non-sensitive JSON: outletId/tableId/guestName/pin, **plus `guestId`** as of story 3 -
  see below) - both set by `src/app/qr/auth/session-cookies.ts`'s `guestSessionResponse`,
  parsed via `parseGuestSessionDisplay` in `src/lib/guest-session.ts`.
- **Entry URL pattern:** `/qr/t/[outletId]/[tableId]` - the table-QR target; bare `/qr`
  is only ever reached via an expired-session redirect or a mistyped link, never a real
  guest's first hit.
- **Proxy/session gate:** `decideGuestRoute` in `src/lib/guest-session.ts` allows exactly
  `/qr/t/[outletId]/[tableId]` (now end-anchored, see above) and `/qr/auth/*`
  unconditionally (the entry point must always be reachable, even with an expired token,
  so a guest can rejoin); every other `/qr/*` path - flat, post-session screens included -
  requires a live (non-expired) `guest_session` token or redirects to bare `/qr`. Later
  screens fall straight into this existing gate with no proxy changes needed, as long as
  they stay flat.

## CAP-3 - Shared group cart and table order review (story 3, issue #68)

- **Intent:** every guest in the session adds to one shared table cart, each line
  attributed to the guest who added it; the group reviews the combined table order
  (Q5) grouped by guest with per-guest subtotals and a combined total; every phone
  converges on the same view within one ~5s poll.
- **Built against the real, merged backend contract** (restiq-backend PR #74,
  `src/guest/cart/cart.{dtos,controller,service}.ts`, read directly - not a guess):
  `GET /guest/v1/cart` -> `TableCartView { sessionId, guests: [{ guestId, guestName,
  lines: [{ id, guestId, guestName, itemId, itemName, variantId, variantName, quantity,
  unitPriceMinor, modifiers, lineTotalMinor, createdAt }], subtotalMinor }], totalMinor,
  currency }`; `PATCH /guest/v1/cart/lines/:id { quantity? }`; `DELETE
  /guest/v1/cart/lines/:id`. Every endpoint 410s `session_closed` once the session ends.
- **Route:** `/qr/cart` (`src/app/qr/cart/page.tsx`, `cart-screen.tsx`) - flat and
  session-gated, per the corrected convention above.
- **"Whose id am I?"** The cart contract identifies lines by `guestId`, but the guest
  realm had no way to know its own id client-side until now - `guest_display` only
  carried outlet/table/name/pin. Story 3 added `guestId` to it: `session-cookies.ts`'s
  `guestSessionResponse` now decodes the JWT's own `sub` claim (`decodeTokenSubject`,
  new in `src/lib/session-token.ts`, unverified - same posture as the existing
  `tokenIsExpired`, verification stays the backend guard's job) and stamps it into the
  cookie at start/join time, no new endpoint needed. `cart/page.tsx` reads it
  server-side (same pattern as `pos/(shell)/layout.tsx` reading `pos_staff`) and passes
  it down as `myGuestId`.
- **Own-line-editable, everyone-else-read-only:** `cart-screen.tsx` only ever renders a
  quantity stepper/remove button on a guest group where `guest.guestId === myGuestId`;
  every other guest's lines render as plain text with a read-only `×N` quantity. A 403
  from editing someone else's line is therefore never reachable from this UI at all -
  there's no button to press, not just a disabled one.
- **Polling (~5s, `CART_POLL_MS`):** `use-cart-poll.ts` mirrors
  `ops/(shell)/sync-health/use-live-sync-health.ts`'s derived-loading shape, but
  deliberately *not* its "N updates - refresh" gating - EXPERIENCE.md is explicit for
  this screen ("shared-cart and status polls update in place, never blank-and-repaint"),
  so a successful poll always replaces the shown cart directly; a failed poll after the
  first keeps the last-known cart with a quiet `cart-stale-note`, never a blank screen. A
  410 flips to a session-ended state and stops the interval outright (polling a session
  that will never reopen would be pointless). An own-line mutation's response is pushed
  straight into the same state via `applyUpdate` rather than waiting up to 5s for the
  next tick to show it.
- **a11y (WCAG 2.1 AA floor):** the guest-group list sits in an
  `aria-live="polite"` region (`aria-label="Shared table cart"`) so a screen-reader
  guest hears convergence without a page refresh; every stepper button has a
  descriptive `aria-label` naming the item, not just "increase"/"decrease".
- **Empty state:** "Nothing yet" with a "Browse the menu" link. Issue #67 (Q3 Menu
  Browse, CAP-2) is being built concurrently by a sibling story and had no merged route
  as of this build (`git diff` against its branch was empty) - the link points to the
  conventional flat path `/qr/menu` per the corrected routing convention above, which
  is also the exact literal `decideGuestRoute`'s own pre-existing test used as its
  "future gated path" example. **Needs reconciliation** once #67 actually lands, if its
  route differs.
- **Money formatting:** `cart-state.ts#formatMinor` is a small, deliberate duplicate of
  `pos/(shell)/shift/shift-state.ts#formatMinor` (₹ symbol, 2 decimals) - AD-4's
  realm-isolation rule (`app/qr` may not import from `app/pos`) means it can't be
  shared, same discipline that file's own header documents for itself.

## CAP-4 - Place order into the real pipeline (story 4, issue #78)

- **Intent:** Q5's "Place order" CTA - previously permanently disabled with a
  "coming next" caption (story 3's placeholder, same position/size so this story only
  had to wire one button) - converts the session's shared cart into a real order fired
  to the kitchen, per EXPERIENCE.md's "Place order is the surface's biggest commitment".
- **Built against the real, merged backend contract** (restiq-backend PR #79,
  `src/guest/orders/orders.{controller,dtos,service}.ts`, read directly - the local
  checkout of `restiq-backend`'s `dev` was stale and needed a fetch to reach it):
  `POST /guest/v1/orders` (guest token, no body) -> 201 `PlacedOrderView { orderId,
  tableId, status: 'sent', source: 'qr', sessionId, lines: PlacedOrderLineView[] }`
  where each line carries `{ id, itemId, itemName, variantId, variantName, quantity,
  unitPriceMinor, seatNumber, guestId, guestName, modifiers }`; 400 `empty_cart`
  (nothing in the session's cart); 400 `no_price` (an item's price disappeared between
  cart-add and placement); 410 `session_closed`.
- **`cart-api.ts`** gained `placeOrder()` (posts through the existing `/qr/api`
  pass-through, same `guestApi` wrapper every other cart call uses) plus the
  `PlacedOrderView`/`PlacedOrderLineView`/`PlacedOrderLineModifierView` types, copied
  field-for-field from the real `orders.dtos.ts`.
- **The CTA** (`cart-screen.tsx`) is enabled exactly when `isCartEmpty(cart)` is false -
  the same pure helper story 3 already had, no new gating logic. A tap posts
  `placeOrder()`; while in flight the button reads "Placing order…" and is disabled to
  prevent a double-tap from this same guest queuing a second request.
- **Success:** there is no Q6 Checkout or Q7 Order Status route on this branch yet
  (separate stories, story 6/issue #78's own sibling scope is Q7), so a placed order
  swaps Q5 for a small, un-numbered confirmation state rather than navigating into
  either - the order id (last 6 characters, uppercased, since nothing in the response
  is meant to be a human-facing order number), "Sent to the kitchen", and a per-guest
  line summary grouped straight from the real `PlacedOrderView.lines` (`cart-state.ts`'s
  new `groupPlacedOrderLinesByGuest`, a pure, tested helper - first-appearance order,
  no framework dependency, same discipline as `isCartEmpty`/`isOwnLine`). A "Track your
  order" link points at the conventional flat path `/qr/status` (session-gated,
  matching the same routing convention `MENU_ROUTE`'s comment documents) - issue #78's
  sibling story (Q7 stepper) had no merged route as of this build, so the link may 404
  until it lands; **this story does not build the stepper**, per its own scope.
- **Errors, each handled per EXPERIENCE.md's "Error" state pattern (named inline at the
  action, never a raw crash):**
  - `empty_cart` on a *literally* empty cart is unreachable from this UI - the CTA is
    disabled first. The only way this code actually surfaces is the race below.
  - 410 `session_closed` (the session ended between page load and the tap) routes to
    the same `SessionEndedPanel` a stale poll would have reached anyway - no new state.
  - `no_price` renders the backend's own message inline at the sticky bar, untouched -
    same convention as CAP-1's PIN errors and CAP-2's `item_unavailable`.
- **Concurrent placement (EXPERIENCE.md's own named state): "if two guests hit 'Place
  order' near-simultaneously, one succeeds and the other converges to the placed state
  ... no error shown for the race."** Read the real `orders.service.ts` transaction to
  find out what the loser actually gets back, rather than guessing: placement loads the
  session's `CartLine`s inside one transaction, 400s `empty_cart` if none exist, and
  deletes every `CartLine` on success. A second guest's `placeOrder()` that starts after
  the first has committed therefore reads zero `CartLine`s and gets back the **exact
  same 400 `empty_cart`** a genuinely empty cart would - the backend has no distinct
  "someone already placed this" error code. Since the CTA is only ever tappable against
  a locally-known non-empty cart, any `empty_cart` response to an actual tap is by
  construction this race, not a real validation failure. `cart-screen.tsx`'s
  `handlePlaceOrder` treats it that way: on `empty_cart`, re-fetch `GET /guest/v1/cart`
  to confirm convergence (push the fresh cart into the existing poll state either way);
  if it now reads empty, land on the same "Sent to the kitchen" outcome the winner
  sees (`OrderPlacedElsewhere`, no order-specific detail since the loser's own request
  never got a `PlacedOrderView` to show) - never the plain-inline-error path. If the
  re-fetch somehow still shows a non-empty cart (not reachable in practice against the
  real transaction above), it falls back to a plain "couldn't place the order" inline
  error rather than silently pretending convergence.
- **a11y:** the placement error reuses the sticky bar's existing `role="alert"`
  pattern; the confirmation and race-convergence states are plain landmark `<main>`s
  with a real `<h1>`, no live region needed since they fully replace the screen (no
  partial update for a screen reader to catch mid-flight).

## CAP-6 - Guest order status stepper (story 6, issue #82)

- **Intent:** Q7's live stepper (Placed, Accepted, Preparing, Ready - amber active,
  green done), server-derived from the order's real ticket lifecycle by polling,
  reaching Ready when the kitchen bumps the last ticket - never showing a state the
  data doesn't support (EXPERIENCE.md, stories.yaml story 6).
- **Route:** `/qr/status` (`src/app/qr/status/`) - flat and session-gated, per the
  established convention; falls straight into the existing `decideGuestRoute` gate
  with no proxy changes needed.
- **Built against the real, merged backend contract** (restiq-backend PR #83,
  `src/guest/orders/orders.{dtos,controller,service}.ts`, read directly): `GET
  /guest/v1/session/orders` -> `GuestSessionOrdersView { sessionId, orders:
  GuestOrderStatusView[] }` where each `GuestOrderStatusView` is `{ orderId,
  tableId, step, steps: [{ step, reachedAt }] }`, `step`/`steps[].step` one of
  `'placed' | 'accepted' | 'preparing' | 'ready'`. Every endpoint 410s
  `session_closed` once the session ends, same as every other `/guest/v1/*` call.
  This screen only calls the session-wide list endpoint - the real backend's
  sibling per-order `GET /guest/v1/orders/:orderId/status` exists but has no caller
  here, since the list already returns every order's full stepper state in one poll.
- **The honest step mapping, read straight off the real service (not re-derived
  client-side):** `orders.service.ts`'s `buildOrderStatusView` maps the ticket model
  directly - `placed` reaches at order creation; `accepted` and `preparing` reach at
  the exact same instant (the earliest ticket `firedAt`) because the real `Ticket`
  model has no separate "started cooking" state, so **a freshly placed guest order
  already reads `step: 'preparing'`** the instant it's placed (placement fires
  tickets synchronously - see CAP-4's `fireOnSend` call); `ready` reaches only once
  *every* ticket on the order is bumped, at the latest `bumpedAt`. `status-state.ts`'s
  `stepState(step, furthestStep)` highlights purely by comparing each step's index in
  `STEP_ORDER` against the order's own `step` field (the backend's "furthest reached"
  value) - never by checking whether `reachedAt` is non-null, though the two always
  agree by construction per the backend's own invariant. `reachedAt` is rendered
  wherever non-null and omitted (not fabricated) wherever null.
- **Polling (`STATUS_POLL_MS`, 5s):** `use-status-poll.ts` is a near-verbatim copy of
  `cart/use-cart-poll.ts`'s shape (EXPERIENCE.md's Foundation: "~5s polling for
  anything shared (cart, status)") - a successful poll always replaces the shown
  order list in place, a failed poll after the first keeps the last-known list with a
  quiet `qr-status-stale-note`, and a 410 flips to the shared `SessionEndedView` and
  stops the interval outright (a closed session's orders will never change again).
- **Newest-first:** the real endpoint returns orders `createdAt`-ascending
  (`orders.service.ts`'s `listSessionOrders`); `status-state.ts`'s
  `sortOrdersNewestFirst` reverses by each order's own `placed` step `reachedAt`
  (always non-null) rather than trusting array order, in case that ever changes
  server-side.
- **Empty state:** "No orders yet" with a "Browse the menu" link to the conventional
  `/qr/menu` path - this is the first guest hasn't placed anything yet, distinct from
  the shared cart's own "Nothing yet" empty state.
- **Theming:** `--step-active`/`--step-done` were declared in `.qr-theme` back in
  story 1's CAP-1 build for exactly this later screen, but never mapped to a Tailwind
  utility class. This story adds `--color-step-active`/`--color-step-done` to the
  global `@theme inline` block (`globals.css`, alongside the KDS ticket-color
  convention it mirrors) so `bg-step-active`/`bg-step-done` work - the first story to
  actually consume them.
- **Story 4's link now resolves:** CAP-4's `PlacedConfirmation`/`OrderPlacedElsewhere`
  states both link "Track your order" to `/qr/status`, built at the time against a
  documented guess (the route didn't exist yet, comment flagged a possible 404). That
  guess matched exactly - no route change was needed, only the stale comment updated
  to remove the 404 caveat.
- **a11y (WCAG 2.1 AA floor):** the order list sits in an `aria-live="polite"` region
  (`aria-label="Your orders' status"`) so a screen-reader guest hears convergence
  without a refresh, per EXPERIENCE.md's explicit call-out for the status stepper.
  Each step carries `aria-current="step"` when active plus an `sr-only` " - done" /
  " - in progress" / " - not yet reached" suffix, so state is never color-only (done
  also carries a checkmark glyph, not just the green fill) and is announced by name,
  not just position.
- **Verified live:** the real `orders.dtos.ts`/`orders.service.ts` were read directly
  off restiq-backend's `dev` branch (pulled fresh - the checkout was one commit
  behind and PR #83 hadn't been pulled yet). The dev server was run directly (a
  synthetic, non-expired `guest_session` cookie was enough to clear the proxy gate,
  which only checks expiry, never the signature) to confirm: an unauthenticated or
  malformed-token hit on `/qr/status` 307s to `/qr` same as every other post-session
  screen, and a live session reaches the real page (confirmed via its SSR'd loading
  shell in the `.qr-theme` wrapper). A full click-through against a running backend
  + seeded order was not performed in this pass (would need Postgres + migrations +
  a seeded session/order) - the stepper's actual state rendering (all four
  highlighted states, `reachedAt` display, empty/410/error states) is instead
  covered by `status-screen.test.tsx`'s full-component-tree tests against the real
  response shape.
- **Test coverage:** `status-state.test.ts` (pure step-highlighting/sort/format
  logic), `use-status-poll.test.ts` (fake-timer polling: initial load, ~5s
  convergence, staleness on a failed poll, 410 stopping the interval - mirrors
  `use-cart-poll.test.ts`), `status-screen.test.tsx` (newest-first ordering, correct
  step highlighted including the "freshly placed = preparing active" case,
  `reachedAt` shown only where non-null, empty state, 410 session-ended state, error
  + retry, the `aria-live` region).

## CAP-2 - Menu browse and item detail (story 2, issue #67)

- **Intent:** guests browse the real outlet menu (categories, item cards with price and
  allergen tags) and configure variants/modifiers under exactly the POS's min/max rules;
  an unavailable item stays visible but can't be added.
- **Built:**
  - **`src/app/qr/menu/`** (`/qr/menu`) - Q3 Menu Browse
    (`page.tsx`/`menu-view.tsx`) and **`src/app/qr/menu/[itemId]/`**
    (`/qr/menu/[itemId]`) - Q4 Item Detail (`page.tsx`/`item-detail-view.tsx`), both
    flat session-gated routes per the corrected convention above.
    `menu-state.ts` holds every pure rule (price resolution, search/category filtering,
    modifier min/max validation, the sticky bar's confirm gate) - a fresh, small copy of
    the same discipline as `pos/orders/[orderId]/order-taking-state.ts`'s ModifierSheet
    logic (AD-4 forbids importing across `app/pos`/`app/qr`, and the two realms' menu
    DTOs genuinely differ - see below).
  - **Real contract, read directly off restiq-backend `dev`** (`src/guest/menu/
    menu.dtos.ts` + `cart.dtos.ts`, PRs #73/#74 merged): `GET /guest/v1/menu` ->
    `GuestMenuView { outletId, categories: [{ id, name, sortOrder, items: [...] }] }` -
    items nest inside categories already, no separate flat list/categoryId join needed
    client-side. `GET /guest/v1/menu/items/:itemId` powers Q4 directly. Notably,
    `GuestMenuView` has **no top-level currency** (unlike the POS realm's menu view) -
    every item/variant carries its own nullable `priceMinor`/`currency`, so this client
    never assumes one global currency.
  - **Add to cart:** Q4's sticky bar posts the real `POST /guest/v1/cart/lines`
    (`{ itemId, variantId?, quantity, modifierIds? }`) through the existing `/qr/api`
    pass-through. `item_unavailable` and `modifier_selection_invalid` (the exact codes
    the real `cart.service.ts` throws) render as an inline error at the action, per
    EXPERIENCE.md's error state pattern - never a raw crash. A successful add refreshes
    the shared cart summary and returns the guest to the menu.
  - **Session end (410):** every CAP-2 fetch (menu, item, add-to-cart) that gets back a
    410 `session_closed` (the real `loadActiveSession` guard in `cart.service.ts`)
    routes to a new shared `src/app/qr/session-ended-view.tsx` ("This table's session
    has ended - scan again to start a new one") - no such shared state existed before
    this story.
  - **CartPill (shared with issue #68):** `src/app/qr/cart-summary.ts` exports
    `useCartSummary()`/`summarizeCart()`/`TableCartView` wrapping the real
    `GET /guest/v1/cart` - a real count/total, not a fabricated stub, polled every 5s
    (EXPERIENCE.md Foundation). `src/app/qr/cart-pill.tsx` renders it (hidden while the
    cart is empty, per EXPERIENCE.md's empty-state pattern). **Issue #68 (CAP-3's Table
    Order/Q5 review screen), building concurrently, should adopt this hook/shape rather
    than re-deriving count/total from its own parallel read of the same endpoint** -
    the pill's `onClick` is presently a no-op placeholder since Q5 has no route on this
    branch yet; #68 should wire it to `/qr/cart` once that lands.
  - **`welcome-flow.tsx`** gained a "Browse Menu" sticky-bar CTA on both the
    session-started and joined panels, linking to the new menu route - closing the gap
    where CAP-1 had nowhere for a guest to go next.
  - **Known, deliberate gaps - be honest, don't fabricate** (schema doesn't support
    these; see `menu-state.ts`'s header comment for the full reasoning): no dish photos
    (an initial-letter tile stands in), no bilingual (Hindi) names, no veg/non-veg FSSAI
    marker, no star ratings, no "bestseller" badge, no dish description on Q4 - the real
    `MenuItemView` has none of these fields. All are simply omitted, never invented.
  - **a11y (WCAG 2.1 AA floor):** labeled search input, `role="tablist"` category tabs,
    `aria-live` on the item list and the cart pill, unavailable items carry an explicit
    "Unavailable today" text label (never color/opacity alone as the sole signal),
    visible focus rings throughout, disabled-not-hidden confirm buttons.
- **Test coverage:** 46 new tests across `menu-state.test.ts` (24, pure logic - price
  resolution, filtering, min/max gating), `menu-view.test.tsx` (6 - category tabs skip
  empty categories, unavailable items block the tap, search crosses categories,
  410/network error states), `item-detail-view.test.tsx` (7 - confirm gated on
  variant+modifier selection, posts the exact real cart-line body, inline error on
  `item_unavailable`, 410 handling), `cart-summary.test.ts` (4), `cart-pill.test.tsx`
  (2), plus `decideGuestRoute` coverage for flat menu/item routes and the anchored table
  entry regex. 738/738 passing repo-wide at the time of the original CAP-2 branch;
  rebase verification is tracked in the PR/build summary.
