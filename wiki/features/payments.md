# Payments (real rails) - web + backend architecture

Status: **designed, build starting 2026-09-09** (web epic
[#177](https://github.com/AusPosRest/restiq-web/issues/177), backend epic
[restiq-backend#129](https://github.com/AusPosRest/restiq-backend/issues/129)).
This is the architecture slice the spine deferred under "Real guest payment
rails" and "Payment provider abstraction". It binds PRD §4.7 (FR-50 provider
abstraction, FR-51 reconciliation-before-settled, FR-52 offline payment
policy), the addendum's "Payments depth" notes and ADR-11, and the spine's
AD-14 (insert-only money path), AD-15 (one manager-auth service), AD-17
(guest realm) and AD-18 (one order pipeline, one money path).

Decision records for every non-obvious choice below: [docs/DECISIONS.md](../../docs/DECISIONS.md)
(ADR-001 to ADR-012). Task plan and sequencing: [wiki/tasks/planned.md](../tasks/planned.md).

## Capabilities

- **CAP-P1 Provider abstraction** - every rail implements
  `createIntent / getStatus / refund / settlementReport / capabilities()`
  behind one interface; adding a rail never touches bill logic (FR-50).
- **CAP-P2 Payment intents** - an electronic payment is a first-class,
  provider-backed *intent* that becomes a `Tender` only when the provider
  confirms server-side (FR-51). The client's own "success" is provisional.
- **CAP-P3 Guest UPI checkout** - Q6's UPI-first buttons hand off to a real
  UPI app (GPay / PhonePe / Paytm / any) through the tenant's provider; the
  `simulated` provider keeps the demo path and UJ-5's failed-share invariant
  exercisable (FR-42, UJ-5).
- **CAP-P4 POS electronic tender** - P5 Bill & Settle and P13 Counter gain
  "UPI QR" (dynamic, single-use, fixed-amount QR) whose tender is written by
  the confirmation, never by the cashier; manual UPI needs a risk
  acknowledgement (FR-52); a bill cannot finalise while an intent is pending.
- **CAP-P5 Refunds on the original rail** - a credit note's electronic
  portion is refunded through the provider against the original tender; the
  cash portion stays a till movement (PRD: refund limited to original tender).
- **CAP-P6 Reconciliation** - expiry sweep + provider comparison file
  *exceptions*; an owner resolves each with a mandatory reason; nothing
  unconfirmed ever counts as settled revenue (FR-51).

## Rules that bind this design

1. **Not a payment aggregator; never a PAN.** Card entry happens on the
   provider's hosted surface (Razorpay Checkout) or a terminal; RESTIQ stores
   provider references only. Keeps us outside RBI PA Directions and at PCI
   SAQ-A posture.
2. **No POS card store-and-forward, ever** (ADR-11). Offline policy is cash +
   merchant-verified UPI with a risk acknowledgement (FR-52). The web
   prototype is online-only, so `upi_manual` + `riskAcknowledged` is its
   stand-in for the native device's self-verification dialog.
3. **A `Tender` row means money actually moved.** It is inserted only inside
   the same transaction that moves an intent to `succeeded`, or by the
   cashier for cash / manual UPI. Insert-only past finalisation (AD-14).
4. **One money path** (AD-18). Guest and staff intents write the same
   `payment_intents` / `tenders` rows; `commitFinalize` is untouched except
   for one new gate (no pending intent).
5. **Tenant-scoped, region-local.** Every new table carries `tenant_id` +
   forced RLS (AD-5); provider secrets and webhook URLs live in the tenant's
   data plane (NFR-9: payment data never leaves the region).
6. **Idempotent everywhere money is touched** (AD-7): client keys on intent
   creation, one active intent per target, unique provider event ids on the
   webhook ledger, monotonic status merges on the client.

## What's built

- **Simulated card terminal (issue #188 web / restiq-backend#130) - the
  first slice of this epic, on the `card_terminal` rail and the `simulated`
  provider.** Backend: `payment_intents` table + `tenders.payment_intent_id`
  / `risk_acknowledged` (B1's core), `src/pos/payments/` (`intents.service`,
  `intent-core`'s `confirmIntent` - the one code path that writes an
  electronic Tender), `POST pos/v1/bills/:id/intents`, `GET
  payment-intents/:id`, `POST …/cancel`, `POST …/simulate`, `GET
  outlets/:outletId/payment-intents`, and `commitFinalize`'s 409
  `payment_pending` gate. Web: `terminal` device type across Tenant Admin /
  ops / enrolment / landing, `/pos/terminal` (`terminal-screen.tsx`, the
  device that polls its outlet's pending intents and taps Approve /
  Decline), and on settle + counter a third tender method **Card terminal**
  (`tender-keypad.tsx` → `use-terminal-intent.ts` → `terminal-intent-panel.tsx`)
  whose tender arrives from the server after approval and counts through
  `electronic-tender-state.ts`'s `canFinalizeWithElectronic`. `FinalizeBillDto.tenders`
  may now be empty when the terminal covered the whole bill. Deferred from
  this slice: the `online_payments` capability gate (B8), the FR-52
  `risk_ack_required` enforcement (B5), guest shares (B4), real providers.
- **W1 (issue #178):** this document, the ADRs, the task plan, and the five
  client state modules.

## What exists today (the ground this builds on)

| Piece | Where | State |
| --- | --- | --- |
| `Bill` (open → finalized once), `Tender` (`cash` \| `upi_manual` cashier-posted; `card_terminal` server-written since restiq-backend#130), gapless `BillNumberCounter` | `restiq-backend/prisma/schema.prisma`, `src/pos/bills/bill-core.ts` | done - cashier tenders ride in the one `POST bills/:id/finalize` call; `commitFinalize` sums *all* tenders on the bill (electronic ones included), 400s `tender_mismatch`, and 409s `payment_pending` while an intent is open |
| Guest checkout: `BillShare` per guest, `payShare` / `payAll` with `SimulatedPaymentDto { simulatedOutcome }` | `src/guest/bills/bills.service.ts` | done - the caller picks the outcome; a success writes a real `upi_manual` Tender and marks the share paid; all shares paid ⇒ `completeBill` |
| Refunds: `CreditNote` + lines, manager-gated | `bills.service.ts#refund` | done - no money moves; the note is the record |
| Manager authorisation | `src/platform/manager-auth.service.ts` | done - `MANAGER_GATED_ACTIONS` incl. `refund`, `discount_above_threshold` |
| Web settle / counter: `PendingTender[]` accumulated locally, `canFinalizeBill` mirrors the sum gate | `src/app/pos/orders/[orderId]/settle/bill-state.ts`, `tender-keypad.tsx`, `counter/counter-view.tsx` | done - two method buttons (Cash, UPI) |
| Web Q6 checkout: split / pay-all, demo-marked payment sheet, 410 ⇒ settled framing | `src/app/qr/checkout/*` | done |
| Payments report | `admin/(shell)/reports/payments*.ts(x)`, backend `admin/reports` | done - rows carry `tenders[].method`, no rail / provider ref |
| Capability toggles per outlet (`qr_ordering`, `kiosk`, `token_queue`) | `OutletCapability`, `settings/capability-state.ts` | done - free-text keys; a new key needs no schema change |

## Target architecture

```text
   Guest phone (/qr)            POS tablet (/pos)            Owner (/admin)
   Q6 checkout                  P5 settle, P13 counter       Settings ▸ Payments
   payment-rail-state           electronic-tender-state      payment-settings-state
        │ guest realm                 │ pos realm                 │ admin realm
        ▼                             ▼                           ▼
 ┌──────────────────────────── restiq-backend (one region) ──────────────────────────┐
 │  guest/bills ──┐          pos/bills ──┐            admin/payments ──┐             │
 │                ▼                      ▼                             ▼             │
 │              payments/  (new bounded context, barrel-exported)                    │
 │              ├─ intents.service   create · get · cancel · expire · confirm        │
 │              ├─ webhook.controller  POST /webhooks/payments/:provider/:tenantId   │
 │              ├─ refunds.service   CreditNote → per-tender allocation → provider   │
 │              ├─ reconcile.service sweep + provider comparison → exceptions        │
 │              ├─ config.service    per-tenant provider config, secrets encrypted   │
 │              └─ providers/        PaymentProvider ── SimulatedProvider            │
 │                                                    └─ RazorpayProvider (fetch)    │
 │  tables: payment_provider_configs · payment_intents · payment_events ·            │
 │          payment_refunds · payment_exceptions · tenders(+intent id, +risk ack)    │
 └──────────────────────────────────┬────────────────────────────────────────────────┘
                                    │ HTTPS (Orders, QR Codes, Payments, Refunds)
                                    ▼                     ▲ webhooks (HMAC-SHA256)
                              Razorpay (IN)     ·  future: Linkly / Tyro (AU terminals)
```

**Dependency direction.** `pos/bills` and `guest/bills` import `payments`
through its barrel; `payments` imports only `platform` (Prisma, manager-auth,
audit, uuidv7) and the framework-free `pos/bills` core (`createTenderRecord`,
`commitFinalize`, `loadBill`) through that module's scoped barrel - the same
no-cycle trick `guest/bills` already uses. `payments` never imports `guest`
or `admin`.

**Where the browser talks.** Each realm keeps its own proxy branch
(`/pos/api`, `/qr/api`, `/admin/api`, AD-4). The webhook is the one route
outside every realm: no session cookie, signature-authenticated, mounted
directly on the backend (never through restiq-web).

## Data model (Prisma additions, backend B1)

```prisma
enum PaymentProviderKind { simulated razorpay }
enum PaymentMode         { test live }
enum PaymentRail         { upi_intent upi_qr card_online card_terminal }
enum PaymentIntentStatus { created pending succeeded failed expired cancelled }
enum PaymentRefundStatus { pending processed failed manual }
enum PaymentExceptionKind {
  unconfirmed_intent          // client claimed success, provider never confirmed within TTL
  provider_captured_no_tender // provider shows a capture we have no tender for
  amount_mismatch             // captured amount ≠ intent amount (overpayment is recorded, then flagged)
  provider_status_conflict    // local succeeded, provider says failed/refunded
  refund_mismatch             // provider refund state ≠ local payment_refunds
}
enum PaymentExceptionStatus { open resolved written_off }

// One per tenant. Secrets are AES-256-GCM ciphertext (PAYMENTS_ENCRYPTION_KEY,
// per region) - never selected into a view, never logged.
model PaymentProviderConfig {
  id               String              @id @default(uuid(7)) @db.Uuid
  tenantId         String              @unique @map("tenant_id") @db.Uuid
  provider         PaymentProviderKind @default(simulated)
  mode             PaymentMode         @default(test)
  keyId            String?             @map("key_id")
  keySecretEnc     Bytes?              @map("key_secret_enc")
  webhookSecretEnc Bytes?              @map("webhook_secret_enc")
  updatedByOwnerId String?             @map("updated_by_owner_id") @db.Uuid
  createdAt        DateTime            @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt        DateTime            @updatedAt @map("updated_at") @db.Timestamptz(6)
  @@map("payment_provider_configs")
}

// The pre-tender row. Mutable in status only; the money-path row it produces
// (Tender) is insert-only as before. One ACTIVE intent per target:
//   CREATE UNIQUE INDEX payment_intents_one_active
//     ON payment_intents (bill_id, COALESCE(share_id, '00000000-0000-0000-0000-000000000000'::uuid))
//     WHERE status IN ('created', 'pending');
model PaymentIntent {
  id               String              @id @default(uuid(7)) @db.Uuid
  tenantId         String              @map("tenant_id") @db.Uuid
  outletId         String              @map("outlet_id") @db.Uuid
  billId           String              @map("bill_id") @db.Uuid
  shareId          String?             @map("share_id") @db.Uuid      // BillShare for a per-guest intent
  rail             PaymentRail
  provider         PaymentProviderKind
  amountMinor      BigInt              @map("amount_minor")
  currency         String                                            // 'INR' | 'AUD', from the tenant's country
  status           PaymentIntentStatus @default(created)
  clientKey        String              @map("client_key")             // idempotency, unique per tenant
  providerRef      String?             @map("provider_ref")           // order_id / qr_code id - never a secret
  providerPayload  Json?               @map("provider_payload")       // last provider status object
  clientPayload    Json                @map("client_payload")         // what the browser needs (see contracts)
  clientResult     Json?               @map("client_result")          // provisional client-side result (payment id), never trusted
  failureReason    String?             @map("failure_reason")
  expiresAt        DateTime            @map("expires_at") @db.Timestamptz(6)
  succeededAt      DateTime?           @map("succeeded_at") @db.Timestamptz(6)
  reconciledAt     DateTime?           @map("reconciled_at") @db.Timestamptz(6)
  createdByStaffId String?             @map("created_by_staff_id") @db.Uuid
  createdByGuestId String?             @map("created_by_guest_id") @db.Uuid
  createdAt        DateTime            @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt        DateTime            @updatedAt @map("updated_at") @db.Timestamptz(6)
  tender           Tender?
  @@unique([tenantId, clientKey])
  @@index([billId, status])
  @@index([tenantId, status, expiresAt])
  @@map("payment_intents")
}

// Append-only provider event ledger. Insert FIRST, then process - a duplicate
// delivery hits the unique index and is answered 200 with no side effects.
model PaymentEvent {
  id              String              @id @default(uuid(7)) @db.Uuid
  tenantId        String              @map("tenant_id") @db.Uuid
  provider        PaymentProviderKind
  providerEventId String              @map("provider_event_id")
  eventType       String              @map("event_type")
  intentId        String?             @map("intent_id") @db.Uuid
  refundId        String?             @map("refund_id") @db.Uuid
  payload         Json
  signatureValid  Boolean             @map("signature_valid")
  receivedAt      DateTime            @default(now()) @map("received_at") @db.Timestamptz(6)
  processedAt     DateTime?           @map("processed_at") @db.Timestamptz(6)
  processingError String?             @map("processing_error")
  @@unique([provider, providerEventId])
  @@map("payment_events")
}

model PaymentRefund {
  id            String              @id @default(uuid(7)) @db.Uuid
  tenantId      String              @map("tenant_id") @db.Uuid
  creditNoteId  String              @map("credit_note_id") @db.Uuid
  tenderId      String              @map("tender_id") @db.Uuid          // the ORIGINAL tender being reversed
  intentId      String?             @map("intent_id") @db.Uuid
  amountMinor   BigInt              @map("amount_minor")
  status        PaymentRefundStatus @default(pending)                   // cash ⇒ 'manual' at creation
  providerRef   String?             @map("provider_ref")
  failureReason String?             @map("failure_reason")
  createdAt     DateTime            @default(now()) @map("created_at") @db.Timestamptz(6)
  processedAt   DateTime?           @map("processed_at") @db.Timestamptz(6)
  @@index([creditNoteId])
  @@index([tenderId])
  @@map("payment_refunds")
}

model PaymentException {
  id                  String                 @id @default(uuid(7)) @db.Uuid
  tenantId            String                 @map("tenant_id") @db.Uuid
  outletId            String                 @map("outlet_id") @db.Uuid
  billId              String?                @map("bill_id") @db.Uuid
  intentId            String?                @map("intent_id") @db.Uuid
  refundId            String?                @map("refund_id") @db.Uuid
  kind                PaymentExceptionKind
  status              PaymentExceptionStatus @default(open)
  providerRef         String?                @map("provider_ref")
  localAmountMinor    BigInt?                @map("local_amount_minor")
  providerAmountMinor BigInt?                @map("provider_amount_minor")
  detail              Json?
  detectedAt          DateTime               @default(now()) @map("detected_at") @db.Timestamptz(6)
  resolvedAt          DateTime?              @map("resolved_at") @db.Timestamptz(6)
  resolvedByOwnerId   String?                @map("resolved_by_owner_id") @db.Uuid
  resolutionReason    String?                @map("resolution_reason")
  @@index([tenantId, status])
  @@index([outletId, status])
  @@map("payment_exceptions")
}

// Existing rows, extended:
enum TenderMethod { cash upi_manual upi_intent upi_qr card_online card_terminal }
model Tender {
  // ...
  paymentIntentId  String?  @unique @map("payment_intent_id") @db.Uuid
  riskAcknowledged Boolean  @default(false) @map("risk_acknowledged")   // FR-52, meaningful for upi_manual
  paymentIntent    PaymentIntent? @relation(fields: [paymentIntentId], references: [id])
}
```

Migration SQL also adds, beyond what Prisma's DSL can express:

- `ALTER TABLE tenders ADD CONSTRAINT tenders_electronic_needs_intent CHECK
  ((method IN ('cash','upi_manual')) = (payment_intent_id IS NULL));` - an
  electronic tender cannot exist without its intent, and a cash/manual tender
  can never claim one.
- The partial unique index `payment_intents_one_active` above.
- `ENABLE` + `FORCE ROW LEVEL SECURITY`, `tenant_isolation` (USING + WITH
  CHECK on `app.tenant_id`) and `operator_read` on all five new tables -
  copy the `print_jobs` migration verbatim.

## Provider abstraction (backend B2)

```ts
// src/payments/providers/provider.ts - framework-free
export interface PaymentProvider {
  readonly kind: PaymentProviderKind
  capabilities(): { rails: PaymentRail[]; refunds: boolean; settlementReport: boolean; webhooks: boolean }
  createIntent(input: CreateIntentInput): Promise<ProviderIntent>     // { providerRef, clientPayload, expiresAt }
  getStatus(providerRef: string, rail: PaymentRail): Promise<ProviderStatus>  // { state: 'pending'|'captured'|'failed'|'expired', amountMinor, paymentRef?, raw }
  cancel(providerRef: string, rail: PaymentRail): Promise<void>       // close a QR / void an order
  refund(input: { paymentRef: string; amountMinor: bigint; idempotencyKey: string }): Promise<{ providerRef: string; state: 'pending'|'processed'|'failed' }>
  settlementReport(range: { from: Date; to: Date }): AsyncIterable<ProviderPayment>  // for reconcile
  verifyWebhook(rawBody: Buffer, headers: Record<string, string>, secret: string): { valid: boolean; eventId: string; type: string; body: unknown }
}
```

| Concern | `SimulatedProvider` | `RazorpayProvider` |
| --- | --- | --- |
| `createIntent` `upi_intent` / `card_online` | `clientPayload: { simulated: true }` | `POST /v1/orders` (amount, currency, receipt = intent id, notes { tenantId, intentId }) ⇒ `clientPayload: { checkout: { keyId, orderId, upiFirst: true } }` |
| `createIntent` `upi_qr` (POS) | `{ simulated: true, qrImageUrl: null }` | `POST /v1/payments/qr_codes` (`type: upi_qr`, `usage: single_use`, `fixed_amount: true`, `payment_amount`, `close_by = expiresAt`) ⇒ `{ qrImageUrl }` |
| `getStatus` | reads the intent's own simulated state | `GET /v1/orders/:id/payments` (captured ⇒ captured) / `GET /v1/payments/qr_codes/:id` (`payments_amount_received`) |
| `cancel` | no-op | `POST /v1/payments/qr_codes/:id/close`; orders need no cancel (they expire) |
| `refund` | immediate `processed` | `POST /v1/payments/:paymentId/refund` with `X-Razorpay-Idempotency` header ⇒ `pending`, resolved by `refund.processed` |
| Webhook | none - the `simulate` endpoint below is its "webhook" | `X-Razorpay-Signature` = HMAC-SHA256(raw body, webhook secret), timing-safe compare; event id from `x-razorpay-event-id` |
| Auth | - | Basic `keyId:keySecret`, secrets decrypted per request, never cached in a log line |
| `capabilities()` | `{ rails: all, refunds, no settlementReport }` | `{ rails: [upi_intent, upi_qr, card_online], refunds, settlementReport }`; `card_terminal` unsupported until a terminal partner is integrated |

Razorpay is reached with plain `fetch` (Node 22) - no SDK dependency; the
surface used is five endpoints and one HMAC. AU rails (Linkly, Tyro) are
terminal-side integrations that live on the native POS, not here; the
interface leaves `card_terminal` as a declared-but-unsupported rail so the
web shows it greyed with the provider's own reason.

## Intent lifecycle

```text
                 create (client key)              provider confirms
   ┌─────────┐  ─────────────────▶  ┌─────────┐  (webhook | status poll | simulate) ┌───────────┐
   │ created │                       │ pending │ ──────────────────────────────────▶ │ succeeded │──▶ Tender row
   └─────────┘                       └─────────┘                                     └───────────┘   (+ BillShare paid,
        │  provider call failed          │  provider says failed ──▶ failed                           + bill auto-complete
        └──────────▶ failed              │  TTL passed (sweep or lazy on read) ──▶ expired              when every share paid)
                                         │  cashier / guest cancels ──▶ cancelled
```

- **Transitions are monotonic and terminal-stable.** A webhook that arrives
  after `expired` still wins if the provider captured money: the intent moves
  `expired → succeeded` (money moved; recording it is not optional) and an
  `amount_mismatch`/`provider_status_conflict` exception is filed only if the
  amounts differ. Every other move out of a terminal state is refused.
- **Confirmation is one code path** - `confirmIntent(tx, intentId, providerStatus)` -
  whether the trigger is a webhook, a status poll during `GET`, the expiry
  sweep's last look, or the `simulate` endpoint. It `SELECT … FOR UPDATE`s the
  intent, exits if terminal, inserts the `Tender` (method = rail, amount =
  captured amount, `paymentIntentId`), marks the share paid when `shareId` is
  set (with `payerPhone` captured at intent creation, FR-42), and calls the
  existing `completeBill` when no share remains outstanding.
- **Provisional client results.** Razorpay Checkout hands the browser a
  `razorpay_payment_id`; the web posts it to
  `POST payment-intents/:id/client-result` where it is stored in
  `clientResult` and triggers an immediate `getStatus`. It never flips the
  intent on its own. If nothing confirms before `expiresAt`, the sweep files
  `unconfirmed_intent` (FR-51's "never in settled revenue").
- **TTL**: `upi_intent` / `upi_qr` 5 min, `card_online` 15 min - carried on
  the intent (`expiresAt`), sent to the provider (`close_by`), and shown as a
  countdown on the client.

## API contracts (provisional until the backend PRs land - reconcile then)

Shared view, every realm:

```ts
interface PaymentIntentView {
  id: string; billId: string; shareGuestId: string | null;
  rail: PaymentRail; provider: 'simulated' | 'razorpay';
  amountMinor: number; currency: 'INR' | 'AUD';
  status: PaymentIntentStatus; failureReason: string | null;
  providerRef: string | null;                         // never a secret
  client: { simulated?: boolean; qrImageUrl?: string | null;
            upiIntentUrl?: string;                    // when the provider returns a upi:// intent directly
            checkout?: { keyId: string; orderId: string; upiFirst: boolean } };
  createdAt: string; expiresAt: string; succeededAt: string | null; tenderId: string | null;
}
```

| Realm | Route | Body → Response | Errors |
| --- | --- | --- | --- |
| guest | `POST guest/v1/bills/:id/shares/:guestId/intents` | `{ rail: 'upi_intent' \| 'card_online', app?: 'gpay' \| 'phonepe' \| 'paytm' \| 'other', payerPhone?, clientKey }` → 201 `PaymentIntentView` (200 + same view for a repeated `clientKey`) | 409 `share_already_paid`, 409 `intent_active` (another active intent on this share), 409 `already_finalized`, 410 `session_closed`, 403 `online_payments_disabled` |
| guest | `POST guest/v1/bills/:id/intents` (pay-all) | same body → 201 | + 409 `partial_payment_exists` |
| guest | `GET guest/v1/payment-intents/:id` | → 200 view (server may lazily expire on read) | 404 |
| guest | `POST guest/v1/payment-intents/:id/client-result` | `{ paymentRef }` → 202 view | 409 if terminal |
| guest / pos | `POST …/payment-intents/:id/simulate` | `{ outcome: 'success' \| 'failure' }` → 200 view | 404 unless the tenant's provider is `simulated` |
| pos | `POST pos/v1/bills/:id/intents` | `{ rail: 'upi_qr', amountMinor, clientKey }` → 201 view | 400 `amount_exceeds_remaining`, 409 `intent_active`, 409 `already_finalized`, 403 `online_payments_disabled` |
| pos | `GET pos/v1/payment-intents/:id` · `POST …/cancel` | → 200 view | 409 `already_succeeded` on cancel |
| pos | `POST pos/v1/bills/:id/finalize` (existing) | `tenders[]` now only cash / `upi_manual { riskAcknowledged: true }`; electronic tenders are already on the bill | new 409 `payment_pending`, 400 `risk_ack_required` |
| pos | `POST pos/v1/bills/:id/refund` (existing) | + `allocations: [{ tenderId, amountMinor }]` (must equal the note's total; each ≤ that tender's remaining) → `CreditNoteView` + `refunds: PaymentRefundView[]` | 400 `allocation_mismatch` |
| admin | `GET / PUT admin/v1/payment-settings` | PUT `{ provider, mode, keyId?, keySecret?, webhookSecret? }` → `{ provider, mode, keyId, hasKeySecret, hasWebhookSecret, webhookUrl, updatedAt }` | 400 `key_mode_mismatch` (`rzp_test_` vs `live`), 400 `secret_required` |
| admin | `GET admin/v1/payments/exceptions?outletId&status&cursor&limit` | → `{ items: PaymentExceptionRow[], nextCursor, totals: { open } }` | |
| admin | `POST admin/v1/payments/exceptions/:id/resolve` | `{ action: 'resolved' \| 'written_off', reason }` → row | 409 if not open, 400 empty reason |
| admin | `POST admin/v1/payments/reconcile` | `{ outletId?, from, to }` → `{ filed: number }` | 409 `provider_no_settlement_report` |
| none | `POST /webhooks/payments/razorpay/:tenantId` | raw body; header `X-Razorpay-Signature` → always 200 once the event is persisted (2xx even for a duplicate) | 401 bad signature (logged, event stored with `signatureValid=false`), 404 unknown tenant |

`BillView.tenders[]` gains `paymentIntentId: string | null` and
`riskAcknowledged: boolean`; `method` widens to the full `TenderMethod`.
The payments report row gains `rail`, `providerRef`, `reconciledAt` per tender.

## Flows

**Guest pays a share (Razorpay, UPI intent).**
1. Q6 → `POST …/shares/:guestId/intents { rail: 'upi_intent', app: 'gpay', clientKey }`.
2. Backend: assert session active, share outstanding, no active intent (partial unique index makes the race a 409, not a double order); `provider.createIntent` → Razorpay order; insert intent `pending` with `clientPayload.checkout`.
3. Q6 opens Razorpay Checkout with `orderId` (UPI apps pinned first via `config.display`), or - when `client.upiIntentUrl` is present - deep-links straight to the chosen app (`toAppUpiUrl`).
4. Guest pays in the app. Checkout returns `razorpay_payment_id` → `POST …/client-result` (provisional). Q6 polls `GET payment-intents/:id` on `nextIntentPollMs`.
5. Razorpay → webhook `payment.captured` → ledger insert → `confirmIntent` → Tender + share paid (+ bill complete when last). The poll sees `succeeded`; the bill's `GET` shows the share paid; other guests' screens catch up on their own 5 s bill poll.
6. Failure / expiry: share stays `outstanding`, nothing else changes (UJ-5). Q6 offers "Try again" (a fresh intent) or "Pay at counter".

**Cashier settles with a dynamic UPI QR.**
1. P5/P13 → tap "UPI QR" → amount defaults to the remaining figure → `POST pos/v1/bills/:id/intents { rail: 'upi_qr', amountMinor, clientKey }`.
2. Backend validates `amountMinor ≤ remaining` (total − existing tenders), creates the Razorpay single-use QR closed at `expiresAt`, returns `client.qrImageUrl`.
3. The screen shows the QR + a countdown; polls; the customer scans and pays.
4. `qr_code.credited` webhook → `confirmIntent` → Tender `upi_qr`. The next poll returns `succeeded`; the settle view re-reads the bill and the tender is now in `bill.tenders` (server-written, not a `PendingTender`).
5. Cashier adds any remaining cash, taps Finalise. `commitFinalize`'s existing sum check passes; the new gate refuses while any intent on the bill is `pending` (409 `payment_pending`).
6. Cancel closes the QR (`cancel`); expiry closes it too; an "expired but credited" webhook still records the tender (see lifecycle).

**Webhook, end to end.** raw body captured before JSON parsing → tenant config
by `:tenantId` → decrypt webhook secret → verify → insert `payment_events`
(unique `(provider, providerEventId)`; duplicate ⇒ 200, stop) → dispatch by
`event_type` → `confirmIntent` / `confirmRefund` inside one transaction with
`SET LOCAL app.tenant_id` → mark `processedAt` → 200. Processing errors are
stored on the event (`processingError`) and the event is retried by the
reconcile sweep; the response is still 200 so the provider stops redelivering.

**Refund.** Existing `refund()` keeps its manager gate and CreditNote write,
then: for each `allocation` → `payment_refunds` row (`manual` for cash,
`pending` for electronic) → `provider.refund(paymentRef, amount,
idempotencyKey = refund id)` → `refund.processed` / `refund.failed` webhook
closes it. A failed provider refund files a `refund_mismatch` exception and
leaves the credit note standing (the record of the decision is not the
movement of money).

**Reconciliation.** (a) Every 60 s (Nest `@Interval`, plus
`POST reconcile` on demand): intents `pending` past `expiresAt` → one last
`getStatus` → `succeeded` or `expired`; `expired` with a `clientResult` ⇒
`unconfirmed_intent`. (b) Daily per outlet: `settlementReport(range)` vs
local `succeeded` intents/tenders → `provider_captured_no_tender`,
`provider_status_conflict`, `refund_mismatch`; matched intents get
`reconciledAt`. (c) Owners work the queue in Reports ▸ Reconciliation;
`resolve` writes an `audit_events` row with the reason (AD-6).

## Web architecture (this repo)

State stays framework-free in `*-state.ts` modules with React state in the
views - this repo's established pattern (ADR-009: no Zustand). The five
modules that land with #177's first PR, and the screens that consume them
later:

| Module | Realm | Owns | Consumed by |
| --- | --- | --- | --- |
| `src/lib/payment-intent.ts` | shared (`src/lib` is the one cross-realm home, AD-4) | `PaymentIntentView`, status machine (`isTerminalIntentStatus`, `canRetryIntent`), poll cadence (`nextIntentPollMs`: 2 s for 30 s, then 5 s), monotonic merge (`mergeIntentPoll` never regresses a terminal status), countdown formatting | every realm's intent polling hook |
| `src/app/pos/orders/[orderId]/settle/electronic-tender-state.ts` | pos | which tender methods are electronic, captured-electronic sum from `bill.tenders`, remaining-to-tender, `canFinalizeWithElectronic` (no pending intent, exact cover), manual-UPI risk-ack validation (FR-52), intent amount validation | W4 settle + counter (`TenderKeypad` gains "UPI QR" and a risk-ack checkbox on "UPI (manual)") |
| `src/app/qr/checkout/payment-rail-state.ts` | guest | UPI-first option ordering per capability/provider, app deep-link rewriting (`toAppUpiUrl`), per-share pay phase, demo detection | W3 Q6 payment sheet (replaces the simulate buttons when the provider is real) |
| `src/app/admin/(shell)/settings/payment-settings-state.ts` | admin | draft/validation/payload for provider, mode, key id, write-only secrets; key-prefix-vs-mode rule; provider options per country | W2 Settings ▸ Payments tab (`settings-tabs.tsx` gains a fourth tab) |
| `src/app/admin/(shell)/reports/reconciliation-state.ts` | admin | exception rows, severity, totals by kind, resolution validation | W6 Reports ▸ Reconciliation |

Polling reuses the shape of `qr/status/use-status-poll.ts` (update in place,
stale flag, stop on terminal); the POS `upi_qr` screen draws nothing itself -
it shows the provider's `qrImageUrl`, and for the simulated provider a
"(demo)" placeholder, the same honesty posture as `PrinterStatusChip`.

Interactive elements to add, with `data-testid`s the Playwright stories (W7)
will target: `tender-method-upi_qr`, `intent-qr`, `intent-countdown`,
`intent-cancel`, `intent-status`, `tender-risk-ack`, `checkout-app-gpay` /
`-phonepe` / `-paytm` / `-other`, `checkout-pay-card`, `checkout-pay-counter`,
`checkout-intent-retry`, `payment-settings-provider`, `-mode`, `-key-id`,
`-key-secret`, `-webhook-secret`, `-save`, `-webhook-url-copy`,
`reconciliation-row-*`, `reconciliation-resolve`, `reconciliation-reason`.

## Security and compliance

- **Secrets**: AES-256-GCM with a per-region `PAYMENTS_ENCRYPTION_KEY` (32
  bytes, env only); ciphertext columns; decrypt inside the request that
  needs it; `hasKeySecret` / `hasWebhookSecret` booleans are all a client
  ever sees. Rotating the env key = re-encrypt migration script.
- **Webhook**: signature over the *raw* body (Nest `rawBody: true` for that
  route only), `crypto.timingSafeEqual`, tenant resolved from the path so a
  forged call against the wrong tenant fails its signature; 401s are
  stored (`signatureValid=false`) and rate-limited per tenant.
- **Amounts** are server-derived: a guest intent is always the share's
  amount; a POS intent is validated against the remaining total; the
  captured amount on confirmation is compared to the intent's.
- **Cardholder data**: none. Razorpay Checkout is hosted; the POS QR is an
  image; terminals (future) speak to their own acquirer.
- **RLS + audit**: every new table forced-RLS; settings changes and
  exception resolutions write `audit_events`; `payment_events` is the
  immutable provider ledger.
- **Residency**: config, intents, events live in the tenant's data plane;
  the webhook URL is the region's API host.
- **Least privilege**: the ops console reads `payment_provider_configs`
  (provider, mode, hasSecrets) through `operator_read` only - it never
  decrypts.

## Failure modes

| Failure | Outcome |
| --- | --- |
| Provider unreachable on create | intent `failed` with reason; client offers retry / other rail; nothing written to tenders |
| Webhook arrives before the intent row commits | can't happen - the intent is committed before the provider call returns its ref; a webhook for an unknown ref is stored with `processingError = unknown_ref` and retried by the sweep |
| Duplicate / replayed webhook | unique `(provider, providerEventId)` ⇒ 200 no-op |
| Webhook lost entirely | the client's poll triggers `getStatus`; failing that, the sweep's last look at expiry confirms or files `unconfirmed_intent` |
| Guest pays after the QR / order expired | provider capture still arrives ⇒ `expired → succeeded`, tender recorded; flagged only on amount mismatch |
| Two cashiers create a QR for the same bill | partial unique index ⇒ second gets 409 `intent_active` and sees the first QR |
| Overpayment (captured > intent) | tender for the captured amount + `amount_mismatch` exception; finalise then needs a change tender or refund - never silently dropped (PRD: quarantine, don't reject) |
| Finalise while a QR is pending | 409 `payment_pending`; cashier cancels the QR or waits |
| Refund call fails | `payment_refunds.failed` + `refund_mismatch` exception; credit note stands; owner retries from the queue |
| Secret misconfigured (`rzp_test_` key in `live`) | 400 at save time (`key_mode_mismatch`); a live-mode 401 from Razorpay marks the intent `failed` with `provider_auth` and files a `provider_status_conflict` |

## Testing strategy

- **Backend unit**: providers against an in-process HTTP stub (no network);
  signature verification vectors; `confirmIntent` transitions incl. the
  `expired → succeeded` case; allocation math.
- **Backend e2e** (existing harness): `payments-intents`, `payments-webhook`
  (duplicate, out-of-order, forged), `payments-refunds`, `payments-reconcile`;
  `rls.e2e-spec.ts` extended with the five tables; existing `pos-bills`,
  `guest-checkout`, `pos-refunds` suites keep passing on `SimulatedProvider`.
- **Web unit**: one `*.test.ts` per state module (this PR).
- **Web component**: settle / counter / Q6 / settings / reconciliation
  screens with mocked API (W2-W6).
- **Playwright** (W7): guest UPI happy path and UJ-5 failed share on
  `simulated`; POS QR settle; finalise blocked while pending.
- **Razorpay test mode**: one manual run per rail before `live` is offered,
  recorded in `wiki/testing-credentials.md`.

## Rollout and configuration

| Setting | Where | Default |
| --- | --- | --- |
| `PAYMENTS_ENCRYPTION_KEY` | backend env (per region) | required when any tenant's provider ≠ `simulated` |
| `PAYMENTS_WEBHOOK_BASE_URL` | backend env | the region's API host; used only to *display* the webhook URL |
| Provider / mode / keys | Tenant Admin ▸ Settings ▸ Payments | `simulated` / `test` |
| `online_payments` | Outlet capability (`OutletCapability.key`) | absent ⇒ off: only cash + manual UPI are offered; the QR surface shows "Pay at counter" |
| Intent TTLs | constants in `payments/` (5 min UPI, 15 min card) | promote to settings only if a tenant asks |

Phases: **P0** schema + provider interface + simulated provider (no UI
change) → **P1** guest UPI on Razorpay test mode → **P2** POS dynamic QR →
**P3** refunds → **P4** reconciliation + settings UI → **P5** Razorpay live
mode for the first pilot tenant → later epic: AU terminals (Linkly / Tyro,
native POS) and FR-53 surcharging.

## Open questions (decide before the phase that needs them)

1. Razorpay S2S UPI intent (`upi.intent_url` without Checkout) needs the
   feature enabled on the merchant account - P1 ships with hosted Checkout,
   `upiIntentUrl` is opportunistic.
2. Cash refunds today do not reduce a shift's expected cash
   (`computeCashSalesMinor` sums cash tenders only) - P3 should add a
   `refund` `CashMovementType` or subtract `manual` refunds; logged in
   [docs/KNOWN_ISSUES.md](../../docs/KNOWN_ISSUES.md).
3. Per-outlet vs per-tenant provider config: per tenant for v1 (one legal
   entity, one Razorpay account); revisit when a group wants per-outlet
   settlement accounts.
4. Whether the ops console should be able to *disable* a tenant's live mode
   (fraud / arrears) - leaning yes, as a `TenantCapability`.

## Key decisions

See [docs/DECISIONS.md](../../docs/DECISIONS.md) ADR-001 to ADR-012: intent
before tender (001), reconciliation before settled (002), Razorpay for
India v1 with no SDK (003), simulated provider as a first-class rail (004),
webhook ledger idempotency (005), encrypted per-tenant secrets (006),
capability gate `online_payments` (007), POS dynamic QR over terminal (008),
no Zustand (009), polling not push (010), expired-then-captured still
records the tender (011), refund allocation is explicit (012).
