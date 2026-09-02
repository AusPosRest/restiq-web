# Tenant Admin (Owner Web Console) - web

Frontend for the `/admin` realm (AD-10): the owner-facing console that
follows Platform Console. See `restiq-design/docs/specs/spec-tenant-admin/SPEC.md`
for the full capability set (CAP-1..10) and `restiq-design/docs/ux/ux-tenant-admin-2026-08-24/`
for the design system; this doc tracks what's actually built here, story by
story. Backend counterpart: `restiq-backend/wiki/features/tenant-admin.md`.

## CAP-1 - Owner invite & account setup

- **Intent:** an invited owner opens their invite link, sets a password, and
  lands in the go-live checklist with no extra login step; an expired or
  already-used invite is rejected with a clear message and no dead end.
- **Built:** `/admin/invite/[token]` (`src/app/admin/invite/[token]/page.tsx`,
  `accept-invite-form.tsx`) - password + confirm password, client-side
  validated (10+ characters, must match) before ever calling the API. Submits
  to `src/app/admin/auth/accept-invite/route.ts`, which forwards
  `{ token, password }` to the backend, and on success stores the returned
  JWT in an httpOnly `admin_session` cookie and the browser is redirected to
  `/admin/onboarding`. An `invite_invalid` / `invite_expired` /
  `invite_already_used` error (matched by the `invite` substring in the error
  code, not by status code, since the backend uses 400 and 409 for different
  cases) replaces the form with a "no dead end" message and a contact-support
  link, never a bare error.
- There is no invite-lookup endpoint in the API contract, so this screen
  doesn't try to greet the owner by name or business - it stays generic
  until CAP-1 grows one.

## CAP-2 - Go-Live Checklist

- **Intent:** a new tenant sees per-step completion for outlet details, floor
  plan, menu import, devices and staff, with a progress ring, and can go live
  once every step is done; state survives a reload mid-flow.
- **Built:** `/admin/onboarding` (`src/app/admin/onboarding/page.tsx` wraps
  `src/app/admin/go-live-checklist.tsx`) - fetches `GET /admin/api/checklist`
  fresh on every mount (nothing is cached client-side, so a reload always
  shows the backend's current state), renders a progress ring (`N/5`) and one
  row per step. `outlet_details` has no dedicated screen yet, so its row gets
  a "Mark as complete" button that calls `PATCH /admin/api/checklist/outlet_details`
  directly; the other four steps link to their future routes
  (`/admin/menu/import`, `/admin/floor-plan`, `/admin/devices`, `/admin/staff`)
  - all 404 today, which is expected until stories 2, 5, 6 and 7 land. The Go
  Live button is disabled with a reason naming the first incomplete step
  (`checklist-state.ts#goLiveMessage`, both as a persistently visible line and
  a native `title` tooltip - a hover-only tooltip would be invisible to
  keyboard users) and calls `POST /admin/api/checklist/go-live` once enabled;
  success replaces the card with a celebratory "You're live!" state, a 409
  shows which steps still block it.
- **Realm:** `src/proxy.ts` now branches on `/admin` alongside the existing
  `/ops` branch (unchanged) - `src/lib/admin-session.ts` decides routing the
  same way `src/lib/ops-session.ts` does for `/ops`, sharing the JWT-expiry
  check via `src/lib/session-token.ts`. Public without a session:
  `/admin/invite/:token`, `/admin/login` (placeholder - no sign-in flow
  exists yet, see Key decisions) and the `/admin/auth/accept-invite` route
  handler. `src/app/admin/api/[...path]/route.ts` mirrors the `/ops/api`
  pass-through (attaches the `admin_session` cookie's JWT as a bearer token)
  and additionally forwards `PATCH`, which `/ops/api` doesn't need.
- No sidebar shell yet - `/admin/onboarding` renders standalone, matching the
  design's T2 note that the shell arrives with a later story.

## CAP-3 - AI-assisted menu import

- **Intent:** an owner uploads a menu (spreadsheet, photo or PDF), reviews the
  drafted items with a confidence signal on anything the extraction wasn't
  sure about, edits inline, and nothing reaches the live menu until a single
  "Commit menu" action.
- **Built:** `/admin/menu/import` (`src/app/admin/menu/import/page.tsx` wraps
  `src/app/admin/menu-import.tsx`). A dropzone (click-to-browse and
  drag-and-drop, both keyboard-operable) validates the file extension
  client-side (`menu-import-state.ts#isAcceptedMenuFile`) against exactly the
  set the backend's `resolveSourceType` recognises - `.csv`, `.xlsx`, `.jpg`,
  `.jpeg`, `.png`, `.pdf` - before ever uploading, then POSTs multipart form
  data to `/admin/api/menu-import/upload`. The response is a draft (nothing
  live yet) rendered as a table: every field (item name, kitchen name,
  category, price) is inline-editable, and a confidence chip renders per
  field when its score is medium/low (a high-confidence field stays
  uncluttered) plus one always-visible overall chip per row - chips carry
  text, never color alone. Each row has a "reviewed" checkbox; "Commit menu"
  stays disabled until every row is checked. An edit applies to local state
  immediately (optimistic), fires `PATCH /admin/api/menu-import/:importId`,
  and reconciles with the backend's returned draft on success or rolls back
  with a toast on failure - the same optimistic-edit pattern EXPERIENCE.md
  specifies for routine content edits. "Commit menu" calls
  `POST /admin/api/menu-import/:importId/commit`; success replaces the screen
  with a celebratory state and a link back to `/admin/onboarding` (the
  backend marks the checklist's `menu_import` step complete as part of the
  same call, so the checklist reflects it on return - no separate write from
  here). A draft with zero extracted items shows an empty state with a
  restart action rather than a bare table.
- **Multipart uploads through the proxy:** `src/app/admin/api/[...path]/route.ts`
  previously forced every non-GET request to `application/json` and read the
  body as text, which would have silently corrupted a binary file upload. It
  now detects a `multipart/form-data` content-type and forwards the original
  content-type (boundary included) with the raw `arrayBuffer()` body instead;
  JSON requests are unaffected. Covered by
  `src/app/admin/api/[...path]/route.test.ts`.

## CAP-4 - Menu management

- **Intent:** an owner manages categories, items, variants, modifier groups
  (min/max rules), combos, allergen/dietary tags, per-outlet availability and
  per-channel/scheduled prices, and item availability (86), from one screen
  that keeps list context (item editor as a drawer, not a page nav); a price
  edit creates a new version rather than rewriting the old one.
- **Built:** `/admin/menu` (`src/app/admin/(shell)/menu/`) - the first screen
  to use the post-go-live app shell (`src/app/admin/(shell)/layout.tsx`:
  sidebar with Dashboard/Menu/Floor Plan/Devices/Staff/Reports/Settings,
  mirroring `/ops`'s `(shell)` route group; every destination but Menu is a
  `ComingSoon` placeholder for now). `menu-management.tsx` fetches items,
  categories, and the tenant-wide modifier-group/allergen/combo catalogs in
  parallel, renders a category sidebar (`category-sidebar.tsx`, T4a's
  "Tandoor" filter is this same list with a category selected, one route) and
  a `MenuTable` (`menu-table.tsx`) with a search box, both filtering
  client-side (`menu-state.ts#visibleItems`). Each row has an `EightySixToggle`
  (`eighty-six-toggle.tsx`) - optimistic, rollback-on-failure toast, no reason
  prompt (routine per SPEC). Clicking a row or "Add Item" opens `ItemDrawer`
  (`item-drawer.tsx`, Radix `Dialog` styled as a right-side panel): name,
  kitchen-ticket short name, category; a Variants section that adds/removes
  variants immediately (their own endpoints, not batched); Modifier Groups and
  Allergen tags as checkbox pickers against the tenant-wide catalogs (with an
  inline "create and attach" form for a new one) rather than per-item free
  text; Combos as a read-only list of combos containing this item plus a
  create form; a per-outlet availability override section. Modifier-group
  min/max validation (`menu-state.ts#validateModifierGroup`) surfaces a
  specific message per failure (missing name, no options yet, negative
  minimum, maximum below 1, maximum below minimum, maximum above the option
  count) both while creating a group and blocking its save. Price editing
  (`price-change-dialog.tsx` + `price-schedule-state.ts`) always shows the
  current price and a "Change price" action that opens a dialog offering
  "Effective today" or "Schedule for a date"; every price change requires a
  reason (price changes are one of the SPEC's named security-relevant
  actions) and is a separate, pessimistic call from the drawer's routine
  Save - it never overwrites the price fields in place.
- **No sidebar shell existed before this story** (`src/app/admin/layout.tsx`
  previously said so explicitly) - CAP-4 is where the design's IA first needs
  one (Menu is a real nav item), so this story adds
  `src/app/admin/(shell)/` rather than building a one-off header just for
  Menu. `/admin/menu/import` (CAP-3, prior story) is untouched and still
  lives outside the shell at its original route.

## CAP-10 - Branding & capabilities

- **Intent:** an owner sets receipt/UI branding tokens (colors, font, corner
  radius, logo, receipt header/footer) with a live receipt preview that
  updates before saving, and toggles per-outlet capabilities (QR ordering,
  kiosk, token queue) that take effect without a redeploy; the shell's
  outlet switcher (built hidden in story 3, since no outlets endpoint
  existed) now shows real outlets.
- **Built:**
  - `/admin/settings` redirects to `/admin/settings/branding`
    (`src/app/admin/(shell)/settings/page.tsx`); a shared tab-strip layout
    (`settings-tabs.tsx`, mirroring the shell's own `SidebarNav` active-link
    idiom) switches between `/admin/settings/branding` and
    `/admin/settings/capabilities`.
  - **Branding** (`branding-editor.tsx`): a `BrandingForm` seeded once from
    the landed `GET /admin/v1/branding` response (no effect needed to mirror
    it into state - the loading/failed states gate the mount, so by the time
    the form exists the data is already there) with four color-token
    swatches (native `<input type="color">`, always emits a valid hex, plus
    a read-only hex label under each), a font `<select>`, a corner-radius
    `<input type="range">`, receipt header/footer `<textarea>`s, and a
    `ReceiptPreview` (`receipt-preview.tsx`) that re-renders from the same
    draft state on every keystroke - live, before Save. Save is a plain
    pessimistic button (disabled until the draft actually differs from the
    last-saved value) - branding isn't in the SPEC's named security-relevant
    list, so no reason prompt.
  - **Capabilities** (`capabilities-editor.tsx`): scoped by the same
    `useOutlets()` selection the rest of the shell's per-outlet screens use.
    A `key={selectedOutletId}` remount (not an effect) resets the toggle
    list's local optimistic-overlay state when the outlet changes. Each row
    is a `CapabilityToggle` (`capability-toggle.tsx`) - optimistic,
    rollback-on-failure toast, same shape as Menu's `EightySixToggle`, since
    capability toggles aren't security-relevant either. A tenant with zero
    outlets gets an informational empty state (no outlet-management screen
    exists anywhere in this build to link to, matching CAP-4's precedent for
    the same gap).
  - **Outlet switcher wiring**: `outlet-context.tsx` and `outlet-switcher.tsx`
    already called `fetchOutlets()` from story 3 (built ahead of the
    endpoint, hidden with zero outlets) - this story only needed to correct
    `OutletView`'s shape (see Key decisions) once the real endpoint's
    response was readable; the switcher itself required no logic changes.
- **data-testid** on every interactive element (`branding-color-*`,
  `branding-font`, `branding-corner-radius`, `branding-logo-input`,
  `branding-logo-url`, `branding-receipt-header/footer`, `branding-save`,
  `settings-tab-branding/capabilities`, `capability-toggle-*`); keyboard
  operable throughout (native form controls plus visible focus rings on
  every custom control); receipt preview carries `role="img"` with a
  descriptive `aria-label` since it's a live visual summary, not
  interactive content.
- **Platform Console counterpart (issue #108):** the ops console's Tenant
  Detail → Branding tab (`src/app/ops/(shell)/tenants/[id]/branding-tab.tsx`,
  state split into `branding-tab-state.ts`, AD-4 - it can't import this
  console's own `branding-editor.tsx`) used to be a raw JSON `{}` textarea;
  it now gets the same structured color/font/corner-radius/logo/receipt
  fields and a small live-preview tile. It is **not** wired to
  `/admin/v1/branding` like this console is - `PUT /ops/v1/tenants/:id/
  branding` (`directory.dtos.ts`'s `UpdateBrandingDto`, read directly) is a
  free-form `Record<string, string>` that the backend **replaces wholesale**
  rather than merging, accepts arbitrary extra keys beyond the 9 this form
  knows about, and requires every value - including `cornerRadiusPx` - to be
  a string. `buildBrandingPayload` starts from the tenant's current full
  token map and only overwrites the fields the operator actually changed, so
  an unrelated custom key set earlier is never silently dropped by the
  full-replace semantics; `cornerRadiusPx` is written back as a numeric
  string for the same reason. The save still goes through the ops realm's
  usual `ConfirmReasonDialog` (branding edits are audited there, unlike this
  console's routine-edit branding).

## CAP-5 - Floor plan & stations

- **Intent:** an owner lays out floors and tables, defines kitchen Stations
  with ageing thresholds, and maps printers to stations with a fallback
  printer; an overlapping table position is never silently saved, and every
  station carries a printer or an explicit "no printer" acknowledgement.
- **Built:** `/admin/floor-plan` (`src/app/admin/(shell)/floor-plan/`),
  per-outlet like Capabilities (`key={selectedOutletId}` remount). One
  `GET /admin/v1/outlets/:outletId/floor-plan` call loads everything -
  floors, stations, and printers together (see Data model) - into a single
  `floor-plan.tsx` orchestrator that owns two views:
  - **Canvas** (`floor-plan-canvas.tsx`): absolutely-positioned divs, not
    SVG (rects/circles with a text label needed no path drawing). A floor
    tab strip switches which floor's tables render. Each table shape is
    draggable (pointer events) and keyboard-operable (arrow keys nudge by
    `GRID_SNAP_PX`, both funnel through the same
    `floor-plan-state.ts#computeDragPosition` so mouse and keyboard users get
    identical snap/clamp behaviour). Dragging shows a live client-side
    overlap tint (`findOverlap`, bounding-box intersection) purely as visual
    feedback - the backend remains the actual source of truth on save.
  - **List** (`floor-plan-list-view.tsx`): the EXPERIENCE.md-required
    non-pointer fallback - a plain table, one row per table grouped by
    floor, with editable X/Y/capacity number fields (commit on blur/Enter,
    revert silently on an invalid value). Toggled via
    `floor-plan-view-canvas`/`floor-plan-view-list`.
  - Both views funnel every edit through one `commitTable` in
    `floor-plan.tsx`: optimistic update, `PATCH .../tables/:tableId`, and on
    failure a snap-back to the pre-edit value plus an error toast naming the
    table (see Key decisions for the overlap policy this reflects). There is
    no "adjusted position" reconciliation branch, since the backend never
    returns a different position than requested on success.
  - **Stations** (`stations-panel.tsx`), alongside the canvas/list: one row
    per station with an ageing-threshold number input (validated ≥1 whole
    minute, `floor-plan-state.ts#validateAgeingThresholdMinutes`, blocked
    client-side before saving) and a printer `<select>` plus an explicit
    "This station has no printer, on purpose." checkbox
    (`validateStationPrinter` - a printer chosen or the checkbox checked,
    never neither; the checkbox is disabled while a printer is selected,
    since it's meaningless then). Picking a printer auto-saves
    `{ primaryPrinterId, noPrinterAcknowledged: false }`; checking the box
    auto-saves `{ primaryPrinterId: null, noPrinterAcknowledged: true }` -
    same auto-save-per-field pattern as `CapabilityToggle`, gated on
    validation rather than a separate Save button. A station already
    persisted with no printer starts with the checkbox pre-checked (the
    backend can't have saved that state without the acknowledgement having
    already fired once, so re-demanding it on every load would be a false
    error, not real friction).
- **data-testid** on every interactive element (`table-shape-*`,
  `floor-tab-*`, `floor-plan-view-canvas/list`, `floor-plan-list-x/y/
  capacity-*`, `station-ageing-input-*`, `station-printer-select-*`,
  `station-no-printer-ack-*`); keyboard-operable throughout with visible
  focus rings; every table shape carries an `aria-label` stating its name,
  capacity, and that arrow keys move it.
- **Gap closed - create affordances:** the above shipped layout editing only
  - dragging existing tables, tuning existing stations - with no way to
    create a floor plan's first floor, table, station, or printer, so a
    brand-new outlet could never actually satisfy the Go-Live Checklist's
    `floor_plan` step through the console. Added on top, reusing every
    existing pattern rather than inventing new ones:
  - **Empty state:** zero floors renders an icon + "No floor plan yet" + one
    "Add your first floor" action (`floor-plan-no-floors`) in place of the
    canvas/list/view-toggle, matching EXPERIENCE.md's empty-state formula
    exactly (icon, one sentence, one primary action) and the same shape as
    the pre-existing "No outlets yet" state above it in this file.
  - **Add floor / Add table:** a toolbar (`floor-plan-toolbar`) sits above
    the canvas-or-list split, not inside either view, so both the pointer
    canvas and the accessibility list fallback get identical add affordances
    for free - no separate list-view implementation to keep in sync. "Add
    table" is a compact form (label, shape, seat count), not click-to-place:
    a brand-new floor has nothing to align a placed table against anyway, so
    typing three fields costs the owner nothing extra. Its X/Y default to
    `computeNextTablePosition` (`floor-plan-state.ts`) - the first grid cell
    clear of every existing table on the selected floor, reusing the same
    `rectsOverlap` the canvas's drag-overlap tint already uses - and stay
    editable inline with a live overlap warning before submit. The actual
    save still goes through `POST .../floor-plan/tables` and inherits the
    backend's real `table_overlap` 409 (optimistic add, rollback-and-toast on
    rejection, same shape as `commitTable`'s existing move-rollback).
  - **Add station / Add printer:** two more forms inside `stations-panel.tsx`
    below the station list. Add-station reuses `validateStationPrinter`
    verbatim - the same printer-required-or-acknowledge gate `StationRow`
    already enforces, so there's no separate rule to keep consistent with the
    update path. Add-printer is name + render mode only, matching
    `CreatePrinterDto`.
  - **Wiring:** `floor-plan.tsx` now holds `floors`/`printers` as state
    (previously only `tables`/`stations` were - `floors` and `printers` came
    straight from the initial load since nothing could mutate them yet); an
    added floor auto-selects itself so the owner lands somewhere useful
    immediately.
- **Gap closed - edit/delete affordances (issue #109):** the above covered
  add + drag only, with no way to fix a typo'd floor/table name, reshape or
  re-seat an existing table, or remove a floor/table created by mistake.
  Added on top, against `restiq-backend#92`'s `DELETE floors/:floorId` (landed
  in parallel) and the existing `PATCH floors/:floorId` / `PATCH
  tables/:tableId` / `DELETE tables/:tableId`:
  - **Floor tabs moved up:** the floor tab strip used to live inside
    `floor-plan-canvas.tsx` (hidden entirely below 2 floors), which had no
    home for a single-floor outlet's rename/delete controls and disappeared
    in list view. It now lives in `floor-plan.tsx`'s `FloorTabsBar`, always
    visible above both views regardless of floor count - the canvas itself
    lost its `floors`/`onSelectFloor` props and now only ever renders the
    already-selected floor's tables, drag/keyboard math untouched.
  - **Rename a floor:** a pencil button (`floor-plan-rename-floor-button`)
    next to the selected tab swaps it for an inline name field
    (`floor-plan-rename-floor-form`, same open/submit/cancel shape as
    `AddFloorControl`) that `PATCH`es `.../floors/:floorId` with `{ name }`.
  - **Delete a floor:** a trash button (`floor-plan-delete-floor-button`)
    next to rename, disabled with a `title` hint ("Move or remove its tables
    first") whenever the selected floor still has tables - the same rule
    `restiq-backend#92`'s `DELETE` enforces server-side with a 409, so the
    client-side gate matches what the backend would reject anyway. Confirmed
    via the shared `ConfirmReasonDialog` (the reason is UI-only ceremony
    matching the admin realm's existing destructive-action pattern - the
    delete endpoint takes no reason). On success the deleted floor drops from
    state and selection falls to another remaining floor; a race-condition
    409 (a table added between the button rendering and the confirm) toasts
    instead of silently failing.
  - **Rename/reshape/re-seat a table:** `floor-plan-list-view.tsx` gained a
    Label text field and a Shape `<select>` per row (`floor-plan-list-label-*`
    / `floor-plan-list-shape-*`), alongside the existing X/Y/capacity number
    fields - all six funnel through the same `commitTable` optimistic-write/
    rollback path already built for position edits, just widened to accept
    `label`/`shape` too. `TABLE_SHAPES` moved from a local const in
    `floor-plan.tsx` to `floor-plan-state.ts` so the add-table form and this
    new shape `<select>` share one array instead of two hand-kept copies.
  - **Delete a table:** a trash button per list row
    (`floor-plan-list-delete-*`), confirmed via the same `ConfirmReasonDialog`
    pattern as floor delete, `DELETE`s `.../tables/:tableId`.
  - **api.ts:** added `updateFloor`, `deleteFloor`, `deleteTable`; widened
    `UpdateTableInput` with `label`/`shape` - all additive, next to the
    existing floor-plan helpers.

## CAP-6 - Devices & printers

- **Intent:** an owner views enrolled POS/KDS devices for the current outlet,
  generates a one-time enrolment code with a live countdown, and configures
  printer render-mode and fallback - reusing Platform Console's device/
  enrolment-code backend (AD-12), scoped to their own tenant.
- **Built:** `/admin/devices` (`src/app/admin/(shell)/devices/`), per-outlet
  like Floor Plan/Capabilities (`key={selectedOutletId}` remount). `devices.tsx`
  loads devices and the floor plan's printers/stations in parallel
  (`fetchDevices` + `fetchFloorPlan`) into one shell:
  - **Device table** (`devices-table.tsx`): name/type/role (Hub badge or
    "Terminal")/app version/last seen/status ("Enrolled"/"Revoked" - warmer
    owner-facing copy over the backend's raw `active`/`revoked`). Read-only -
    enrolment and revocation stay Platform Console's job.
  - **Enrolment code** (`code-chip.tsx`, `generate-code-dialog.tsx`): mirrors
    Platform Console's Code Chip (`src/app/ops/(shell)/devices/code-chip.tsx`)
    - same live `m:ss` countdown (`secondsRemaining`/`formatCountdown`,
    pure and unit-tested, ticking via `setInterval` against real time, not
    imported since ops/admin route trees never import from each other,
    AD-4) - reimplemented here, admin-themed, under a `device-code-chip*`
    testid prefix. "Enrol device" opens a dialog with only a device-type
    picker (the outlet is already fixed by the shell, unlike the fleet-wide
    ops version's tenant/outlet pickers); the generated code also populates
    a persistent "Active enrolment code" card on the page itself, not just
    inside the dialog.
  - **Printer config** (`printer-config-panel.tsx`): one row per printer with
    a render-mode `<select>` (auto-saves via `PATCH .../floor-plan/printers/
    :printerId`) and a fallback-printer `<select>`. Fallback is a per-
    *station* field (`Station.fallbackPrinterId`), not a Printer field, so
    it's only editable when a printer is unambiguously the primary for
    exactly one station (`devices-state.ts#stationForPrinter`); zero or
    multiple such stations disables the selector with an inline note
    pointing to Floor Plan instead of silently no-oping.
- **data-testid** on every interactive element (`devices-generate-code`,
  `generate-code-type/submit/done/close`, `device-code-chip-*`,
  `devices-row-*`, `printer-row-*`, `printer-render-mode-*`,
  `printer-fallback-select-*`); keyboard-operable throughout with visible
  focus rings.
- **`/device` - the device-side half of enrolment (issue #99):** a browser
  tab redeems the code this section generates, turning itself into the
  terminal. Its own minimal, unauthenticated realm (`src/app/device/`, a
  sixth theme surface reusing `pos-theme`) against the real, public
  `POST /device/v1/enroll` (restiq-backend PR #91,
  `src/device/enroll/*`) through a same-origin pass-through
  (`src/app/device/api/[...path]/route.ts`) that - unlike every other
  realm's proxy - attaches no session cookie, since the code is the only
  credential. No stored identity: a code input (auto-uppercased, formatted
  XXX-XXX, filtering the alphabet's excluded I/O/0/1 as you type) plus an
  optional label; `hardwareKeyFingerprint` is a `web-<uuid>` generated once
  with `crypto.randomUUID()` and persisted in `localStorage`, reused on
  every re-enrol - this browser's "hardware" identity in the prototype,
  honestly named as such. A stored device renders as a card (label, type,
  outlet, enrolled time, status) with a "Continue" CTA that routes by type
  (`pos` → `/pos/login`, `kds` → `/kds`, `kiosk`/`cds` → a plain "this
  device type has no web surface yet" line) and a secondary "Un-enrol this
  browser" that clears only the local identity - server-side revocation
  stays this section's `devices-row-*` job, and the microcopy says so.
  Errors are the real backend codes with honest per-code copy
  (`code_invalid`/`code_expired`/`code_already_used`).

## CAP-7 - Staff & roles

- **Intent:** an owner manages users, assigns outlet-scoped roles from the
  six seeded system roles (Owner, Manager, Cashier, Waiter, Kitchen,
  Accountant), and issues or revokes POS PINs; role change and PIN revoke
  are both security-relevant and audited with a reason.
- **Built:** `/admin/staff` (`src/app/admin/(shell)/staff/`), tenant-wide
  (not per-outlet - `Role` carries no outlet scoping in the backend's Prisma
  schema, see Key decisions). `staff.tsx` loads roles and staff in parallel
  (`fetchRoles` + `fetchStaff`) into one editor:
  - **Staff table** (`staff-table.tsx`): name/email, a per-row role
    `<select>` populated only from the tenant's actual fetched roles (a
    closed set by construction - no free-text option can ever exist), and a
    POS PIN status badge with an "Issue PIN"/"Revoke access" action.
    Selecting a new role doesn't apply it directly - it requests a
    confirmation from `staff.tsx` (role change is one of SPEC's named
    security-relevant, audit-reason actions; EXPERIENCE.md lists it
    alongside PIN revoke as pessimistic-with-confirm), so the dropdown
    reverts on cancel since the row's own state hasn't changed yet.
  - **Add staff** (`add-staff-dialog.tsx`): first/last name, email, and the
    same closed-set role `<select>`. Routine (not in SPEC's audited list) -
    single submit, no reason prompt.
  - **Confirm dialogs**: both role change and PIN revoke reuse the existing
    `ConfirmReasonDialog` (built for CAP-4's price-change reason prompt,
    unused elsewhere until this story) rather than a new component - it
    already covers "pessimistic action + required audit reason". PIN
    revoke's description is composed to match EXPERIENCE.md's exact voice
    requirement: `"This removes {name}'s access to the till. They won't be
    able to sign in with their PIN."`, naming the actual person, not
    internal jargon.
  - **PIN issue**: no confirm step (only revoke is named as security-
    relevant) - a plaintext PIN is returned once. Issue #114: a toast alone
    auto-dismissed in ~1s before owners could read it, and the backend has no
    PIN recovery (revoke + re-issue is the only way to see it again), so the
    PIN now renders in `pin-chip.tsx`'s `StaffPinChip` - an extra table row
    under the issuing staff member, large monospace PIN, name, a copy button
    (`navigator.clipboard.writeText`, 1.5s "Copied" state, wrapped in
    try/catch), and an explicit "Dismiss" - staying on screen until the owner
    dismisses it or issues for someone else (which replaces it). The
    microcopy says "Shown once - copy it before you dismiss." The toast is
    now just `"PIN issued for {name}."`; the PIN itself no longer appears in
    it. Mirrors ops's `InviteLinkChip` (`src/app/ops/(shell)/tenants/invite-link.tsx`)
    show-once pattern - reimplemented locally rather than imported, since
    admin and ops never share components across the route split (AD-4).
  - **Role permission matrix** (`permission-matrix.tsx`): read-only
    reference table, one column per seeded role, one row per permission.
    **Deviation:** `GET /admin/v1/roles` (see Key decisions) returns only
    `{ id, name, isSystem }` - no permission metadata - so this can't be
    sourced from the API the way the render's Effective POS Permissions list
    implies. It's rendered instead from a static reference
    (`staff-state.ts#SYSTEM_ROLE_PERMISSIONS`), matching the render's intent
    (a fixed, non-editable permission story per role) without inventing a
    backend field that doesn't exist.
  - **Not built** (out of this story's scope, T7 render shows them but
    issue #30's scope and the current data model don't support them): the
    render's per-user Outlet Access checkbox panel and per-user "Effective
    POS Permissions" list in a detail drawer - `Role` has no outlet
    dimension in the schema, so outlet-scoped role assignment isn't
    buildable yet; the list+dropdown+matrix shape here covers the actual
    issue scope.
- **data-testid** on every interactive element (`staff-add-open`,
  `staff-row-*`, `staff-role-select-*`, `staff-issue-pin-*`,
  `staff-revoke-pin-*`, `staff-pin-chip`, `staff-pin-chip-copy`,
  `staff-pin-chip-dismiss`, `add-staff-*`, `confirm-reason-dialog` and its
  fields, `permission-matrix`); keyboard-operable throughout with visible
  focus rings on every custom control.

## CAP-8 - Owner dashboard

- **Intent:** an owner sees live sales/margin/labour/waste per outlet with
  cross-outlet comparison; every figure carries an honest freshness
  indicator, never presented as current when it isn't.
- **Reality constraint:** RESTIQ has no Order/Bill/Payment model anywhere in
  the schema yet - POS Core Loop, the surface that would generate real
  transactional data, hasn't been built. `GET /admin/v1/dashboard`
  (`restiq-backend#41`) returns real counts (outlets, staff, menu items,
  devices) alongside sales/margin/labourCost/waste fields that are always
  present but carry `hasData: false` and an explicit message
  ("No sales data yet - connect POS to see live figures") instead of a fake
  zero. The frontend renders that distinction directly: count tiles always
  show a number, financial tiles show `NoFinancialData` until `hasData` is
  true.
- **Built:** `/admin` (dashboard home, `src/app/admin/(shell)/dashboard/`)
  replaces the placeholder. `dashboard.tsx` loads the one endpoint via
  `useAdminLoad`; `KpiStatCard`/`CountValue` render the four real-count
  tiles; `OutletKpiTiles` renders one `MetricValue` per outlet per financial
  metric (`sales`, `margin`, `labourCost`, `waste`); `OutletComparisonTable`
  renders whenever there's more than one outlet; `FreshnessBadge` shows
  "As of [time]".
- **Reconciliation pass (post-merge-check, both PRs #41/#33):** this story's
  first web pass was built before restiq-backend#41 existed and used a
  self-authored, unverified contract - a `stale` boolean on the wire, a
  `counts` object with frontend-invented field names, and a per-metric
  discriminated union (`{status:"unavailable"}|{status:"available",...}`)
  with margin expressed as a **percentage** and labour carrying a
  `percentOfSales` figure. None of that matches the real backend. Reading
  `restiq-backend#41`'s actual response directly found: the real key is
  `tenant` (not `counts`) with backend field names (`outletCount` etc.);
  there is no `stale` field at all - the backend computes `asOf` fresh on
  every request since no caching layer exists yet, so the badge is
  unconditionally non-stale client-side now; and all four financial metrics
  share one flat shape, `{ amountMinor, currency, hasData, message }` -
  margin is a real currency **amount**, not a percentage, and there is no
  `percentOfSales` anywhere. `dashboard-state.ts`, `dashboard.tsx`,
  `outlet-kpi-tiles.tsx`, and `outlet-comparison-table.tsx` were rewritten to
  match; `formatPercent` was deleted (no longer used by anything); the
  Margin tile's icon changed from a percent glyph to a trend-up glyph to
  match its new amount semantics. Tests were updated to the real shape (400
  passing after; two prior tests - a standalone `formatPercent` unit test
  and a "stale badge" scenario - were removed since the behavior they
  covered no longer exists on the wire).
- **Deviation:** the T8 render shows populated figures and several tiles
  with no backing data source anywhere in this codebase (orders, covers,
  sales-by-hour, top items, live tickets) - none reproduced; EXPERIENCE.md's
  own rule ("spines win on conflict with any mock") plus the no-POS-data
  constraint make the honest empty state the correct build, not a shortfall
  against the mock.

## CAP-9 - Reports catalogue

- **Intent:** an owner browses and exports Sales, Financial (GST/BAS-ready),
  Menu Engineering, Operations, Inventory, and Labour reports, and can send
  summarised journals to an accounting tool.
- **Reality constraint:** no Order/Bill/Payment model or Z-report/Document
  immutable model exists anywhere in the schema yet - POS Core Loop hasn't
  been built. `GET /admin/v1/reports` (`restiq-backend#42`) returns one entry
  per named report type; six of the eight are honestly `hasData: false` with
  an explanatory message (`"Available once POS Core Loop is live"`) and no
  export formats. Two are real, backed by tables that already exist: a menu
  catalogue export (CAP-4's `menu_items`/`item_prices`) and a staff roster
  export (CAP-7's `staff_users`/`roles`), both `hasData: true` with a working
  `csv` export.
- **Built:** `/admin/reports` (`src/app/admin/(shell)/reports/`) replaces the
  `ComingSoon` placeholder. `reports.tsx` loads the catalogue via
  `useAdminLoad<ReportDefinition[]>("reports")` and groups it by category
  (`reports-state.ts#groupReportsByCategory`, `sales`/`financial`/`menu`/
  `operations`/`inventory`/`labour`, in SPEC order) into a card grid
  (`report-card.tsx`) - a report's `message` doubles as its card body copy
  for both states; a real report (non-empty `exportFormats`) gets a working
  "Export {FORMAT}" button, a pending one shows a "Pending" badge instead. An
  "Accounting tools" button opens `export-destinations-dialog.tsx`, which
  fetches `GET /admin/v1/reports/export-destinations` live and lists every
  destination (Tally/Xero/MYOB/Zoho/QuickBooks) as honestly "Not connected" -
  no fake connected state, no OAuth flow, since none exists in the backend.
- **CSV export is a real file, not a JSON payload** -
  `GET /admin/v1/reports/:key/export?format=csv` returns a raw `text/csv`
  body with a `Content-Disposition` filename, which `src/app/admin/api/
  [...path]/route.ts`'s pass-through previously couldn't forward correctly
  (it always called `upstream.json()` and re-wrapped the result). The proxy
  now checks the upstream `content-type`: a non-JSON response is forwarded as
  raw bytes with its `content-type`/`content-disposition` intact instead of
  being forced into a JSON envelope. `api.ts#exportReport` fetches through
  that proxy, reads the body as a `Blob`, and pulls the filename from the
  response's own `Content-Disposition` header
  (`reports-state.ts#filenameFromContentDisposition`) rather than assuming
  one client-side; `downloadReportExport` then does the actual
  `URL.createObjectURL` + anchor-click browser save.
- **Reconciliation pass:** this story's first web pass was built before
  `restiq-backend#42` existed (checked `git branch -a` / `gh pr list` /
  `gh issue view 42` on the backend repo - open, unassigned, zero commits at
  the time) and used a self-authored contract: a `{ reports: [...] }`
  envelope, an `id`/`description` field pair, display-label category strings
  on the wire, a static client-side destinations list, and export returning
  `{ filename, contentType, content }` JSON. Partway through this story the
  backend branch (`feature/42-reports-catalogue`) appeared, uncommitted, in
  the sibling checkout - reading `src/admin/reports/reports.controller.ts` /
  `reports.dtos.ts` / `reports.service.ts` directly found the real contract
  differs on every one of those points: `GET /admin/v1/reports` returns a
  bare `ReportCatalogueEntry[]`; each entry uses `key` (not `id`) with no
  separate `description` (`message` covers it); `category` is a lowercase
  code, not a display label (`categoryLabel()` added to map it); the
  destinations list is a real `GET /admin/v1/reports/export-destinations`,
  not static; and both exports are per-report `GET .../reports/:key/export?
  format=csv` routes returning a raw CSV body (see above), not a generic
  POST returning JSON. `reports-state.ts`, `api.ts`, `report-card.tsx`,
  `reports.tsx`, `export-destinations-dialog.tsx`, the proxy route, and every
  test were rewritten to match. The backend's own e2e suite
  (`test/reports-catalogue.e2e-spec.ts`, 13 tests) was run directly against
  real Postgres to confirm the read contract, independent of this
  reconciliation.

## Data model

Owned by the backend - see `restiq-backend/wiki/features/tenant-admin.md`.
This surface talks to the API purely through the documented shapes:
`GET /admin/v1/checklist` returns `steps` as an array of
`{ step, completed, completedAt }` (snake_case step keys:
`outlet_details`, `floor_plan`, `menu_import`, `devices`, `staff`) plus
`canGoLive` and `tenantStatus` - there is no `firstIncompleteRequiredStep`
field, so `checklist-state.ts` derives it from the array's own order.

CAP-4's `ItemView` (`GET/POST/PATCH /admin/v1/menu/items`) carries only
`id, categoryId, name, shortName, available, variants, modifierGroups,
allergens` - no description, native-language name, dietary type (veg/non-veg),
or photo; none of those exist in the backend's `MenuItem` model as built, so
this UI doesn't render them (a deviation from the design renders, which show
all four - see Key decisions). A price is written with
`POST .../items/:id/prices` and read with
`GET .../items/:id/price?channel=&variantId=&outletId=` - always scoped to
exactly one `(item, variant?, channel, outlet?)` line; there is no endpoint
that returns a bulk "menu with prices" list or an item's future-scheduled
rows, which shapes several UI choices below.

CAP-5's `TableView` carries `id, floorId, label, x, y, width, height, shape,
seatCapacity` - position and size are always absolute grid-unit integers the
editor itself owns; there's no separate `rotation` or `zIndex`. `StationView`
carries `id, outletId, name, ageingThresholdMinutes, primaryPrinterId,
fallbackPrinterId` - no `noPrinterAcknowledged` (never persisted, see Key
decisions) and no printer-online/offline status (that lives with the Device
model, not `Printer`, and isn't part of this capability's read shape).

CAP-6's `GET /admin/v1/outlets/:outletId/devices` returns the same
`{ devices, nextCursor, total }` shape Platform Console's fleet view uses
(AD-12 - one `DevicesService`, two callers), scoped down by an
`AdminDevicesService` wrapper that forces `tenantId`/`outletId` from the
owner's own session rather than trusting a client-supplied value. `POST
.../devices/enrolment-codes` takes only `{ deviceType }` in the body.
`PATCH .../floor-plan/printers/:printerId` (CAP-5's own module, not a CAP-6
endpoint) takes `{ renderMode }`.

## Key decisions

- `/admin/login` exists only as a placeholder redirect target for the proxy -
  there is no sign-in flow for a returning owner in this story (CAP-1 is
  invite-only). It exists so an unauthenticated `/admin/*` request never
  dead-ends on a 404; a later story can replace its contents once a real
  login flow is built.
- The checklist's "first incomplete required step" and per-step labels/links
  are derived client-side (`checklist-state.ts`) rather than trusted from an
  API field, since the backend doesn't return one - this also means the UI
  adapts automatically if the backend ever reorders the `steps` array.
- Password minimum length (10 characters) and the field-vs-terminal error
  split for invite errors were confirmed against the backend's actual
  validation (`AcceptInviteDto`) and error codes during live verification,
  not assumed from the API contract summary alone.
- CAP-3's shapes were read directly from `restiq-backend/src/admin/menu-import/`
  (uncommitted, `feature/28-menu-import` at the time) rather than assumed -
  several things differ from the originally sketched contract: confidence is
  per-field (`{ name, shortName, category, price, overall }`), not one score
  per item; price is `priceMinor` (integer minor units) plus a `currency`
  code, not a plain number; there's a `shortName` (kitchen ticket) field with
  no equivalent in the original sketch; the PATCH body is
  `{ items: [{ id, ...partial fields }] }` and returns the full draft (same
  "no extra fetch" shape as the checklist's `PATCH .../:step`), not a single
  `{ itemId, field, value }`; and there is no `tags` field anywhere in the
  backend's draft model, so despite SPEC CAP-3 naming tags as an editable
  field, this build has no tags to edit - a real, currently-unreconciled gap
  between SPEC and the backend as actually built, not something invented
  client-side just to look complete.
- CAP-4's contract was read directly from `restiq-backend/src/admin/menu/`
  (uncommitted, `feature/30-menu-management` at the time - controllers, DTOs,
  services and the Prisma schema diff, plus its e2e spec) rather than assumed,
  and differs substantially from an initial draft built against the SPEC/
  design renders alone before that code existed:
  - Modifier groups and allergens are **tenant-wide reusable catalogs**
    (`GET/POST /admin/v1/menu/modifier-groups`, `.../allergens`) an item only
    references by id (`PUT .../items/:id/modifier-groups` /
    `.../allergens` replace the full set) - not data an item owns and edits
    inline. The drawer's pickers reflect that: checkboxes against the
    catalog, not a free-text tag editor per item.
  - There is no `description`, native-language name, dietary type (veg/
    non-veg), or photo field on `MenuItem` - the design renders show all
    four; this build only implements what the backend can actually persist
    and drops the rest rather than faking client-only fields with nowhere to
    save.
  - Combos have `GET`/`POST` only (`/admin/v1/menu/combos`) - no update or
    delete, so the drawer can list combos containing an item and create a
    new one, but can't edit or remove an existing combo from here.
  - **86 is `available: boolean`** via `PATCH .../items/:id/availability`,
    not the `is86d` + `/86` path an earlier draft of this UI guessed.
  - **Per-outlet "override" is availability, not price** -
    `PUT/DELETE .../items/:id/outlets/:outletId/availability`. Per-outlet
    *pricing* is a real, separate capability (`POST .../prices` accepts an
    optional `outletId`), but the UI here only exposes the availability
    override; per-outlet price editing is a follow-up.
  - **Price has no "list scheduled changes" endpoint** - `GET .../price`
    only ever resolves the current (non-future) row for one exact
    `(variant, channel, outlet)` combination; there is nothing that returns
    an item's future-scheduled rows. `menu-state.ts`'s `PendingPriceInfo` is
    therefore populated only from what the drawer itself just scheduled in
    that session (kept in local state), not fetched - the "current vs.
    pending" distinction the SPEC/EXPERIENCE call for holds true immediately
    after scheduling a change, but a page reload loses the pending badge
    until the backend grows a listing endpoint. Noted as a real,
    unreconciled gap, not silently dropped.
  - There was **no outlets-listing endpoint anywhere in the admin realm** as
    of this story (outlets were only ever created directly in backend test
    fixtures). `fetchOutlets()` and the sidebar outlet switcher were this
    story's own inferred guess at where that would land; with zero outlets
    returned, the switcher and every per-outlet section degrade to hidden
    rather than broken. CAP-10 (below) adds the real endpoint and confirms
    the switcher's shape guess - see that section for what changed.
  - The Menu list itself (`GET /admin/v1/menu/items`) carries no price -
    `MenuTable` fetches each row's current dine-in/delivery price
    individually after mount; a row with variants shows "Varies" rather than
    fetching every variant's price into the list view.
- **`GET /admin/v1/outlets` returns `{ id, name, address, type, timezone }`,
  not `{ id, name, area }`** - contract read directly from
  `restiq-backend/src/admin/outlets/outlets.dtos.ts`
  (`feature/32-branding-capabilities`) once it landed. An initial pass
  guessed a `city`/`area` field (matching the backend issue's loose wording)
  and added it to `OutletView`/the switcher; both were reverted once the
  real shape was readable. `OutletView` now carries the full real shape
  (`address`, `type`, `timezone`) for future stories even though the
  switcher itself only displays `name`.
- **`BrandingTokens` is flat, not nested under `colors`** -
  `{ primaryColor, secondaryColor, accentColor, surfaceColor, font,
  cornerRadiusPx, logoUrl, receiptHeader, receiptFooter }`, matching
  `branding.dtos.ts`'s `BrandingView`/`UpdateBrandingDto` exactly (read
  directly, not assumed) rather than the `{ colors: {...} }` nesting
  sketched before that code existed. `GET` returns every field `null` for a
  tenant that's never saved; `normalizeBranding` fills in this editor's
  defaults, not the backend's.
- **Corner radius clamps to 0-64, not 0-24** - the design mock's slider
  reads roughly 8-24px by eye, but the backend's actual
  `UpdateBrandingDto` validates `@Min(0) @Max(64)`; the wider, backend-
  confirmed range wins.
- **A picked logo file only ever previews locally - it is never sent to the
  backend.** `branding.dtos.ts`'s `logoUrl` is a plain string capped at
  `@MaxLength(2048)`, the same as any other token field, not an asset
  reference - there is no upload endpoint (confirmed in the backend's own
  wiki: "wiring actual file upload... is left to whichever story needs
  it"). Encoding even a small PNG as a `data:` URL runs to thousands of
  characters and the backend would reject it outright. The editor therefore
  keeps a locally-picked file's `data:` URL in ephemeral state
  (`localLogoPreview`, read via `FileReader`) that only feeds the
  `ReceiptPreview`, plus a separate "Logo URL" text field (client-validated
  against the same 2048-char cap) for pasting an already-hosted URL, which
  is the only logo value Save ever actually persists. This is a real,
  visible product gap (an owner can preview a logo but not save the file
  itself) rather than something faked to look complete - a future story
  wiring real asset storage removes it.
- **Outlet capabilities render a client-owned known-key set
  (`qr_ordering`, `kiosk`, `token_queue`), not just whatever the backend
  returns.** `outlets.service.ts`'s `listCapabilities` only returns rows
  that have been explicitly toggled at least once ("an absent key means not
  yet toggled, left for the caller to render as its platform default" - the
  service's own comment); the backend's wiki says as much too ("no
  capability-catalogue validation... a future story that needs a fixed
  catalogue... can add one without touching this write path"). Without a
  client-side known set, a fresh outlet's `[]` response would render as "no
  capabilities configured" with no way to ever turn one on.
  `capability-state.ts#mergeCapabilities` renders one row per known key
  (defaulting an absent key to disabled) plus any extra/unknown key the
  backend does return, so a future capability this build doesn't know about
  still surfaces instead of being silently dropped.
- The Settings tab strip (`settings-tabs.tsx`) reuses the exact
  `Link` + `usePathname` active-link idiom `SidebarNav` already established,
  rather than reaching for Radix's `Tabs` primitive (available via the
  `radix-ui` dependency, unused elsewhere) - two destinations sharing one
  layout didn't justify a new pattern.
- **CAP-5's overlap policy is REJECT with 409, not auto-adjust** - the
  SPEC states this was an open product question left to the builder's
  judgment, and the backend's actual `floor-plan.service.ts` (read directly,
  `feature/34-floor-plan`) settled it: `assertNoOverlap` throws a
  `ConflictException({ code: 'table_overlap' })`, with its own comment
  explaining why (a silently-relocated table is a worse surprise mid-edit
  than an immediate "that spot is taken" the UI can show right where it was
  dropped). This build's UI was written to handle *either* outcome
  generically (snap-back-and-toast on failure, reconcile-to-server-value on
  a differing success) before that code existed; once it landed, the
  "server adjusted the position" branch was removed as dead code rather than
  left in for a case that can't occur.
- **The floor-plan GET returns everything in one call, not three** -
  `admin/v1/outlets/:outletId/floor-plan` (`floor-plan.controller.ts`/
  `.dtos.ts`, read directly) returns `{ floors, stations, printers }`
  together, with each floor carrying its own `tables` nested - there are no
  separate `.../stations` or `.../printers` list endpoints. An earlier pass
  (written before that code existed, following this file's own
  outlet-nested convention) assumed three separate GETs; `api.ts#fetchFloorPlan`
  now makes one call and flattens the nested shape into the flat
  `{ floors, tables, stations, printers }` the UI components want, so a
  table update only ever needs to look up one flat array by id.
- **A station's "no printer" acknowledgement is a one-time request flag,
  never a persisted column** - `updateStation`'s `noPrinterAcknowledged` is
  read once per request and discarded; the backend's own comment: "never
  silently save an unset printer." A station's actual no-printer state is
  simply `primaryPrinterId: null`. This is why `StationsPanel` treats an
  already-null station as pre-acknowledged on load rather than demanding
  the checkbox again every time the page opens.
- POST endpoints for creating floors/tables/printers/stations exist on the
  backend but are out of this story's scope (the design's T5 screen and
  EXPERIENCE.md describe laying out an *existing* floor plan and stations,
  not authoring floors/stations from scratch) - this UI only reads and
  updates (`PATCH`) what the backend already has.
- **The device list's response omits `appVersion`/`lastContactAt` even
  though the `Device` row carries both columns** (populated by CAP-6's own
  heartbeat ingestion) - `toDeviceView` in `restiq-backend/src/ops/devices/
  devices.service.ts`, shared by both the ops fleet view and the admin
  wrapper, doesn't map them into the response. Confirmed live: seeding a
  device with both fields set directly via Prisma and loading `/admin/
  devices` still showed "-"/"Never" for that row. `AdminDeviceView` marks
  both fields optional and `devices-table.tsx`/`formatLastSeen` fall back
  gracefully rather than assuming they're present - a real, unreconciled gap
  in the shared response shape (not this story's backend module to fix),
  flagged here rather than faked.
- The design mock's Printers table also shows Connection/Paper Width/
  live Online-Offline status/"Test print" columns with no backing field or
  endpoint anywhere in the backend (`Printer` carries only `id, outletId,
  name, renderMode`). Out of scope here: "printer status" is implemented as
  *assignment* status (which station, if any, has this printer as primary),
  the only real signal the current data model supports - not a fabricated
  connectivity indicator.
- The Code Chip's countdown is mirrored, not imported, from `src/app/ops/
  (shell)/devices/code-chip.tsx` - it isn't factored into a shared location
  on the ops side (confirmed via grep: only that directory's own dialog
  imports it), and the ops/admin route trees never import from each other
  (AD-4's boundary rule) regardless. The mock's QR-code glyph next to the
  code was deliberately not built: the already-shipped ops Code Chip this
  story mirrors has no QR code either, and the repo carries no QR
  dependency - matching the real, reviewed ops behavior over the raw mock
  pixels didn't justify adding one.

- **CAP-7's API was built against a provisional contract, then reconciled.**
  restiq-backend's staff/roles work (#38) had no branch and no Prisma model
  beyond `Role` at implementation time, so this story's first pass designed
  `api.ts`'s CAP-7 section from the admin realm's REST conventions rather
  than real DTOs. Once #38/#39 landed, the actual contract was read directly
  and reconciled: `GET /admin/v1/staff` returns `{ staff: [...] }` (not a
  bare array), `CreateStaffDto`/`UpdateStaffDto` use a single `name` field
  (not `firstName`/`lastName` - the Add Staff form keeps two fields for UX,
  `api.ts` concatenates them on the wire), role changes `PATCH
  /admin/v1/staff/:id` directly (no `/role` suffix), `issuePin` returns only
  `{ pin }`, and revoke is `POST /admin/v1/staff/:id/revoke-pin` (not
  `DELETE .../pin`). `PinStatus` also gained its real third value,
  `"revoked"` (the backend never clears `pinHash` on revoke, so a revoked
  PIN is distinct from a staff member who never had one). The
  role-permission matrix still can't be sourced from `GET /admin/v1/roles`
  (`Role` carries no permission metadata) and stays a static reference
  table, matching the render's intent. `staff.tsx`/`staff-state.ts`/
  `staff-table.tsx`/`api.ts` and their tests were all updated to match; the
  reconciliation also caught and fixed a mock-routing bug in
  `staff.test.tsx` itself (a `!url.includes("/pin")` exclusion missed
  `revoke-pin`, since it contains `-pin` not `/pin`, so a revoke call was
  silently misrouted to the create-staff mock branch).

## Live verification

CAP-10 was verified **live**, both servers up together against a shared
Postgres (`restiq_test`) - the backend's half (`feature/32-branding-
capabilities`) was a finished, pushed, single-commit branch with its
migration already applied to that database (checked `_prisma_migrations`
before touching anything, so no `prisma migrate`/`test:e2e` run of my own
was needed or risked stepping on it). Seeded a real tenant/outlet/JWT
directly via Prisma (mirroring the backend's own e2e fixture helpers),
exercised all five endpoints with `curl` first to confirm exact shapes
(`GET/PUT /admin/v1/branding`, `GET /admin/v1/outlets`,
`GET/PATCH /admin/v1/outlets/:id/capabilities`), then drove the real UI in a
browser against both running servers: the outlet switcher showed the real
seeded outlet name; the branding form round-tripped saved tokens
(color/font/corner-radius identical after a reload) and the live preview
updated instantly on a color-token edit before Save; the Capabilities tab
showed `qr_ordering` on (as toggled via `curl`) with `kiosk`/`token_queue`
correctly defaulted off, and clicking Kiosk Mode persisted through a reload.
Test data was deleted from the shared database afterward. Covered by
mocked-fetch component tests (`branding-editor.test.tsx`,
`capabilities-editor.test.tsx`, `outlet-switcher.test.tsx`) plus pure-logic
unit tests (`branding-state.test.ts`, `capability-state.test.ts`).

CAP-1/CAP-2 were verified against the real backend (`restiq-backend`, `localhost:8180`) during
development: confirmed exact request/response shapes for all four endpoints
by reading `src/admin/**` there and by exercising `GET /admin/v1/checklist`,
`POST /admin/v1/auth/accept-invite` and the T1 invite page end-to-end through
the running dev server and proxy (including a real `502 upstream_unreachable`
once the backend process stopped mid-session). The full success path
(T1 -> T2 -> Go Live) is covered by mocked-fetch component tests; a live
click-through of that exact path is a good follow-up once both PRs are
merged and both servers are up together.

CAP-3 (menu import) was **not** verified live: its backend module
(`AdminMenuImportController`, wired into `AdminModule`) exists only
uncommitted on the backend's `feature/28-menu-import` working tree, and the
`localhost:8180` server actually reachable during this story predates that
branch (`POST /admin/v1/menu-import/upload` 404s against it). Verification
here is code-matched only - the request/response shapes above were read
directly from that branch's controller, service and DTOs, not from the
originally sketched contract - plus the mocked-fetch component tests in
`menu-import.test.tsx` and `menu-import-state.test.ts`. A live click-through
(upload -> review -> edit -> commit -> checklist reflects it) is a follow-up
once that backend PR lands and both servers run together.

CAP-4 (menu management) was **not** verified end-to-end against live backend
data: its module (`restiq-backend/src/admin/menu/`) existed only uncommitted
on `feature/30-menu-management` throughout this story, sharing the same
Postgres database (`restiq_test`) its own migration and e2e-test scripts
write to - starting that backend myself risked stepping on the concurrent
backend session's DB state (a `prisma migrate` or `test:e2e` run mid-session
would have reset or altered the schema out from under a manual click-through)
rather than blocking on it. Verification here is code-matched, not live: the
contract was read directly from that branch's actual controllers, DTOs,
services, Prisma schema diff, and its own `test/menu-management.e2e-spec.ts`
(see Key decisions for what differed from an earlier SPEC-only draft),
implemented against exactly that, and covered by mocked-fetch component
tests (`item-drawer.test.tsx`, `menu-management.test.tsx`,
`eighty-six-toggle.test.tsx`) plus pure-logic unit tests (`menu-state.test.ts`,
`item-drawer-state.test.ts`, `price-schedule-state.test.ts`). What *was*
verified live, in a real browser against the running frontend
(`localhost:3100`, backend unreachable by design): the new `(shell)` route
group renders correctly (sidebar, active-nav state, warm amber theme) for
`/admin` (Dashboard placeholder), `/admin/menu`, and the other `ComingSoon`
destinations; `/admin/menu` shows the loading skeleton then a graceful
`LoadErrorPanel` with Retry on a `502 upstream_unreachable` (rather than a
crash) with a synthetic-but-unexpired `admin_session` cookie, confirming the
proxy's routing/auth gate and the page's own failure state both behave
correctly with no backend present. A full click-through (create an item with
a modifier group, edit its price, schedule a future change, toggle 86) is the
right follow-up once both PRs land and both dev servers run together against
a shared, quiescent database.

CAP-5 (floor plan & stations) was **not** verified end-to-end against live
backend data: its module (`restiq-backend/src/admin/floor-plan/`) was built
concurrently on `feature/34-floor-plan` and never reached a running
`localhost:8180` during this story (the backend server available locally had
no `DATABASE_URL` migrated for the new `floors`/`dining_tables`/`printers`/
`stations` tables). Verification here is code-matched, not live: the
contract - including the overlap policy - was read directly from that
branch's actual controller, DTOs, service, and Prisma schema diff (not the
originally sketched three-endpoint guess), implemented against exactly that,
and covered by mocked-fetch component tests (`floor-plan.test.tsx`,
`floor-plan-list-view.test.tsx`, `stations-panel.test.tsx`) plus pure-logic
unit tests (`floor-plan-state.test.ts` - drag/snap/clamp math, overlap rect
detection, station printer-requirement validation, floor/table grouping).
What *was* verified live, in a real browser against the running frontend
(`localhost:3100`, backend unreachable by design): `/admin/floor-plan`
mounts with no console/runtime errors, the outlet-scoped loader hits
`GET /admin/api/outlets`, gets a `502 upstream_unreachable` from the proxy
with no backend running, and degrades to the same graceful "no outlets"
empty state a legitimately outlet-less tenant would see - no crash, no
unhandled rejection. A full click-through (drag a table into an occupied
spot and see the reject-and-snap-back, assign a station's printer, load the
list-view fallback) is the right follow-up once both PRs land, the new
migration is applied, and both dev servers run together against a shared,
seeded database.

The create-affordance follow-up above (empty state, add-floor/table/station/
printer) closed that follow-up and *was* verified **live**, both servers up
together against the shared Postgres (`restiq_test`), backend build clean.
A brand-new tenant + outlet with zero floors/tables/stations/printers was
seeded directly via Prisma (mirroring `floor-plan.e2e-spec.ts`'s fixture
helpers) along with a real `OwnerInvite`, so sign-in went through the actual
`/admin/invite/:token` accept flow rather than a synthetic session cookie.
Driving the real UI end to end: the zero-floor outlet rendered the actual
empty state ("No floor plan yet" / "Add your first floor"); adding a floor
switched it to the canvas with the add-floor/add-table toolbar and an empty
Kitchen Routing panel with its own add-station/add-printer actions; adding a
table posted a real `201` to `POST .../floor-plan/tables` and rendered on the
canvas at its computed default position; adding a printer then a station
with that printer selected both posted real `201`s, and the station's
printer `<select>` reflected the assignment on reload. `GET /admin/v1/
checklist` (via the `/admin/api/checklist` proxy) confirmed
`{"step":"floor_plan","completed":true,...}` as a direct result of the UI
flow - the exact gap this story closes. Seeded data was deleted from the
shared database afterward.

CAP-6 (devices & printers) was verified **live**, both servers up together
against the shared Postgres (`restiq_test`) - the backend's half
(`feature/36-tenant-devices`) was a finished, pushed branch with its schema
already migrated. A stray `tsconfig.tsbuildinfo` left the backend's
`deleteOutDir`+incremental-build combo unable to regenerate `dist/` on
`nest start --watch` (an environment quirk unrelated to this story's code,
not touched again once diagnosed); deleting it and building once fixed it.
Ran the backend's own `admin-devices.e2e-spec.ts` (13 tests) and
`floor-plan.e2e-spec.ts` (19 tests) against real Postgres - both green.
Seeded a real tenant/outlet/two devices/two printers/one station directly
via Prisma and a signed `admin_session` JWT (mirroring the backend's own
e2e fixture helpers), then drove the real UI in a browser against both
running servers at `localhost:3100`: the device table rendered both seeded
devices with the Hub badge and "Enrolled" status; clicking "Enrol device",
picking a type, and submitting returned a real code from the real
`enrolment_codes` table with a genuine 15-minute TTL that visibly ticked
down (14:58 -> 14:49) after clicking Done; the printer panel showed the
seeded station assignment and fallback correctly, and changing a printer's
render mode to Bitmap fired a real `PATCH`, confirmed 200 in the dev-server
log and confirmed persisted with a direct `psql` read after. Test data was
deleted from the shared database afterward. See Key decisions above for the
`appVersion`/`lastContactAt` gap this live pass confirmed (seeded both
fields directly in Postgres; the UI still showed "-"/"Never", proving the
gap is in the backend's response mapping, not a frontend bug). Covered by
mocked-fetch component tests (`devices.test.tsx`, `devices-table.test.tsx`,
`generate-code-dialog.test.tsx`, `printer-config-panel.test.tsx`) plus
pure-logic unit tests (`devices-state.test.ts` - countdown math with fake
timers, last-seen formatting, printer-to-station assignment) and
`code-chip.test.tsx` (mirrors the ops Code Chip's own test suite).

CAP-7 (staff & roles) was **not** verified against a real backend at all -
unlike every other CAP module in this doc, restiq-backend#38 had no branch,
no controller, and no Prisma model to read at implementation time (checked
`git branch -a`/`gh pr list`/`gh issue view 38` on the backend repo directly;
issue open, unassigned, zero commits). There is nothing to code-match against
yet, so this is mocked-only: `staff.test.tsx` (loading/error states, add
staff, role-change confirm-and-persist, PIN revoke's plain-language modal
naming the person, cancel leaves state unchanged), `staff-table.test.tsx`,
`add-staff-dialog.test.tsx`, `permission-matrix.test.tsx`, and pure-logic
`staff-state.test.ts` (form validation incl. the closed-role-set rule,
`roleHasPermission`). Additionally verified live in a real browser against
the running frontend (`localhost:3100`, backend unreachable by design, a
synthetic-but-unexpired `admin_session` cookie): the shell renders `/admin/
staff` with the Staff nav item active and a graceful `LoadErrorPanel` on the
real `502 upstream_unreachable` with no backend present; then, with
`window.fetch` patched client-side to return fixture roles/staff (proving
only the browser rendering/interaction, not the network contract), the full
staff table, revoke-PIN confirm dialog (confirmed the exact required copy:
"This removes Priya Nair's access to the till. They won't be able to sign in
with their PIN."), and Add staff dialog all rendered correctly against the
DESIGN.md dark/amber tokens with visible focus rings. Reconciling the actual
request/response shapes against restiq-backend#38's real code once it lands
is required follow-up before this can be called verified, not optional
polish - flagged as this story's primary open risk.

CAP-9 (reports catalogue) was verified against the real backend contract two
ways. First, its own e2e suite (`test/reports-catalogue.e2e-spec.ts`, 13
tests) was run directly against real Postgres from this checkout - all
green, confirming the catalogue's honest `hasData`/`message` behavior, both
real CSV exports (including cross-tenant isolation and the empty-price/
unsupported-format edge cases), and the destinations list, independent of
anything this story wrote. Second, a real browser click-through against the
actual frontend code (`localhost:3100`) was driven through a local stub HTTP
server replaying the exact response shapes read from
`reports.controller.ts`/`reports.dtos.ts` - not the live NestJS binary
itself, since the backend's shared `dist/` directory was being concurrently
rebuilt and wiped by the backend-building agent's own watch processes in the
same checkout, making a same-directory NestJS instance unreliable to hold
still. That click-through confirmed: the category grid renders correctly
against the dark/amber theme (Sales Performance/Financial & Compliance/Menu
Engineering sections, matching the T9 render); the pending message and
"Export CSV" button render correctly per report; clicking Export CSV fires a
real `GET /admin/api/reports/menu-catalogue/export?format=csv` request that
returns `200 OK` (proving the proxy's new non-JSON pass-through works, not
just its unit tests); the Accounting Tools dialog fetches
`GET /admin/api/reports/export-destinations` live and lists all five
destinations as "Not connected"; and Escape closes the dialog. Covered by
mocked-fetch component tests (`reports.test.tsx`,
`export-destinations-dialog.test.tsx`) plus pure-logic unit tests
(`reports-state.test.ts`).

#### Table footprint & capacity (2026-09-02, restiq-web#124)

- A table's default footprint is derived from its seat capacity: side = clamp(40 + 12·seats, 56, 160) px, rectangles 1.5× as wide (`sizeForSeats` in `floor-plan-state.ts`), so a 2-top is visibly smaller than a 6-top on the canvas.
- Every canvas tile shows its label and "N seats"; width/height are editable per table in the list view (`PATCH .../floor-plan/tables/:id` already accepted them).
