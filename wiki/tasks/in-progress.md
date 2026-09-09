# In progress

## 2026-09-09 - Payments day 1 (IST)

Goal for the day: the payments foundation merged in both repos - the
architecture and client state (web W1), the schema + provider abstraction +
intent lifecycle (backend B1-B3), and if the day holds, the guest intent
endpoints (B4) so tomorrow starts on the webhook. Stop rules at the bottom.

| Time (IST) | Block | Deliverable | Status |
| --- | --- | --- | --- |
| 04:15-05:15 | Discovery | Money path read end to end (`bill-core`, `guest/bills`, settle/counter/Q6 UI, payments report), PRD §4.7 + addendum, spine AD-14/15/17/18, existing issues | done |
| 05:15-06:00 | Plan | Epics #177 / restiq-backend#129 logged; branch `feature/177-payments-architecture`; `wiki/features/payments.md`; ADR-001..012; this plan | done |
| 06:00-07:00 | W1 code | `src/lib/payment-intent.ts`, `electronic-tender-state.ts`, `payment-rail-state.ts`, `payment-settings-state.ts`, `reconciliation-state.ts` + tests; lint/typecheck; push; PR | in progress |
| 07:00-07:30 | Gate | CI on the W1 PR; fix anything red; publish the plan page | |
| 07:30-09:30 | B1 | Backend branch `feature/129-payments-schema` off `origin/main`: Prisma models, migration SQL (CHECK, partial unique, RLS), `rls.e2e-spec.ts` extended; PR | |
| 09:30-11:30 | B2 | `src/payments/providers/{provider,simulated,razorpay}.ts`, HMAC verify, unit tests on an HTTP stub | |
| 11:30-12:00 | Break | | |
| 12:00-14:00 | B3 | `intents.service.ts`: create / get / cancel / `confirmIntent` / sweep; e2e `payments-intents` | |
| 14:00-15:30 | B4 | Guest intent endpoints; `simulate` endpoint; `guest-checkout.e2e-spec.ts` rewritten on intents with UJ-5 intact | |
| 15:30-16:00 | Break | | |
| 16:00-17:30 | B5 (stretch) | POS `upi_qr` intents, finalise `payment_pending` gate, `risk_ack_required` | |
| 17:30-18:00 | Wrap | `wiki/tasks/completed.md` entries, PR CI status, tomorrow's plan (B6 webhook, B8 settings, W2, W3) | |

Working rules for the day: one PR per story, each against `origin/main`
(never local `main` - it belongs to the other session); tests with Node 22
(`export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"`); run only the
new spec locally, CI is the gate; every web contract header names the
backend file it was reconciled against.

Stop rules: if B2's Razorpay client is not green by 11:30, ship B2 with
`SimulatedProvider` only and move Razorpay to tomorrow (B3/B4 do not need
it). If B4 slips past 15:30, skip B5 and finish B4 - the guest path is the
one UJ-5 depends on.
