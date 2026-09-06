# Platform Console (internal ops) - web

The cross-tenant operator surface at `/ops` (separate `ops` JWT auth realm -
see [testing-credentials.md](../testing-credentials.md#1-platform-console-internal-ops--ops)
for the demo login). Every mutation on this surface goes through the reusable
confirm-modal-with-required-reason (`ConfirmReasonDialog`) so the reason lands
in the audit trail.

## Capabilities

- **O2** Dashboard - KPI tiles that load, fail and retry independently.
- **O3** Tenant directory - server-side sort/filter/pagination DataTable.
- **CAP-2 / O4** Tenant onboarding wizard.
- **O5** Tenant detail - tab-bar page (overview, outlets, devices,
  subscription, capabilities, branding, owners) plus lifecycle actions
  (activate/deactivate/reactivate/delete).
- **CAP-4** Device fleet - fleet-wide and tenant-scoped views.
- **CAP-5 / O7** Subscription operations - plan/invoices/arrears, suspend/
  reactivate.
- **CAP-6 / O8** Sync health monitor - severity-sorted fleet table.
- **CAP-7 / O9** Dead-letter queue - filterable browse of permanently-
  rejected ops with replay.

## What's built

- `src/app/ops/(shell)/tenants/tenants-table.tsx` - O3 directory, filterable
  by status (`provisioning` / `active` / `inactive`), country, plan, health.
- `src/app/ops/(shell)/tenants/[id]/detail.tsx` - O5 detail page.
- `src/app/ops/(shell)/confirm-reason-dialog.tsx` - the shared confirm-with-
  reason modal every mutation on this surface uses.

### Tenant lifecycle actions (issue #146)

The tenant status enum is `provisioning | active | inactive`, plus a soft
delete (`deletedAt` set, hidden from the directory). Detail-page actions,
each behind the reason dialog and calling `restiq-backend`'s `ops/v1/tenants/
:id/*` routes:

| Status shown | Action available | Route |
|---|---|---|
| `provisioning` | Activate tenant | `POST /activate` |
| `active` | Deactivate | `POST /deactivate` |
| `inactive` | Reactivate | `POST /reactivate` |
| any (non-deleted) | Delete tenant | `DELETE /:id` (soft delete) |

Delete additionally requires an "I understand this is permanent" checkbox
(`ConfirmReasonDialog`'s optional `confirmCheckboxLabel`) before the submit
button enables - a plain reason is not enough for an irreversible action. On
success the console navigates back to `/ops/tenants` since the tenant no
longer belongs on its own detail page. A `409 tenant_has_open_activity` (open
orders/bills) or `invalid_transition` from the backend surfaces as an error
toast with the backend's own message; the page and dialog state are left as
they were so the operator can read the reason and retry or cancel.

## Integration points for later stories

- `ConfirmReasonDialog`'s `confirmCheckboxLabel` prop is reusable for any
  future irreversible action that shouldn't rely on the reason field alone.

## Key decisions

- Deactivate/reactivate/delete share one `lifecycleAction` union + one dialog
  instance in `detail.tsx` (mirrors `subscription-tab.tsx`'s
  suspend/reactivate `confirmKind` pattern) rather than one dialog per
  action, so there is exactly one place that renders the confirm modal.
