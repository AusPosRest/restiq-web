# Planned

Tenant Admin web stories 8-9 (owner dashboard, reports)
per `restiq-design/docs/specs/spec-tenant-admin/stories.yaml`. Each will wire
one of `/admin/onboarding`'s placeholder deep-links to a real screen.

CAP-7's staff/roles API contract (`src/app/admin/api.ts`, `staff-state.ts`)
was built provisionally, with no backend to read against
(restiq-backend#38 not yet started) - reconciling it against the real DTOs
once that backend lands is required follow-up, not optional (see
`wiki/features/tenant-admin.md`'s CAP-7 Key decisions entry).
