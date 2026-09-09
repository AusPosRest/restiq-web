# Known Issues - restiq-web

Format per `coding-standards/conventions/issue-workflow.md`. Cross-repo
gaps are listed here when the web surface is where a user meets them.

## Active Issues

### [#177] No real payment rails - every electronic payment is simulated or manual
- **Severity:** High (product gap, not a defect - the demo is honest about it)
- **Symptom:** POS tenders are Cash and a manual "UPI" the cashier marks
  received; Q6 checkout resolves through a demo-marked "Simulate success /
  failure" sheet. No provider is called, nothing is verified, nothing
  reconciles.
- **Workaround:** Staff verify UPI on their own soundbox / banking app before
  tapping "Add UPI tender" (the FR-52 merchant-verification posture, minus
  the risk-acknowledgement dialog that ships with W4).
- **Status:** Architecture and plan merged (`wiki/features/payments.md`);
  build in progress - web epic #177, backend epic restiq-backend#129.

### [#173] Owner console: React hydration mismatch on load
- **Severity:** Medium
- **Workaround:** Reload; the second render is consistent.
- **Status:** Open, unassigned.

### [#119] Vercel deploy of `main` failing since #116; the required `check` job passes
- **Severity:** Medium (CI is the merge gate; Vercel previews inherit the failure)
- **Workaround:** Run locally with `pnpm dev`.
- **Status:** Open.

### Cash refunds do not reduce a shift's expected cash (backend)
- **Severity:** Medium
- **Symptom:** `computeCashSalesMinor` (`restiq-backend/src/pos/shifts/shifts.service.ts`)
  sums cash tenders on finalised bills; a credit note refunded in cash is not
  subtracted, so the blind-count over/short is wrong by the refund.
- **Workaround:** Log the cash handed back as a `paid_out` movement with the
  credit note id as the reason.
- **Status:** Surfaced by the payments design (ADR-012); to be fixed in
  backend B7 alongside `payment_refunds` (`manual` refunds feed the till math).

### `upi_manual` tenders carry no risk acknowledgement yet
- **Severity:** Low until real rails ship
- **Symptom:** FR-52 requires an explicit risk acknowledgement for
  merchant-verified UPI; the current button records the tender outright.
- **Status:** `tenders.risk_acknowledged` + 400 `risk_ack_required` land in
  backend B5; the checkbox in web W4 (`validateManualUpiTender` already
  exists in `electronic-tender-state.ts`).
