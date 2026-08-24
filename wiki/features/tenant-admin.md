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
