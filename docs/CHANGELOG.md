# Changelog - restiq-web

Format per `coding-standards/conventions/issue-workflow.md`. Earlier work is
logged, per feature and date, in `wiki/tasks/completed.md`; this file starts
with the payments epic.

## [Unreleased]

### Fixed (Binflow first-run walkthrough, 2026-10-08)
- **POS money** (#306):
  - Cash above the total now gives change: the screen shows "Change due ₹43.70", Finalise works, and the cash is posted net of change so the bill sums exactly.
  - The payment keypad takes whole rupees/dollars (1100 is ₹1100, not ₹11). Exact remaining still covers paise and cents.
  - The bill lists CGST and SGST (or GST) lines instead of one Tax line.
  - A counter sale's Charge sends its lines to the kitchen before finalising, so counter orders reach the kitchen screen.
  - A paid order is read-only: no quantity or remove buttons, and its button reads "View bill".
- **Tills, kitchen screens and device pages** (#308, with restiq-backend#187):
  - A kitchen screen signs in after enrolling. Continue goes through the PIN pad bound to its restaurant, not to a page that said "set POS_TENANT_ID".
  - An enrolled till signs in to its own outlet without the outlet chooser, and shows the restaurant's name instead of an id. The device card shows the outlet name.
  - The mocked "Online" / "Printer Ready" pills and the made-up "App Version v2.4.1" are gone.
  - A wrong PIN says "Wrong PIN. Try again."
  - Opening a new code on a device that's already set up says it wasn't used.
  - Un-enrol sits behind "Set this device up as something else".

### Added
- **Restaurant addresses** (#302, web half of restiq-backend#183). Each restaurant lives at its own subdomain. The sign-in pages name the restaurant at its address, POS sign-in finds the restaurant from the address when no terminal binding or POS_TENANT_ID is set, and the new-tenant wizard has a Subdomain field that checks the name is free. Our server forwards the address to the API, which refuses a session from another restaurant.
- **Owner password reset** (#300, web half of restiq-backend#181). "Forgot your password?" on the owner sign-in sends a reset link by email; the link opens a page to choose a new password, and the owner signs in again (every older session is ended).
- **Set up an outlet from its type** (D2). An outlet with no stations shows a "Set up for my outlet type" button on the floor-plan page that creates the stations, tables and switches for a dine-in restaurant, counter, cloud kitchen or food-court stall. Every station row can now be removed (with a confirm step); everything the setup makes can be edited or removed.
- **Combo menu** (#264, web half of restiq-backend#160). A combo is one price for a set of **slots**: "pick 1 main from these", "pick 2 breads", or a fixed item that's always included. Any option can carry an extra charge (+₹30 for a lassi).
  - **Owner console:** Menu gets a **Combos** tab next to Items. It lists every combo (what's in it, category, on sale or off, price) with a search box over the list that matches a combo's name, a slot's name or any item inside it; the editor sets the name, price, category and slots, and can delete a combo. The old combo form inside the item drawer is gone.
  - **POS order and counter screens:** combos show as "Combo" tiles in their category with what they save. Tapping one opens a picker where fixed items show as included, each choice is a tap, and a chosen item's modifiers (spice, extra butter) show inline. Add stays disabled until every slot is filled. The order panel, bill and invoice show the combo as one line with its items listed underneath; a combo can be removed but not stepped.
  - **QR ordering and kiosk:** the same combo cards and picker in the guest menu, added to the shared cart; the cart lists the combo's items.
  - **Kitchen display:** each item goes to its own station tagged with its combo's name, on the station and expo screens.
### Changed
- **Home page is now a marketing landing page** (#262): what RESTIQ is, the five surfaces (tablet POS, kitchen display, QR ordering, kiosk, owner console), offline-first operation, payments, the four go-live steps and an FAQ, with calls to action into the live demo. The demo portal that used to be the home page (sign-in doors, demo logins, live devices) moved unchanged to **/demo** and is linked from the nav, hero, final call to action and footer. The install-app banner no longer shows on the marketing page.
- `/.well-known/assetlinks.json` (#260): Digital Asset Links for the Android app (`com.restiq.app`, repo restiq-android), so Chrome runs the Trusted Web Activity full-screen. Lists the debug signing fingerprint; add the release / Play App Signing fingerprint when that key exists.
- Pagination on long lists (#255): the owner Menu, Staff and Devices tables and the ops Sync Health and Subscriptions tables now show 20 rows per page with a "1–20 of 32" range and Prev / Next. The pager is hidden when everything fits on one page; changing a search or filter returns to page 1. Lists that already page through the backend cursor (ops Tenants / Devices / DLQ, owner Reports ▸ Payments) are unchanged.
- POS payment history (#253, backend restiq-backend#158): a **Payments** link in the POS top bar opens `/pos/payments`, listing every payment taken at the outlet today (outlet-local day) newest first - time, bill number with table or token, method, amount, reference, who took it - with per-method totals on top and a Refresh button.
- Product directory (#245, backend restiq-backend#153):
  - **Ops console ▸ Catalog** (`/ops/catalog`): operators curate a platform-wide list of products (name, short name, Hindi name, veg marker, photo URL, category, suggested price, market, tags) with search, tag chips and a market filter. Deletes go through the reason dialog and land in the control-plane audit trail.
  - **Owner console ▸ Menu ▸ Browse directory**: a dialog that searches the directory (scoped to the tenant's market), filters by tag, and imports the ticked products as copies into the tenant's own menu. Imported items are ordinary menu items from then on; nothing links back to the directory.
- Windows POS app support (#292): inside the RESTIQ Windows app (AusPosRest/restiq-desktop), invoice **Print** prints silently on the device's receipt printer, and finalising a bill with a cash tender opens the cash drawer (counter and table settle). Browsers are unchanged. Bridge: `src/lib/desktop.ts`.
- Simulator (#294): `/simulator` infinite pan/zoom canvas of draggable, resizable device frames (POS, KDS, kiosk, printer, card terminal, guest QR, owner, ops, custom same-origin path); each frame is its own tab-scoped device. Layout persists in localStorage.

### Fixed
- Web half of the POS security fixes (#290; restiq-backend#169/#170/#171):
  - **Sign-in throttling sees the real browser.** POS, owner and operator sign-in routes pass the browser's address to the API (`X-Restiq-Client-Ip`), signed with the server-only `PROXY_SHARED_SECRET`. The POS PIN login also sends the tab's enrolled device, so a till gets its own wrong-PIN allowance.
  - **The PIN pad counts down to the API's real lockout end** (`retryAfterSeconds`, up to 15 minutes, shown as m:ss) instead of a fixed 30 seconds.
  - **POS/KDS Sign out ends the session at the API**, so a copied token stops working. It is best effort; the cookies are cleared either way.
  - **The owner's permission matrix** shows each role's permissions as the API enforces them, falling back to the static table on an older API.
- **KDS ticket clocks read in h/m/s** (#285): an old ticket showed `11148:58`. Now under a minute is `45s`, under an hour `12m 05s`, and beyond that `3h 42m` - on the station cards, expo, the waiting-on panel and the bumped "took" line.
- **Owner Menu shows one price per item** (#272): RESTIQ has no delivery, so the Delivery column, the drawer's "Dine-in ₹149 / Delivery ₹149" line and the Delivery field in Change price are gone. Each item and variant has a single **Price** (the dine-in price the POS charges).
- **POS counter no longer flashes after every tap** (#269): adding an item, changing a quantity, removing a line or adding a tender used to swap the whole counter for the loading skeleton while the bill refreshed. The bill now refreshes in place; only the first load or a retry shows the skeleton.
- Owner console sidebar and Menu scrolling (#266):
  - **Sidebar** is sticky and full height on every owner page, so the nav and Sign out never scroll away.
  - **Menu item table** scrolls inside a viewport-high panel (min 20rem) with a sticky column header, so the category list stays beside it. Unchanged below `md`.
  - **Item drawer** pins its header and its Delete / Save Changes footer and scrolls only the form, with an always-visible scrollbar (the new `.scrollbar-visible` utility in `src/app/globals.css`), matching the combo editor.
- Floor plan: dropping a table on another no longer snaps it back with
  stacked "overlaps another table" toasts (#258). It stays red while it
  overlaps, and on release it settles in the nearest free spot beside the
  table it landed on. Arrow-key nudges behave the same way.
- Menu items can be deleted (#248). The item drawer has a **Delete**
  button with a confirmation step. The item disappears from the Menu list,
  POS, QR and kiosk; past bills keep it (the backend archives the row), and
  its name can be reused for a new item.
- Menu import commit names the items that clash (#247). It used to fail
  with "duplicate item names within a category" even when the clash was
  with an item already on the menu, and never said which one. Now the
  error lists them ("Already on your menu: Paneer Tikka (Starters)"), the
  rows are highlighted, and each review row has a Remove button so you
  can drop them and commit the rest.
- Menu import no longer invents items from photos and PDFs (#246). The
  backend has no photo/PDF reader yet and used to return the same 3 sample
  items for every file. The dropzone now takes CSV or XLSX only and says
  why, and the backend refuses photos and PDFs with a clear message.
- Owner Menu **Import** (#239) opens as a dialog over the menu instead of a
  separate full-page screen. You can download the sample, upload, review and
  commit without leaving the page. After you commit, the dialog closes, the
  list reloads with the new items, and a toast confirms how many were added.
  `/admin/menu/import` stays for the setup checklist. Its success screen now
  says **Back to setup** only when you came from the checklist; otherwise it
  says **Go to your menu**, so an owner whose setup is done is no longer sent
  back to setup.
- **Print bill** on settle and counter (#224) sends the bill straight to the
  POS's printer (linked, else the outlet's shared one) and says "Sent to
  printer" / "Couldn't print". It used to open the invoice page in a new tab,
  which in an installed app lands in the browser, signed out, so nothing
  printed. The invoice page keeps its own Send to printer / Print buttons.
- POS text overflow (#240):
  - **Payment method buttons** (settle and counter) now fit as many as the column holds - two per row in the counter's narrow tender column - so "Card terminal" / "External" no longer spill past their buttons.
  - **Bill panel lines** get column padding and keep the amount on one line, so a long item name ("Soup of the Day") wraps instead of running into its price.
- Phones and tablets (#228, #229):
  - **Owner console and Platform Console:** below `md` the sidebar hides and a ☰ button in the top bar opens the same nav, plus sign-out, as a drawer. Page padding shrinks on small screens, and the new-tenant wizard's step list stacks above the form.
  - **Owner Menu page:** the category list stacks above the item table below `md`, the search box goes full width on phones, and the title row wraps.
  - **POS invoice:** the item table scrolls sideways on a narrow phone instead of widening the page.
  - **POS order and counter screens:** below `lg` the categories become a horizontally scrolling row, and the menu, bill and tender column stack full width in one scrolling column.
  - **POS settle and refund:** the bill stacks above the keypad or refund panel below `md`.
  - **POS shell:** padding shrinks on small screens.
- KDS on phones and tablets (#232): below `md` the expo screen's
  Waiting-on panel stacks under the expo rail instead of squeezing it to
  ~90 px, and the header's station / expo / all-day / bumped tabs wrap.
  Station and bumped ticket lanes already scrolled sideways.
- Menu list availability (#234): the "86'd" column (kitchen slang for out of
  stock) is now **Available**. The switch is on while the item is on sale and
  off when sold out; it used to read the other way round. The row badge and the
  POS item tile say "Sold out" instead of "86'd".
- POS table map header on a phone (#206): the actions wrap onto their own
  row, button labels stay on one line, and Refresh is no longer pushed
  off-screen.

### Changed
- The owner Floor Plan canvas is infinite per floor (#237). It fills the
  page width and grows past the farthest table, so tables can be dragged
  anywhere right or down (the canvas scrolls along at the edge). Pan by
  dragging empty space or scrolling; zoom with −, %, + and Fit, or
  Ctrl/⌘ + scroll. Each floor keeps its own pan and zoom.
- The settle screen's **Bill finalised** panel no longer shows Back to table
  map, Refund… or Print invoice (#226); it's just the confirmation. Refund
  has no other entry point until one is added.
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
- **External** payment method on settle and counter (#224, web half of
  restiq-backend#146): money taken outside RESTIQ (standalone EFTPOS,
  delivery app, bank transfer) is added with its **Reference / bill no.**,
  required before the tender can be added. The reference shows on the
  tender list and on the invoice's payments.
- Installable app on Android and iOS (#222): a web app manifest (standalone,
  dark theme colour, 192 / 512 / maskable icons) and an apple-touch-icon,
  both drawn by `next/og` so the repo holds no PNGs. A bottom banner offers
  **Install** on Android / Chrome (the browser's own install dialog) and the
  **Share → Add to Home Screen** steps on iPhone / iPad; it hides inside the
  installed app, on guest `/qr` pages, and once dismissed. No service worker:
  installing doesn't need one and POS data must never be served stale.
- Owner Devices: **Devices** / **Topology** tabs (#212) - the device table,
  enrolment code and printer config on one tab, the topology map on the
  other; switching is instant and keeps an active enrolment code.
- Kiosk: pay here by card, then print the receipt (#220, web half of
  restiq-backend#144). The kiosk's "Sent to the kitchen" screen offers "Pay
  here by card" next to paying at the counter: it raises the order's bill,
  asks for a card tap on the kiosk's reader (the bank's answer is a demo
  Approve/Decline control), pays it through the guest pay-all as a
  `card_terminal` tender, and then "Print receipt" feeds a thermal receipt
  (with the token number) out of the kiosk's RECEIPT slot.
- Menu: item photos and one-tap add (#218, web half of restiq-backend#142).
  The guest menu shows each item's photo (letter tile when none) and a "+"
  that adds an item with nothing to choose straight to the cart; items with
  variants or a required choice open their detail. Kiosk tabs get a real
  kiosk menu: a vertical category rail beside a grid of large photo tiles.
  Owners upload a photo from the admin item drawer (resized in the browser
  to a 480 px JPEG and stored inline), replace it, or remove it.
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
