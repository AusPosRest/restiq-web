# Completed

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
