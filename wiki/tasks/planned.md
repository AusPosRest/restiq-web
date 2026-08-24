# Planned

Tenant Admin web stories 2-9 (menu import review, menu management, branding,
floor plan, tenant-scoped devices, staff & roles, owner dashboard, reports)
per `restiq-design/docs/specs/spec-tenant-admin/stories.yaml`. Each will wire
one of `/admin/onboarding`'s placeholder deep-links to a real screen and call
`PATCH /admin/api/checklist/:step` from its own write path once the feature
behind that step is real (see `wiki/features/tenant-admin.md`).
