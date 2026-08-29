# restiq-web wiki

Living documentation for this repo. Update the relevant feature doc and move
the task entry to `tasks/completed.md` after every feature or bug fix.

## Features

- [Tenant Admin (Owner Web Console) - web](features/tenant-admin.md) -
  CAP-1 owner invite & account setup, CAP-2 go-live checklist, CAP-3 menu
  import, CAP-4 menu management, CAP-5 floor plan & stations, CAP-6 devices
  & printers, CAP-10 branding & capabilities.
- [POS Cashier & Waiter (Web Prototype) - web](features/pos-cashier-waiter.md) -
  CAP-1 PIN login and shift clock, CAP-2 table map and order ownership/transfer,
  CAP-10 shift & cash management (open shift with float, cash movement log,
  blind-count close with server-side-blind expected/over-short reveal).
- [QR Self-Order (Guest Mobile Web) - web](features/qr-self-order.md) -
  CAP-1 QR entry and table session (welcome + session PIN, start/join, the
  fifth `guest` auth realm, qr_ordering capability gate).
- [Kitchen Display (KDS) - web](features/kitchen-display.md) - CAP-2 `/kds`
  shell (reuses the pos auth realm), station picker, and the K1 station
  queue (oldest-left ticket columns, client-computed ageing colors, ADD-ON
  separation, struck-through void lines, bump/recall/refire).

## Tasks

- [Completed](tasks/completed.md)
- [In progress](tasks/in-progress.md)
- [Planned](tasks/planned.md)
