# Demo Credentials & Surface Testing Rules

Single reference for every demo login across all RESTIQ surfaces, and the rules
for testing each one. All values are **local demo data only** (database
`restiq_demo`) — nothing here is a real secret.

## Prerequisites

- Backend running on **http://localhost:8180** (`restiq-backend`, `.env` →
  `restiq_demo` DB; needs `ADMIN_JWT_SECRET`, `POS_JWT_SECRET`,
  `GUEST_JWT_SECRET` etc. set — a missing secret surfaces as a 500 on login).
- Web running on **http://localhost:3100** (`restiq-web`, `.env.local` →
  `NEXT_PUBLIC_API_URL=http://localhost:8180` and
  `POS_TENANT_ID=01a042f2-8e1b-7169-9023-ea7c86c4ab2b`). A stale
  `POS_TENANT_ID` silently 401s POS login; env changes need a server restart.
- The landing page's live Devices section additionally needs
  `DEMO_OPS_EMAIL` / `DEMO_OPS_PASSWORD` set (server-only, no `NEXT_PUBLIC_`
  prefix — the ops token this exchanges them for never reaches the browser).
  Unset or unreachable and the section just shows a "Device list unavailable"
  note; the rest of the page still renders.

## Shared demo IDs

| Thing | Value |
|---|---|
| Tenant (Spice Route) | `01a042f2-8e1b-7169-9023-ea7c86c4ab2b` |
| Outlet | `01a042f2-8e56-733d-ad2e-739163950988` |
| Kitchen station "ONE" (food) | `01a042fc-926d-75c8-ab80-5bf79707fbbd` |
| Kitchen station "Two" (drinks) | `01a042fc-b4d2-754e-9f4c-24c0688fb633` |
| QR floor | `11111111-1111-7111-8111-111111110001` |
| QR tables T1–T3 | `22222222-2222-7222-8222-22222222000{1,2,3}` |

## 1. Platform Console (internal ops) — `/ops`

| Field | Value |
|---|---|
| URL | http://localhost:3100/ops/login |
| Email | `admin@restiq.example` |
| Password | `OpsDemo2026!` |

Rules: this is the cross-tenant operator surface — tenant onboarding, plans,
device enrolment. It is a separate auth realm (`ops` JWT audience); an ops
session never works on admin/pos/guest routes and vice versa.

## 2. Tenant Admin (owner console) — `/admin`

| Field | Value |
|---|---|
| Owner | `meera@spiceroute.example` |

Rules: **there is no owner login endpoint yet** (known gap). Access is only via
the one-time invite-accept link (`POST /admin/v1/auth/accept-invite`). If the
session is lost, regenerate an invite from the ops console
(`POST /ops/v1/tenants/:id/owner-invite/regenerate`) and accept it again.

## 3. POS Cashier & Waiter — `/pos`

| PIN | Staff | Role |
|---|---|---|
| `1234` | Priya Nair | Cashier |
| `5678` | Arjun Das | Waiter |
| `9999` | Ravi Kumar | Manager |
| `0393` | Meera Iyer (Bay Leaf Kitchens) | Cashier |
| `0480` | Vamsikrishna ch (Bay Leaf Kitchens) | Waiter |
| `4947` | Rohan Desai (Bay Leaf Kitchens) | Manager |
| `6044` | Kiran Shetty (Bay Leaf Kitchens) | Kitchen |
| `5340` | Anita Rao (Bay Leaf Kitchens) | Owner |
| `1005` | Suresh Nair (Bay Leaf Kitchens) | Accountant |

URL: http://localhost:3100/pos/login — 4-digit keypad, auto-submits.

This table is generated from `src/app/demo-logins.ts` (`DEMO_STAFF`), which
also drives the landing page's staff logins table — PINs are bcrypt-hashed
server-side and can't be fetched back once issued, so that manifest is the
one place to update when a PIN changes or a new demo staff member is seeded.

Rules:
- 5 wrong PINs trigger a lockout countdown; wait it out or restart the backend.
- Manager PIN (`9999`) is what the `ManagerPinDialog` asks for on gated actions
  (void, discount above threshold, reopen).
- Order ownership: a staff member edits only their own lines; managers can
  transfer. Lines placed by guests via QR are **unclaimed** (null owner) — any
  staff member may act on them.

## 4. Kitchen Display (KDS) — `/kds`

Uses the **same POS PINs** (KDS rides the pos auth realm). Log in at
`/pos/login`, then open http://localhost:3100/kds.

Rules:
- Stations: food items route to "ONE", drinks to "Two"; unrouted items appear
  under the literal `unrouted` station.
- Bumps are insert-only history — recall/refire create new events, nothing is
  edited in place.
- Tickets fire when POS (or a guest order) **sends** — placing without sending
  produces no ticket.

## 5. Customer QR Self-Order — `/qr`

No stored credential — guests mint a session from the table QR URL:

```
http://localhost:3100/qr/t/01a042f2-8e56-733d-ad2e-739163950988/22222222-2222-7222-8222-222222220001
```

(Swap the trailing `…0001` for `…0002` / `…0003` to use T2/T3.)

Rules:
- First guest **starts** the table session (enters a name) and receives a
  **4-digit session PIN** shown on screen; later guests at the same table
  **join** with that PIN. The PIN is per-session and deliberately not
  credential-grade — it's printed on screen and rate-limited, nothing more.
- Each table has one active session; staff close it from POS
  (`close-session` on the table), after which guest requests return
  `410 session_closed`.
- Guests edit only their own cart lines; the cart is shared per table with
  per-guest attribution.
- Payments on this surface are **simulated and demo-marked** — no real money
  path is exercised beyond the shared Bill/Tender records.
- Requires the outlet capability `qr_ordering` (already enabled for the demo
  outlet). If entry fails with unavailable, check
  `GET /guest/v1/outlets/:outletId/availability`.

## Resetting demo data

The demo lives in the `restiq_demo` Postgres DB. e2e tests use `restiq_test` —
never point `.env` at `restiq_test` for manual testing; the suite wipes it.
