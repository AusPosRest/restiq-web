# POS Cashier & Waiter (Web Prototype) - web

Frontend for the `/pos` realm (SPEC's AD-13): a deliberate online-only web-prototype
stand-in for the native Android POS Core Loop target (see
`restiq-design/docs/specs/spec-pos-cashier-waiter/SPEC.md`'s "Why"). See that SPEC for
the full capability set (CAP-1..11), `restiq-design/docs/specs/spec-pos-cashier-waiter/
stories.yaml` for the 11-story build order, and `restiq-design/docs/ux/
ux-pos-cashier-waiter-2026-08-25/` (DESIGN.md, EXPERIENCE.md) for the design system and
behavioral spine; this doc tracks what's actually built here, story by story. Backend
counterpart: `restiq-backend/wiki/features/pos-cashier-waiter.md` (if present).

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
- **CAP-1 (story 1, PIN login, issue #38) also not available at build time.** Its branch
  (`feature/38-pos-pin-login`) existed but had zero POS-specific commits, so there is no
  real `/pos/login` screen yet to issue a `pos_session` cookie through. `pos-session.ts`/
  `proxy.ts` still gate every `/pos` route behind a real session check rather than skipping
  it for convenience - until story 1 lands, an unauthenticated visit to any `/pos` route
  redirects to a `/pos/login` that doesn't exist yet (404), the same kind of documented,
  expected gap as the CAP-8 dashboard shipping against a backend that 502'd.
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
  all added by this story since nothing under `/pos` existed yet. If another in-flight POS
  story (e.g. a shared `ManagerPinDialog` under `src/app/pos/components/`, CAP-8) also adds
  any of these independently before merging, dedupe rather than keeping two copies - check
  `git log`/`git branch -a` for what actually landed first.
- **Once restiq-backend#46 and restiq-web's own CAP-1 (issue #38) land**, reconcile this
  story's self-authored contract in `table-map-state.ts`/`api.ts` against the real DTOs and
  confirm `pos-session.ts`'s assumption (a `sub` claim identifying the `StaffUser`) matches
  what story 1 actually issues.

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
