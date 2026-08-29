# QR Self-Order (Guest Mobile Web) - web

Frontend for the `/qr` realm: the fifth disjoint auth realm (spec-qr-self-order
SPEC.md Constraints, `aud: guest`) and the first RESTIQ realm whose principals aren't
staff - guests with no account, no app, no login, ever. See
`restiq-design/docs/specs/spec-qr-self-order/SPEC.md` for the full capability set
(CAP-1..6), `screens.md` for the seven designed screens (Q1-Q7), and
`restiq-design/docs/ux/ux-qr-self-order-2026-08-27/` (DESIGN.md, EXPERIENCE.md) for the
design system and behavioral spine; this doc tracks what's actually built here, story by
story. Backend counterpart: `restiq-backend/wiki/features/guest-session.md` (once it
exists - issue #68/`feature/68-guest-session` was building in parallel and hadn't
pushed a reachable branch at the time story 1 shipped).

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
    is a server component: it resolves the capability gate and session-open status
    *before* any guest-facing UI renders (`table-status.ts`'s `fetchTableStatus`), so the
    menu is never reachable when ordering is off, and a not-found/unreachable table fails
    the same warm way (`unavailable-view.tsx`) rather than a raw error.
  - **Q1 Welcome + Q2 Session PIN** (`welcome-flow.tsx`, `welcome-flow-state.ts`): one
    client component covering both designed screens as view states, not separate routes
    - EXPERIENCE.md's IA treats them as one linear step and nothing yet needs to
      deep-link into the middle of starting/joining. A session binds to exactly one
      table (SPEC CAP-1 success signal), so the table's live `sessionOpen` status picks
      a single mode up front - "Start ordering" (name+phone form) when no session is
      open, "Join your table" (name field + 4-digit keypad, auto-submitting at 4 digits
      like the POS PIN pad) when one is - never both, and never a mode switch, since
      starting a second session on an already-open table isn't valid.
    - **Starting** proceeds straight to the PIN screen with no extra ceremony
      (EXPERIENCE.md "The solo lunch") - the PIN is shown large with a "share this PIN"
      caption and a copy-to-clipboard action.
    - **Joining** shows a plain inline error on a wrong PIN ("That PIN didn't match -
      ask your table for the 4-digit code" - the backend's own message, passed through
      untouched) and clears the PIN dots for another attempt; no lockout drama, since
      this PIN gates a cart, not money (SPEC Constraints).
    - **a11y (WCAG 2.1 AA floor):** labeled inputs, visible focus rings on every
      interactive control, inline errors via `role="alert"`, and an `aria-live="polite"`
      region wrapping the whole state area so a screen-reader guest hears the
      start→PIN or join→joined convergence.
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

### Backend contract - NOT YET RECONCILED

Issue #68 (`feature/68-guest-session`) was building in parallel and hadn't pushed a
reachable branch when this story shipped, and this worktree has no access to the
`restiq-backend` checkout to verify directly (worktree isolation blocks cross-repo git
commands). Everything here is built against `spec-qr-self-order/SPEC.md`'s stated
contract, not a verified backend response shape - flagged the same way
`pos-cashier-waiter.md` flags its own pre-merge contract reads, except here the source
branch was simply unreachable rather than read-and-verified. Assumed endpoints (see
`src/app/qr/auth/types.ts` and `src/app/qr/t/[outletId]/[tableId]/table-status.ts` for
the full assumed shapes):

- `GET /guest/v1/tables/{outletId}/{tableId}` -> `{ outlet, table, qrOrderingEnabled, sessionOpen }`
  (used by the server-rendered entry page to decide start-vs-join and the capability
  gate; **not** explicitly named in the SPEC/issue text, invented to make the "single
  CTA based on live state" behavior possible - highest-risk assumption to reconcile).
- `POST /guest/v1/sessions` `{ outletId, tableId, name, phone }` -> `{ token, pin, session }`
- `POST /guest/v1/sessions/join` `{ outletId, tableId, pin, name }` -> `{ token, session }`
  (401/404 invalid PIN or no active session, 429 rate-limited, 403 `capability_disabled`)

**Action for whoever picks up the next Q-screen story:** re-fetch `feature/68-guest-session`
once it's pushed, diff its real DTOs against `src/app/qr/auth/types.ts` and
`table-status.ts`, and update both files' contract comments plus this section.

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
