# Changelog - restiq-web

Format per `coding-standards/conventions/issue-workflow.md`. Earlier work is
logged, per feature and date, in `wiki/tasks/completed.md`; this file starts
with the payments epic.

## [Unreleased]

### Fixed
- POS table map header on a phone (#206): the actions wrap onto their own
  row, button labels stay on one line, and Refresh is no longer pushed
  off-screen.

### Changed
- The simulated card terminal is drawn as the physical device (#198): body,
  brand bar with a status LED, inset screen, and reader hardware along the
  bottom edge. It opens on a UPI / Cards / Wallets / EMI method screen; only
  Cards continues, since `card_terminal` is the only rail the backend mints
  intents for. Cancel steps back one screen at a time and declines only from
  the first screen.
- The simulated card terminal now walks a real reader's card flow (#196):
  present card (Tap / Insert / Swipe), masked 4-digit PIN entry, a
  processing hold, then an Approved / Declined result screen. A contactless
  tap under the floor limit (₹5,000 / A$200) skips the PIN. The bank's
  answer is a Simulator strip; only the final outcome reaches the server.

### Added
- Devices: enrolled kiosks get "Open kiosk" and a scan QR in the admin
  devices table (#214). The link opens `/qr/kiosk/[outletId]?device=`; the
  attract screen is always drawn as a kiosk, and a successful start stores
  the kiosk in the tab so the menu, cart and status stay in kiosk mode.
- Kiosk: simulated kiosk screen and ordering from the kiosk (#214, web half
  of restiq-backend#138). An enrolled kiosk tab's "Continue" (and the
  landing page) opens `/qr/kiosk/[outletId]`: "Tap to start your order"
  starts a device-bound, table-less guest session and lands on the
  existing menu / cart flow. Placing shows the token number with "Pay at
  the counter"; the status page shows it too and hides Request bill. A
  "Start over" bar and a 90 s idle timeout end the session and return to
  the attract screen. On a kiosk tab every screen is drawn inside a standing
  kiosk (bezel, portrait screen, printer / card / scanner panel, pedestal),
  and the attract screen is a full-screen tap-to-start poster.
- Device topology (#210, web half of restiq-backend#134 / #136): the owner
  Devices page opens with a **Topology** map - each POS with the printer and
  card terminal linked to it, devices shared by the whole outlet, and other
  devices - each with an online / offline / never-connected dot that
  refreshes every 30 s. A printer or card terminal's **Linked to** control
  links it to one POS: that POS's receipts and card payments then go only
  there. POS, printer and terminal tabs now send their own device id with
  print jobs and card payments, poll only their own queue when linked, and
  report a heartbeat every 30 s.
- Staff **Reset PIN** (#204): staff with an active PIN get a Reset PIN
  button that issues a new PIN and shows it once in the PIN chip. An
  existing PIN can't be displayed - PINs are stored hashed - so resetting is
  how an owner gets a PIN they can see. The old PIN stops working at once.
- Scan-to-enrol QR (#200): the owner **Enrol device** code chip shows a QR
  of `/device?code=XXX-XXX`; scanning it opens enrolment with the code
  prefilled. After enrolling, POS / printer / terminal devices continue to a
  PIN pad bound to their own tenant (`?device=&tenant=`, as in #150). The QR
  carries the console's own origin, so open the console on an address the
  device can reach (LAN IP or tunnel), not `localhost`.
- Scan QR for enrolled devices (#202): each Devices row with an **Open …**
  link gains a QR button that shows that link as a QR, so a phone or tablet
  scans straight into the device's screen. Also fixed: the enrol URL no
  longer stretches the Enrol drawer past the screen edge (it wraps).
- Agreements with versioning and owner digital signature (#192, web half of
  restiq-backend#133): `/ops/agreements` publishes versions through the
  reason dialog, Tenant Detail gains an **Agreements** tab (signed / pending
  badge and signature record), and owners sign in Settings → Agreement with a
  typed name; the evidence is the typed name plus a content hash. Left out on
  purpose: pending-agreement banner, go-live gate, platform countersign, PDF
  export, third-party e-sign.
- Simulated card terminal (#188): `terminal` device type, `/pos/terminal`
  (Approve / Decline a pending request), and a **Card terminal** tender on
  settle and counter whose tender is written by the terminal's approval
  (restiq-backend#130's payment intents).
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
