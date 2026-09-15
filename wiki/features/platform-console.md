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

### GST applicable + rate (issue #148)

The O4 wizard's Tax & Compliance step (`steps.tsx#TaxStep`) gained a `GST
applicable` toggle (`onb-gst-applicable`, the same `ToggleField` composition
scheme already used) placed above the Tax profile fields. Turning it off
hides both the `GST rate %` number input (`onb-gst-rate`, 0-100, 0.5 step)
and the India-only Composition scheme toggle - there is no rate to seed and
nothing to enable a scheme against. Switching country resets the rate to that
country's default (`DEFAULT_GST_RATE`: 5% for IN, 10% for AU), same as the
existing tax-profile/registration-number reset. `validateTax` requires a
numeric 0-100 rate only when applicable; `toSubmitPayload` sends
`tax.gstRegistered` always, and `tax.gstRatePercent` (as a `number`) only when
applicable - matching `restiq-backend`'s wizard submit contract.

O5 Tenant Detail's Overview tab (`tabs.tsx#OverviewTab`) gained a fifth stat
card, `overview-gst`, reading the first `taxRegistrations` entry: "Applicable
· `<rate>`%" when `gstRegistered` is true and a rate is set, "Applicable" when
registered with no rate on file, otherwise "Not applicable". Same shape as the
owner console's tax registration editor - see
[Tenant Admin's Tax Registration section](tenant-admin.md#settings--tax-registration-issue-140)
for the `gstRatePercent` GET/PUT field this reads from.

### Agreements (issues #192, #238; restiq-backend#133, #150)

`/ops/agreements` (`src/app/ops/(shell)/agreements/agreements-index.tsx`,
nav item `ops-nav-agreements`): the platform's agreement versions newest
first (version, title, publisher, published-at, signature count; the newest
row carries a "current" marker), each row expanding (`agreement-expand-N`)
to lazily load `GET ops/v1/agreements/:id` and show the text formatted by
`src/components/agreement-document.tsx`. Above the table, a publish form
(`agreement-title`, `agreement-body`, `agreement-publish` - disabled until
both are non-blank) whose submit opens `ConfirmReasonDialog`; the reason
travels in the `POST ops/v1/agreements` body with title and text and lands
in the control-plane audit trail. **Load standard agreement**
(`agreement-load-template`) fills the form with `STANDARD_AGREEMENT`
(`agreements/standard-agreement.ts`): the Restiq Platform Services
Agreement - 12 numbered clauses plus Schedule A (Australia: Privacy Act
1988, GST Act, ACL, Electronic Transactions Act) and Schedule B (India: DPDP
Act 2023, CGST Act, IT Act s10A, arbitration) - with `{{customer.*}}` fields
the backend fills per business and [bracketed] Restiq entity details ops
completes before publishing. It asks before replacing text already in the
form. It is a drafting template, not legal advice: have it reviewed by a
lawyer in each country before the first publish. Help text under the body
explains the markup and the fields. On success the form clears, the list
refetches, and a toast names the new version; on failure the dialog and
form stay so the operator can read the backend's message. There is
deliberately no edit or delete - a published version is immutable and stays
signable-history forever.

O5 Tenant Detail gains an eighth tab, **Agreements**
(`tenants/[id]/agreements-tab.tsx`, `tenant-tab-agreements`), reading
`GET ops/v1/tenants/:id/agreements`: a `StatusBadge` for `signed` /
`awaiting_countersign` / `pending` / `no_agreement` against the current
version (`agreement-status`, `agreement-current`) and a read-only signature
table (`agreement-signature-N`: version, signer name, title and email,
signed-at, the first 12 characters of the SHA-256 evidence hash with the
full hash in the `title`, and **Download** (`agreement-pdf-N`,
`/ops/api/tenants/:id/agreements/:versionId/pdf`) when a sealed PDF exists).
The ops proxy passes non-JSON responses through as bytes, like the admin
proxy. Only the owner signs for their business, from their own console;
Restiq's countersignature happens in DocuSign by email.

## Integration points for later stories

- `ConfirmReasonDialog`'s `confirmCheckboxLabel` prop is reusable for any
  future irreversible action that shouldn't rely on the reason field alone.

## Key decisions

- Deactivate/reactivate/delete share one `lifecycleAction` union + one dialog
  instance in `detail.tsx` (mirrors `subscription-tab.tsx`'s
  suspend/reactivate `confirmKind` pattern) rather than one dialog per
  action, so there is exactly one place that renders the confirm modal.
