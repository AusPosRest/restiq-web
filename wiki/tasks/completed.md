# Completed

- **2026-08-24** - Tenant Admin story 1: owner invite acceptance (CAP-1) and
  go-live checklist UI (CAP-2). `/admin/invite/[token]`, `/admin/onboarding`,
  new `/admin` auth realm in `src/proxy.ts` (AD-10, `aud:"admin"`,
  `admin_session` cookie), `/admin/api/[...path]` pass-through. See
  [wiki/features/tenant-admin.md](../features/tenant-admin.md). Issue
  AusPosRest/restiq-web#18.
