# Planned

## Payments - real rails (web epic [#177](https://github.com/AusPosRest/restiq-web/issues/177), backend epic [restiq-backend#129](https://github.com/AusPosRest/restiq-backend/issues/129))

Architecture: [wiki/features/payments.md](../features/payments.md). ADRs:
[docs/DECISIONS.md](../../docs/DECISIONS.md). Each story below gets its own
GitHub issue when it is picked up (workspace rule: > 2 days ⇒ sub-issues;
branch `feature/{issue}-{slug}`; PR `Closes #{issue}`). Sizes are working
days for one developer with tests. Order matters: the backend story a web
story reconciles against must be **merged** first - never build a web
contract against an unmerged guess (this repo's RECONCILED history is the
reason).

### Phase P0 - foundation (no user-visible change)

| # | Story | Repo | Size | Depends on | Definition of done |
| --- | --- | --- | --- | --- | --- |
| B1 | Schema + migration: `payment_provider_configs`, `payment_intents`, `payment_events`, `payment_refunds`, `payment_exceptions`; `TenderMethod` widened; `tenders.payment_intent_id` (unique) + `risk_acknowledged`; `CHECK` electronic⇔intent; partial unique "one active intent"; RLS on all five | backend | 0.5 | - | `pnpm run db:migrate` clean on test db; `rls.e2e-spec.ts` covers the five tables; existing suites green |
| B2 | `PaymentProvider` interface; `SimulatedProvider`; `RazorpayProvider` on `fetch` (orders, qr_codes, order payments, refund, qr close, HMAC verify) | backend | 1 | B1 | unit tests against an HTTP stub incl. signature vectors and timing-safe compare |
| B3 | `intents.service`: create (clientKey idempotent, one active per target), get (lazy expire + optional status check), cancel, `confirmIntent` (Tender insert, share paid, bill auto-complete, `expired → succeeded` allowed), expiry sweep | backend | 1 | B2 | e2e `payments-intents`: create/duplicate/race/expire/confirm; `SimulatedProvider` end to end |
| W1 | Architecture doc, ADRs, task plan, five client state modules + tests | web | 0.5 | - | **this PR** |

### Phase P1 - guest UPI

| # | Story | Repo | Size | Depends on | Definition of done |
| --- | --- | --- | --- | --- | --- |
| B4 | Guest endpoints: share intent, pay-all intent, get, client-result, `simulate` (simulated only); `SimulatedPaymentDto` path retired; `guest-checkout.e2e-spec.ts` rewritten on intents (UJ-5 preserved) | backend | 1 | B3 | old `payShare/payAll` removed; all guest suites green |
| B6 | Webhook controller (raw body), `payment_events` ledger, dispatch, per-tenant secret lookup, rate limit | backend | 1 | B3 | e2e `payments-webhook`: valid, duplicate, out-of-order, forged, unknown ref |
| B8 | `GET/PUT admin/v1/payment-settings` (secrets encrypted, write-only), `online_payments` capability check in every intent endpoint, audit row on change | backend | 0.5 | B1 | e2e `payment-settings` incl. key/mode mismatch and secret never echoed |
| W2 | Settings ▸ Payments tab: provider, mode, key id, secrets, webhook URL copy | web | 0.5 | B8 merged | reconciled header comment against the merged DTO; `data-testid` on every control; component tests |
| W3 | Q6 on real rails: UPI app chooser, intent handoff (Checkout or `upiIntentUrl`), polling hook, retry, pay-at-counter; demo badge only on `simulated` | web | 1 | B4, B6 merged | component tests for every phase in `payment-rail-state.ts`; demo path still passes the CAP-5 tests |

### Phase P2 - POS dynamic QR

| # | Story | Repo | Size | Depends on | Definition of done |
| --- | --- | --- | --- | --- | --- |
| B5 | POS endpoints: create `upi_qr` intent (amount ≤ remaining), get, cancel; finalise 409 `payment_pending`; `upi_manual` requires `riskAcknowledged`; `BillView.tenders[]` gains `paymentIntentId`, `riskAcknowledged` | backend | 1 | B3 | `pos-bills.e2e-spec.ts` extended; counter-orders suite green |
| W4 | Settle + counter: "UPI QR" tender (QR image, countdown, cancel, auto-captured tender from the server), risk-ack checkbox on manual UPI, finalise gate | web | 1 | B5 merged | `electronic-tender-state.ts` header reconciled; settle + counter tests; `data-testid`s per architecture doc |

### Phase P3 - refunds

| # | Story | Repo | Size | Depends on | Definition of done |
| --- | --- | --- | --- | --- | --- |
| B7 | `allocations[]` on refund; `payment_refunds`; provider refund with idempotency; `refund.processed/failed` handling; cash refunds feed shift expected-cash (fixes the known issue) | backend | 1 | B6 | `pos-refunds.e2e-spec.ts` extended; shift close over/short test with a cash refund |
| W5 | Refund view: allocation preview per original tender, refund status chips, exception hint on failure | web | 0.5 | B7 merged | tests |

### Phase P4 - reconciliation

| # | Story | Repo | Size | Depends on | Definition of done |
| --- | --- | --- | --- | --- | --- |
| B9 | Expiry sweep (`@Interval` 60 s) + `POST reconcile` + settlement comparison; `GET exceptions`, `POST resolve` (audited); payments report rows gain `rail`, `providerRef`, `reconciledAt` | backend | 1 | B6, B7 | e2e `payments-reconcile`: unconfirmed intent, captured-no-tender, refund mismatch, resolve requires reason |
| W6 | Reports ▸ Reconciliation: queue, severity, totals, resolve/write-off dialog (reason mandatory); payments report columns | web | 1 | B9 merged | tests; `reconciliation-state.ts` header reconciled |
| W7 | Playwright: guest UPI happy path + UJ-5 failed share (simulated); POS QR settle; finalise blocked while pending | web | 0.5 | W3, W4 | specs in CI |

### Phase P5 - pilot

| # | Story | Repo | Size | Depends on | Definition of done |
| --- | --- | --- | --- | --- | --- |
| P5a | Razorpay **test mode** run-through on the dev tenant: one intent per rail, one refund, one forced webhook replay; results in `wiki/testing-credentials.md` | both | 0.5 | P1-P4 | checklist ticked |
| P5b | First pilot tenant on **live** mode; ops read-only provider status (W8) | both | 0.5 | P5a | owner sign-off |

### Later epics (not scheduled)

- AU rails: Linkly / Tyro terminal integration on the native POS; FR-53
  surcharging (dated 2026-10-01).
- Gift card / loyalty / house-account tenders (online-only per FR-52).
- Per-outlet provider accounts; ops-side "disable live mode" tenant
  capability.

## Carried over (unchanged)

Tenant Admin web stories 8-9 (owner dashboard, reports)
per `restiq-design/docs/specs/spec-tenant-admin/stories.yaml`. Each will wire
one of `/admin/onboarding`'s placeholder deep-links to a real screen.

CAP-7's staff/roles API contract (`src/app/admin/api.ts`, `staff-state.ts`)
was built provisionally, with no backend to read against
(restiq-backend#38 not yet started) - reconciling it against the real DTOs
once that backend lands is required follow-up, not optional (see
`wiki/features/tenant-admin.md`'s CAP-7 Key decisions entry).
