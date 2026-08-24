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
