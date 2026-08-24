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
  - There is **no outlets-listing endpoint anywhere in the admin realm**
    (checked across every story to date, not just this one - outlets are
    only ever created directly in backend test fixtures). `fetchOutlets()`
    and the sidebar outlet switcher are this story's own inferred guess at
    where that will land; with zero outlets returned, the switcher and every
    per-outlet section degrade to hidden rather than broken.
  - The Menu list itself (`GET /admin/v1/menu/items`) carries no price -
    `MenuTable` fetches each row's current dine-in/delivery price
    individually after mount; a row with variants shows "Varies" rather than
    fetching every variant's price into the list view.

## Live verification

Verified against the real backend (`restiq-backend`, `localhost:8180`) during
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
