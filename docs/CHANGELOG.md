# Changelog - restiq-web

Format per `coding-standards/conventions/issue-workflow.md`. Earlier work is
logged, per feature and date, in `wiki/tasks/completed.md`; this file starts
with the payments epic.

## [Unreleased]

### Added
- Payments architecture, decision records, and task plan (#177):
  `wiki/features/payments.md`, `docs/DECISIONS.md` ADR-001..012,
  `wiki/tasks/planned.md`.
- Payment client state modules with unit tests (#177, W1):
  `src/lib/payment-intent.ts` (shared intent status machine and poll
  cadence), `pos/…/settle/electronic-tender-state.ts`,
  `qr/checkout/payment-rail-state.ts`,
  `admin/(shell)/settings/payment-settings-state.ts`,
  `admin/(shell)/reports/reconciliation-state.ts`.
- `docs/` tracking files (`CHANGELOG.md`, `KNOWN_ISSUES.md`, `DECISIONS.md`)
  per workspace standards.
