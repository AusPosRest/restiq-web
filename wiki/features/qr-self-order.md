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
  `t/[outletId]/[tableId]` (entry), `auth/{start,join}` (route handlers), and
  `api/[...path]` (backend pass-through). Later screens (menu, cart, checkout, status)
  should live as sibling folders under the same `t/[outletId]/[tableId]/` segment (e.g.
  `t/[outletId]/[tableId]/menu`) so outlet/table context stays in the URL throughout the
  session, matching EXPERIENCE.md's linear IA.
- **Cookie:** `guest_session` (httpOnly JWT, `aud: guest`) + `guest_display` (small
  non-sensitive JSON: outletId/tableId/guestName/pin) - both set by
  `src/app/qr/auth/session-cookies.ts`'s `guestSessionResponse`, parsed via
  `parseGuestSessionDisplay` in `src/lib/guest-session.ts`.
- **Entry URL pattern:** `/qr/t/[outletId]/[tableId]` - the table-QR target; bare `/qr`
  is only ever reached via an expired-session redirect or a mistyped link, never a real
  guest's first hit.
- **Proxy/session gate:** `decideGuestRoute` in `src/lib/guest-session.ts` already allows
  every path under `/qr/t/*` and `/qr/auth/*` unconditionally (the entry point must
  always be reachable, even with an expired token, so a guest can rejoin); any other
  `/qr/*` path requires a live (non-expired) `guest_session` token or redirects to bare
  `/qr` - later screens fall straight into this existing gate with no proxy changes
  needed.
