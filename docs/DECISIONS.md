# Architecture Decision Records - restiq-web

Format per `coding-standards/conventions/issue-workflow.md`. The backend's
cross-cutting rules live in the architecture spine
(`restiq-design/docs/architecture/architecture-Restiq-2026-08-24/ARCHITECTURE-SPINE.md`,
AD-1 to AD-18); the records below are the payments slice (web epic #177,
backend epic restiq-backend#129) and the web-specific choices that fall out
of it. Full design: `wiki/features/payments.md`.

## ADR-001 - 2026-09-09 - An electronic payment is an intent first, a tender second

**Context:** `Tender` rows are insert-only past finalisation (AD-14) and
today are written only inside `POST bills/:id/finalize`. Real rails move
money *before* a cashier finalises (a guest pays their share; a customer
scans a QR), and a provider's result can arrive late, twice, or never.
**Decision:** Add a mutable-in-status `payment_intents` row per attempt. A
`Tender` is inserted only inside the transaction that moves an intent to
`succeeded`, or by the cashier for cash / manual UPI. A DB `CHECK` makes an
electronic tender without an intent impossible. `commitFinalize` is
unchanged except for a new 409 while any intent on the bill is pending.
**Alternatives considered:** Writing the tender at creation and deleting it
on failure (breaks insert-only and leaves a window where a bill can
finalise on money that never arrived); a `Tender.status` column (turns the
insert-only money-path table into a mutable one).
**Consequences:** One new table on the write path; the web's
`PendingTender` list stays for cash / manual only and electronic tenders
appear from the server after confirmation.

## ADR-002 - 2026-09-09 - Nothing counts as settled until the provider says so server-side (FR-51)

**Context:** Razorpay Checkout and UPI apps hand the browser a "success"
that can be spoofed or can precede a failed capture.
**Decision:** The client's result is stored as `clientResult` and only
triggers a status check. `succeeded` is reachable solely through
`confirmIntent`, fed by a verified webhook, a server-side status poll, the
expiry sweep's last look, or the `simulate` endpoint on the simulated
provider. An intent with a client result that never confirms files an
`unconfirmed_intent` exception.
**Alternatives considered:** Trusting the Checkout signature returned to the
browser (valid for Razorpay, but still a client-supplied assertion and not
generalisable to other rails).
**Consequences:** A confirmation round-trip of a few seconds on the guest
and POS screens, hidden behind the existing polling shape.

## ADR-003 - 2026-09-09 - Razorpay for India v1, reached with `fetch`, no SDK

**Context:** PRD names UPI-first India rails (dynamic QR default, intent,
Lite) and Razorpay/Ezetap + Pine Labs terminals; MDR on UPI is zero, so the
rail is cost, not revenue. The backend has a deliberate dependency
discipline (Prisma via adapter, no ORM sprawl).
**Decision:** `RazorpayProvider` uses five REST endpoints (Orders, QR Codes,
Order payments, Payments refund, QR close) and one HMAC over Node 22's
built-in `fetch` and `crypto`. No `razorpay` npm package.
**Alternatives considered:** Cashfree / PhonePe PG (fewer POS QR features);
the official SDK (one more dependency for five calls, and it hides the
raw-body handling the webhook needs).
**Consequences:** We own the request shapes; a provider API change is a
one-file edit with unit tests against the stub.

## ADR-004 - 2026-09-09 - The simulated payment is a provider, not a demo branch

**Context:** `src/guest/bills` has `SimulatedPaymentDto { simulatedOutcome }`
and the Q6 sheet has "Simulate success / failure" buttons; UJ-5's e2e and
the demo tenants depend on them.
**Decision:** `SimulatedProvider` implements the same `PaymentProvider`
interface; its "webhook" is `POST …/payment-intents/:id/simulate`, which
404s unless the tenant's provider is `simulated`. The demo badge stays
whenever the provider is simulated.
**Alternatives considered:** Keeping a parallel simulated code path beside
the real one (two money paths - exactly what AD-18 forbids).
**Consequences:** Every e2e suite runs on the simulated provider with no
network; switching a tenant to Razorpay is a settings change.

## ADR-005 - 2026-09-09 - Webhooks are a ledger first, an action second

**Context:** Providers redeliver, reorder, and occasionally forge-test
webhooks; a double `payment.captured` must not write two tenders.
**Decision:** Insert into `payment_events` (unique `(provider,
providerEventId)`) before any processing; a duplicate is answered 200 with
no side effects; processing errors are stored on the event and retried by
the reconcile sweep; the response is 200 once persisted so the provider
stops redelivering. Signature is verified over the raw body with a
timing-safe compare; failures are stored with `signatureValid=false`.
**Alternatives considered:** Processing inline and relying on the intent's
terminal state to absorb duplicates (works for captures, not for
refund/QR-closed events that carry no intent state to check).
**Consequences:** One append-only table; the reconcile sweep doubles as the
retry loop.

## ADR-006 - 2026-09-09 - Provider secrets are per tenant, encrypted at rest, write-only to clients

**Context:** RESTIQ is multi-tenant; each restaurant group has its own
Razorpay account; NFR-9 keeps payment data in region.
**Decision:** `payment_provider_configs` (one per tenant) stores
`keySecretEnc` / `webhookSecretEnc` as AES-256-GCM ciphertext under a
per-region `PAYMENTS_ENCRYPTION_KEY`. The admin API returns only
`hasKeySecret` / `hasWebhookSecret`; a blank secret on PUT means "keep".
The ops console reads provider/mode through `operator_read` and never
decrypts.
**Alternatives considered:** Platform-wide keys (would make RESTIQ the
merchant of record - the aggregator posture the PRD rules out); a secrets
manager service (right later; env-keyed AES is enough for one region and a
handful of tenants, and the migration path is a re-encrypt script).
**Consequences:** Key rotation is a scripted re-encrypt; secrets never
appear in logs, views, or audit payloads.

## ADR-007 - 2026-09-09 - Online payments are an outlet capability, `online_payments`

**Context:** `OutletCapability` already gates QR ordering (`qr_ordering`)
with free-text keys and a UI that renders known keys with defaults.
**Decision:** Add the canonical key `online_payments`. Absent or disabled:
POS offers cash + manual UPI only, Q6 shows "Pay at counter" only, every
intent endpoint 403s `online_payments_disabled`. No schema change.
**Alternatives considered:** A column on `Outlet`; a tenant-level toggle
(a group with one outlet on a legacy terminal needs per-outlet control).
**Consequences:** `KNOWN_CAPABILITY_KEYS` in `capability-state.ts` gains one
entry with a label and description.

## ADR-008 - 2026-09-09 - POS electronic rail v1 is a dynamic UPI QR, not a card terminal

**Context:** PRD's POS tenders include UPI dynamic QR (default), integrated
card terminals, wallets, gift cards, house accounts. Terminals are
device-side SDK integrations that belong to the native Android build;
the web prototype is a browser.
**Decision:** Ship `upi_qr` (Razorpay single-use, fixed-amount QR, closed at
expiry) on P5 and P13. Declare `card_terminal` in the rail enum and the
provider `capabilities()` so the UI can show it disabled with the
provider's reason; no implementation.
**Alternatives considered:** Razorpay Checkout on the POS tablet (customer
would have to type on the cashier's device - wrong hardware story).
**Consequences:** The QR image comes from the provider; the POS never
composes a UPI string itself, so the payee VPA and amount are the
provider's, not ours.

## ADR-009 - 2026-09-09 - No Zustand; state stays in `*-state.ts` modules

**Context:** Workspace standards name Zustand for client state. This repo
never adopted it: 60+ `*-state.ts` modules hold pure, unit-tested logic and
views keep React state, and every realm is lint-isolated (AD-4).
**Decision:** The five payment "stores" follow the existing pattern
(`src/lib/payment-intent.ts` shared; one per-realm module each). Reuse over
a new dependency.
**Alternatives considered:** Introducing Zustand for payments only (a
second state idiom in one codebase, and cross-realm stores would have to
live in `src/lib` anyway).
**Consequences:** No new dependency; polling hooks stay per screen in the
`use-*-poll.ts` shape.

## ADR-010 - 2026-09-09 - Clients poll intents; no push channel

**Context:** The QR surface already polls cart / status at 5 s; the spine
lists push as a non-goal for the web prototype.
**Decision:** `nextIntentPollMs`: 2 s for the first 30 s, then 5 s until a
terminal status or expiry; merges are monotonic (`mergeIntentPoll` never
regresses a terminal status). A `GET` on an intent may lazily expire it and
may trigger a provider status check.
**Alternatives considered:** SSE / WebSocket from the webhook (a new
infrastructure piece for a few seconds of latency).
**Consequences:** Worst-case confirmation latency on screen ≈ poll interval
+ provider webhook latency.

## ADR-011 - 2026-09-09 - An expired intent that the provider later captures still records the tender

**Context:** A guest can complete a UPI payment seconds after the QR /
order expired on our side; the money moved.
**Decision:** `confirmIntent` accepts `expired → succeeded`. An exception is
filed only if the captured amount differs from the intent's. Every other
move out of a terminal state is refused.
**Alternatives considered:** Refusing late captures and auto-refunding
(double the provider traffic and a worse guest experience for a race we
can simply record).
**Consequences:** The "terminal is terminal" rule has exactly one
documented exception; the client's monotonic merge treats `succeeded` as
the highest rank so it never flickers back.

## ADR-012 - 2026-09-09 - Refund allocation is explicit, per original tender

**Context:** PRD: refund method limited to the original tender(s). A bill
can carry cash + UPI QR + a guest's UPI intent.
**Decision:** `POST bills/:id/refund` takes `allocations: [{ tenderId,
amountMinor }]` that must sum to the credit note's total, each ≤ that
tender's remaining refundable amount; cash allocations become `manual`
refunds, electronic ones call the provider. The web's refund view previews
the allocation per tender before the manager PIN step.
**Alternatives considered:** Proportional auto-allocation (hides a choice
the cashier is accountable for, and rounds badly on small partial refunds).
**Consequences:** One more field on an existing DTO; the credit note stays
the record even if a provider refund fails (exception filed).

## ADR-013 - 2026-10-11 - Simulated devices are top-level windows, not frames

**Context:** the simulator's iframe canvas put each device on its own `sim-<id>.localhost` origin, a different site from the page. Every session cookie is `SameSite=lax`, which browsers drop when set inside a cross-site frame, so no device could sign in (PE-26 / CU-25).
**Decision:** each device opens with `window.open` on its own origin, top-level, so lax cookies work unchanged. The simulator page keeps only the device list (Focus, Close, Re-open, Remove, status). Session cookies are not loosened to `SameSite=None`.
**Consequences:** no side-by-side canvas; the browser's own window management replaces it. Pop-up blockers must allow the simulator page (the page says so when a window is blocked).

## ADR-014 - 2026-10-11 - Test mode is per tenant and read from the API

**Context:** demo tenants need simulated payments and mail on a server where the simulator is off, and must be visibly marked (restiq-backend#213).
**Decision:** the web never decides Test mode itself; it reads `testMode` from `GET /admin/v1/tenant`, `GET /pos/v1/tenant`, the ops tenant views and each invoice. A failed lookup shows no badge.
**Consequences:** one extra small request per console header mount. The invoice's own `testMode` keeps an old test invoice marked after the tenant goes Live.


## ADR-015 - 2026-10-22 - Host the web app on Cloudflare Workers (#397)

**Context:** every tenant gets its own subdomain of `dailypos.shop`, so production needs a wildcard certificate. The zone's DNS is on Cloudflare with SSL mode Full (strict). Vercel only issues a wildcard certificate when the domain uses Vercel's nameservers, which would mean moving DNS off Cloudflare.
**Decision:** deploy the Next app as a Cloudflare Worker with `@opennextjs/cloudflare`, routed on `dailypos.shop/*` and `*.dailypos.shop/*`. Cloudflare's edge certificate covers the wildcard and DNS stays where it is. `api.dailypos.shop` is excluded with a script-less route. No incremental cache (R2/KV): every page reads live data.
**Alternatives considered:** Vercel with Vercel nameservers (moves DNS); Vercel behind the Cloudflare proxy (Vercel can't issue the wildcard origin certificate that Full (strict) needs).
**Consequences:** `src/proxy.ts` runs as OpenNext's Node.js middleware, which OpenNext flags as experimental. `NEXT_PUBLIC_*` values come from the committed `.env.production`; `PROXY_SHARED_SECRET` is a Wrangler secret. `vercel.json` stays for now.
