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

## Data model

Owned by the backend - see `restiq-backend/wiki/features/tenant-admin.md`.
This surface talks to the API purely through the documented shapes:
`GET /admin/v1/checklist` returns `steps` as an array of
`{ step, completed, completedAt }` (snake_case step keys:
`outlet_details`, `floor_plan`, `menu_import`, `devices`, `staff`) plus
`canGoLive` and `tenantStatus` - there is no `firstIncompleteRequiredStep`
field, so `checklist-state.ts` derives it from the array's own order.

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
