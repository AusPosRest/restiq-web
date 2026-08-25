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

## Integration points for later stories

- **Story 4 (CAP-3, order taking, P3/P4) should build directly into
  `/pos/orders/[orderId]`** (`src/app/pos/orders/[orderId]/order-stub.tsx` is exactly
  the placeholder to replace/extend) rather than creating a second order route - the
  table-map -> order navigation already lands there with a real order id.
- **Story 6 (CAP-5, open/held orders)** should call this story's `transferOrder` action
  (`src/app/pos/api.ts`) directly for take-over, per stories.yaml: "reused, not
  reimplemented."
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
- **Once restiq-backend#46 lands**, reconcile this story's self-authored table-map/order
  contract in `table-map-state.ts`/`api.ts` against the real DTOs, same as CAP-1's contract
  was reconciled against `feature/44-pos-auth-clock` above.
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
