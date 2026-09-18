// Public marketing landing page (issue #262). The demo portal that used to
// live here (sign-in doors, demo logins, live devices) is now /demo.
// Static on purpose: no API calls, so it renders even when the backend is down.
import type { Metadata } from "next";
import Link from "next/link";
import { body, display, mono } from "./landing-fonts";

export const metadata: Metadata = {
  title: "RESTIQ - the restaurant POS that keeps cooking offline",
  description:
    "Tables, counter, kitchen screens, QR ordering and self-order kiosks on one restaurant platform, built to keep running when the internet drops. For India and Australia.",
};

// Palette: paper and ink, stainless steel, the brand amber, the kitchen at night.
const PALETTE = {
  "--ink": "#17140f",
  "--ink-soft": "#5b5650",
  "--paper": "#fafaf9",
  "--line": "#e2dfdb",
  "--amber": "#f59e0b",
  "--amber-ink": "#8a4b06",
  "--night": "#131315",
} as React.CSSProperties;

const D = "font-[family-name:var(--font-display)] [font-stretch:118%] tracking-[-0.02em]";
const M = "font-[family-name:var(--font-mono)]";
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)] focus-visible:ring-offset-2";

const NAV = [
  { href: "#product", label: "Product" },
  { href: "#offline", label: "Offline" },
  { href: "#payments", label: "Payments" },
  { href: "#faq", label: "FAQ" },
];

export default function Home() {
  return (
    <div
      style={PALETTE}
      className={`${display.variable} ${body.variable} ${mono.variable} flex-1 bg-[var(--paper)] font-[family-name:var(--font-body)] text-[var(--ink)] antialiased`}
    >
      <SiteHeader />
      <main>
        <Hero />
        <BuiltFor />
        <Product />
        <Offline />
        <Payments />
        <Setup />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}

function Logo() {
  return (
    <Link href="/" data-testid="landing-logo" className={`flex items-center gap-2 rounded-md ${FOCUS}`}>
      <span className="grid size-7 place-items-center rounded-[6px] bg-[var(--night)] text-sm font-bold text-[var(--amber)]" aria-hidden="true">
        R
      </span>
      <span className={`${D} text-lg font-extrabold`}>RESTIQ</span>
    </Link>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--paper)]/85 backdrop-blur">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Logo />
        <div className="ml-4 hidden items-center gap-6 text-sm text-[var(--ink-soft)] md:flex">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} data-testid={`landing-nav-${item.label.toLowerCase()}`} className={`rounded hover:text-[var(--ink)] ${FOCUS}`}>
              {item.label}
            </a>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/admin/login" data-testid="landing-sign-in" className={`hidden rounded-full px-3 py-2 text-sm font-medium hover:bg-black/5 sm:inline-block ${FOCUS}`}>
            Sign in
          </Link>
          <Link
            href="/demo"
            data-testid="landing-nav-demo"
            className={`rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-[var(--paper)] hover:bg-black ${FOCUS}`}
          >
            Live demo
          </Link>
        </div>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-12 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:pb-28 lg:pt-20">
      <div>
        <p className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs font-medium text-[var(--ink-soft)]">
          <span className="size-1.5 rounded-full bg-[var(--amber)]" aria-hidden="true" />
          Now onboarding pilot restaurants in India &amp; Australia
        </p>
        <h1 className={`${D} mt-6 text-[2.3rem] leading-[1.02] font-extrabold text-balance sm:text-6xl lg:text-[3.6rem] xl:text-[4rem]`}>
          The restaurant POS that keeps cooking when the internet doesn&rsquo;t.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--ink-soft)]">
          Tables, counter, kitchen screens, QR ordering and self-order kiosks: one system that runs the whole service, online or off.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/demo"
            data-testid="landing-hero-demo"
            className={`rounded-full bg-[var(--amber)] px-6 py-3 text-base font-semibold text-[var(--ink)] shadow-[0_8px_20px_-8px_rgba(245,158,11,0.8)] hover:brightness-105 ${FOCUS}`}
          >
            Try the live demo &rarr;
          </Link>
          <a href="#product" data-testid="landing-hero-tour" className={`rounded-full border border-[var(--line)] bg-white px-6 py-3 text-base font-semibold hover:border-[var(--ink)] ${FOCUS}`}>
            See how it works
          </a>
        </div>
        <p className={`${M} mt-6 text-[11px] uppercase tracking-[0.14em] text-[var(--ink-soft)]`}>Demo logins are listed on the next page</p>
      </div>
      <TicketRail />
    </section>
  );
}

type Tone = "new" | "ageing" | "aged";
const TONE_BAR: Record<Tone, string> = { new: "bg-blue-600", ageing: "bg-yellow-400", aged: "bg-red-600" };

function Ticket({
  tone,
  head,
  time,
  sub,
  lines,
  kot,
  className = "",
}: Readonly<{ tone: Tone; head: string; time: string; sub: string; lines: string[]; kot: string; className?: string }>) {
  return (
    <div className={`relative rounded-[4px] bg-white text-[var(--ink)] shadow-[0_10px_20px_-10px_rgba(0,0,0,0.6)] ${className}`}>
      <span className="absolute -top-2 left-1/2 h-3 w-9 -translate-x-1/2 rounded-sm bg-gradient-to-b from-stone-300 to-stone-500" />
      <div className={`h-1.5 rounded-t-[4px] ${TONE_BAR[tone]}`} />
      <div className={`${M} p-2.5 text-[10.5px] leading-snug sm:p-3 sm:text-[11px]`}>
        <div className="flex items-baseline justify-between gap-2 font-semibold">
          <span className="text-[13px]">{head}</span>
          <span className="tabular-nums">{time}</span>
        </div>
        <div className="text-stone-500">{sub}</div>
        <div className="my-2 border-t border-dashed border-stone-300" />
        {lines.map((line) => (
          <div key={line}>{line}</div>
        ))}
        <div className="mt-2 border-t border-dashed border-stone-300 pt-1.5 text-stone-500">KOT {kot}</div>
      </div>
    </div>
  );
}

function TicketRail() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-[520px]">
      <div className="rounded-2xl bg-[var(--night)] p-5 pb-10 shadow-[0_40px_80px_-40px_rgba(23,20,15,0.7)] sm:p-7 sm:pb-12">
        <div className="flex items-center justify-between gap-3">
          <span className={`${M} text-[11px] tracking-[0.14em] text-stone-400`}>GRILL STATION</span>
          <span className={`${M} inline-flex items-center gap-2 rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-[var(--amber)]`}>
            <span className="size-1.5 rounded-full bg-[var(--amber)] motion-safe:animate-pulse" />
            OFFLINE &middot; 3 QUEUED
          </span>
        </div>
        <div className="mt-6 h-2.5 rounded-full bg-gradient-to-b from-stone-200 via-stone-400 to-stone-600" />
        <div className="-mt-1 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-3.5">
          <Ticket tone="new" head="T4" time="0:42" sub="DINE-IN · 3 SEATS" lines={["2× BUTTER CHICKEN", "3× GARLIC NAAN", "1× DAL MAKHANI", "  - less chilli"]} kot="0419" className="-rotate-2" />
          <Ticket tone="ageing" head="#47" time="6:10" sub="COUNTER · TOKEN" lines={["1× SMASH BURGER", "1× LOADED FRIES", "2× COLD COFFEE"]} kot="0417" className="mt-3 rotate-1" />
          <Ticket
            tone="aged"
            head="T12"
            time="14:03"
            sub="QR · 3 GUESTS"
            lines={["RAHUL 1× BIRYANI", "ANNA 1× PANEER TIKKA", "ANNA 1× MANGO LASSI"]}
            kot="0414"
            className="hidden -rotate-1 sm:block"
          />
        </div>
      </div>
      <div className={`${M} absolute -bottom-5 right-3 rounded-md border-l-4 border-[var(--amber)] bg-white px-3 py-2 text-[11px] leading-snug shadow-lg sm:right-6`}>
        <div className="font-semibold">BILL A1-0418 · FINALISED</div>
        <div className="text-stone-500">printed · will sync when online</div>
      </div>
    </div>
  );
}

function BuiltFor() {
  return (
    <section aria-label="Built for" className="border-y border-[var(--line)] bg-white">
      <div className={`${M} mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-4 py-5 text-[11px] uppercase tracking-[0.16em] text-[var(--ink-soft)] sm:px-6 md:justify-between`}>
        <span className="font-semibold text-[var(--ink)]">Built for</span>
        {["Dine-in restaurants", "QSR counters", "Cafés", "Cloud kitchens", "Food courts"].map((kind) => (
          <span key={kind}>{kind}</span>
        ))}
      </div>
    </section>
  );
}

function SectionHead({ eyebrow, title, intro, dark = false }: Readonly<{ eyebrow: string; title: string; intro: string; dark?: boolean }>) {
  return (
    <div className="max-w-2xl">
      <p className={`${M} text-[11px] uppercase tracking-[0.16em] ${dark ? "text-[var(--amber)]" : "text-[var(--amber-ink)]"}`}>{eyebrow}</p>
      <h2 className={`${D} mt-3 text-3xl leading-tight font-extrabold text-balance sm:text-[2.6rem]`}>{title}</h2>
      <p className={`mt-4 text-lg leading-relaxed ${dark ? "text-stone-400" : "text-[var(--ink-soft)]"}`}>{intro}</p>
    </div>
  );
}

function Card({ label, title, text, className = "", children }: Readonly<{ label: string; title: string; text: string; className?: string; children: React.ReactNode }>) {
  return (
    <article className={`flex flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-white ${className}`}>
      <div className="p-6 pb-4">
        <p className={`${M} text-[11px] uppercase tracking-[0.14em] text-[var(--ink-soft)]`}>{label}</p>
        <h3 className={`${D} mt-2 text-xl font-bold`}>{title}</h3>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink-soft)]">{text}</p>
      </div>
      <div aria-hidden="true" className="mt-auto px-6 pb-6">
        {children}
      </div>
    </article>
  );
}

const TABLES = [
  { t: "T1", c: "border-stone-200 text-stone-400" },
  { t: "T2", c: "border-emerald-500 text-emerald-700" },
  { t: "T3", c: "border-stone-200 text-stone-400" },
  { t: "T4", c: "border-[var(--amber)] bg-amber-50 text-[var(--amber-ink)]" },
  { t: "T5", c: "border-emerald-500 text-emerald-700" },
  { t: "T6", c: "border-blue-500 text-blue-700" },
];

function Product() {
  return (
    <section id="product" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
      <SectionHead
        eyebrow="The platform"
        title="Every station in the restaurant. One system."
        intro="Front of house, the kitchen, your guests' phones and the back office all work from the same live orders - no double entry, no lost tickets."
      />
      <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card
          label="Tablet POS"
          title="Take orders at the table or the counter"
          text="Table map, seat-level ordering, split bills and manager PIN approvals. Counter mode rings up, settles and issues a token in one screen."
          className="lg:col-span-3"
        >
          <div className="grid grid-cols-3 gap-2">
            {TABLES.map(({ t, c }) => (
              <div key={t} className={`${M} flex h-14 items-center justify-center rounded-lg border-2 text-xs font-semibold ${c}`}>
                {t}
              </div>
            ))}
          </div>
        </Card>
        <Card
          label="Kitchen display"
          title="Tickets that tell the kitchen what's late"
          text="Every item routes to its station and ages blue, then yellow, then red. Bump, recall, and an expo view of what each order is still waiting on."
          className="lg:col-span-3"
        >
          <div className="flex gap-2">
            {(["bg-blue-600", "bg-yellow-400", "bg-red-600"] as const).map((bar, i) => (
              <div key={bar} className="flex-1 rounded-md border border-[var(--line)] bg-stone-50">
                <div className={`h-1.5 rounded-t-md ${bar}`} />
                <div className="space-y-1.5 p-2.5">
                  <div className="h-1.5 w-3/4 rounded bg-stone-300" />
                  <div className="h-1.5 w-1/2 rounded bg-stone-200" />
                  {i !== 1 && <div className="h-1.5 w-2/3 rounded bg-stone-200" />}
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card label="QR ordering" title="Guests order together" text="Scan the table QR, add from your own phone, and every line reaches the kitchen with the guest's name on it." className="lg:col-span-2">
          <div className="space-y-1.5">
            {[
              ["R", "Chicken biryani"],
              ["A", "Paneer tikka"],
              ["S", "Mango lassi"],
            ].map(([who, item]) => (
              <div key={item} className="flex items-center gap-2 rounded-lg bg-stone-50 px-2.5 py-2 text-xs">
                <span className="grid size-5 place-items-center rounded-full bg-[var(--ink)] text-[10px] font-bold text-white">{who}</span>
                {item}
              </div>
            ))}
          </div>
        </Card>
        <Card label="Self-order kiosk" title="A kiosk that takes the queue" text="Photo menu, one-tap add, pay by card at the kiosk and walk away with a token receipt." className="lg:col-span-2">
          <div className="rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 p-4 text-white">
            <p className={`${M} text-[9px] tracking-[0.2em] opacity-80`}>SELF-SERVICE KIOSK</p>
            <p className={`${D} mt-1 text-lg leading-tight font-extrabold`}>Hungry? Order here.</p>
            <div className="mt-3 inline-block rounded-full bg-white/90 px-3 py-1 text-[10px] font-semibold text-orange-700">Tap to start</div>
          </div>
        </Card>
        <Card label="Owner console" title="Run every outlet from a browser" text="Menu, floor plan, devices, staff PINs and reports across all your outlets." className="lg:col-span-2">
          <div className="flex h-20 items-end gap-1.5">
            {[40, 62, 48, 75, 58, 90, 68].map((h, i) => (
              <div key={i} style={{ height: `${h}%` }} className={`flex-1 rounded-t ${i === 5 ? "bg-[var(--amber)]" : "bg-stone-200"}`} />
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}

const SERVICE_LOG = [
  { t: "19:42:08", e: "INTERNET DOWN", tone: "text-red-600" },
  { t: "19:42:31", e: "KOT 0419 → GRILL · local network", tone: "" },
  { t: "19:47:02", e: "BILL A1-0418 · finalised · printed", tone: "" },
  { t: "19:51:40", e: "CASH ₹1,240 · drawer", tone: "" },
  { t: "20:31:15", e: "INTERNET BACK", tone: "text-emerald-700" },
  { t: "20:31:17", e: "SYNC 14 changes · in order · 0 lost", tone: "font-semibold" },
];

function Offline() {
  return (
    <section id="offline" className="scroll-mt-16 bg-[var(--night)] text-stone-100">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 py-24 sm:px-6 lg:grid-cols-2">
        <div>
          <SectionHead
            dark
            eyebrow="Offline-first"
            title="The Wi-Fi drops at 7:42 on a Friday. Service doesn't."
            intro="RESTIQ is built to keep trading without the cloud. Each till keeps what it needs, numbers its own bills and queues every change in order. When the connection returns, everything syncs - nothing lost, nothing counted twice."
          />
          <ul className="mt-8 space-y-3 text-[15px] text-stone-300">
            {[
              "Orders, kitchen tickets and bills keep flowing",
              "Bills stay gapless and tamper-evident on every device",
              "Cash and UPI keep working with the right safeguards",
              "Changes sync in order the moment you're back online",
            ].map((point) => (
              <li key={point} className="flex gap-3">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--amber)]" aria-hidden="true" />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <figure className="mx-auto w-full max-w-md rotate-1 rounded-sm bg-white p-6 text-[var(--ink)] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8)]">
          <figcaption className={`${M} text-center text-[11px] tracking-[0.18em] text-stone-500`}>SERVICE LOG · FRIDAY</figcaption>
          <div className="my-4 border-t border-dashed border-stone-300" />
          <ol className={`${M} space-y-2.5 text-[12px] leading-snug`}>
            {SERVICE_LOG.map((row) => (
              <li key={row.t} className="grid grid-cols-[4.6rem_1fr] gap-3">
                <span className="tabular-nums text-stone-500">{row.t}</span>
                <span className={row.tone}>{row.e}</span>
              </li>
            ))}
          </ol>
          <div className="my-4 border-t border-dashed border-stone-300" />
          <p className={`${M} text-center text-[11px] text-stone-500`}>no order was lost during this outage</p>
        </figure>
      </div>
    </section>
  );
}

function Payments() {
  const rails = [
    { label: "India", title: "UPI, confirmed", text: "A dynamic UPI QR on the bill, marked paid only when the payment provider confirms it." },
    { label: "Cards", title: "Terminals, integrated or not", text: "Send the amount to an integrated terminal, or record a standalone terminal's payment with its reference number." },
    { label: "Cash & splits", title: "A drawer that balances", text: "Split by seat or amount, blind counts at shift close, and over/short recorded - never edited afterwards." },
  ];
  return (
    <section id="payments" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
      <SectionHead
        eyebrow="Payments"
        title="Money you can trust at close."
        intro="Every electronic payment stays provisional until the provider says it's real - so the bills, the drawer and the bank all agree at the end of the night."
      />
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {rails.map((rail) => (
          <article key={rail.title} className="rounded-2xl border border-[var(--line)] bg-white p-6">
            <p className={`${M} text-[11px] uppercase tracking-[0.14em] text-[var(--amber-ink)]`}>{rail.label}</p>
            <h3 className={`${D} mt-2 text-xl font-bold`}>{rail.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink-soft)]">{rail.text}</p>
          </article>
        ))}
      </div>
      <p className={`${M} mt-6 text-[12px] text-[var(--ink-soft)]`}>GST tax invoices for India and Australia · GSTIN, ABN and FSSAI on every receipt</p>
    </section>
  );
}

function Setup() {
  const steps = [
    { title: "Import your menu", text: "Fill in the spreadsheet template or add items by hand - variants, modifiers and photos included." },
    { title: "Draw your floor", text: "Drag tables onto each floor and set up your kitchen stations." },
    { title: "Scan in your devices", text: "Every tablet, printer, kitchen screen and kiosk joins by scanning a QR code." },
    { title: "Hand out PINs", text: "Staff sign in with a 4-digit PIN. You're open." },
  ];
  return (
    <section id="setup" className="border-t border-[var(--line)] bg-white">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <SectionHead eyebrow="Going live" title="Open on RESTIQ in an afternoon." intro="The owner console walks you through a go-live checklist. Four steps and your first order is on the kitchen screen." />
        <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <li key={step.title} className="border-t-2 border-[var(--ink)] pt-5">
              <span className={`${M} text-[12px] text-[var(--amber-ink)]`}>0{i + 1}</span>
              <h3 className={`${D} mt-1 text-lg font-bold`}>{step.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink-soft)]">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const FAQS = [
  {
    q: "Does RESTIQ work without internet?",
    a: "Yes - it is built offline-first. Tills keep taking orders, sending kitchen tickets and printing bills, and everything syncs in order when the connection returns. Online-only tasks such as menu edits and owner reports catch up afterwards.",
  },
  {
    q: "What hardware do I need?",
    a: "Tablets or handhelds for the floor and counter, thermal receipt printers and a kitchen screen. RESTIQ also runs in the browser and installs as an app, so you can start on devices you already own.",
  },
  {
    q: "Which payments can I take?",
    a: "Cash, UPI via dynamic QR, card terminals (integrated, or standalone with the terminal's reference number) and split bills by seat or amount.",
  },
  {
    q: "Is it ready for GST?",
    a: "Tax invoices for India (CGST/SGST/IGST with GSTIN and FSSAI) and Australia (GST-inclusive pricing with ABN) are built in.",
  },
  {
    q: "How is my data kept safe?",
    a: "Each restaurant's data is isolated at the database level, staff sign in with personal PINs, sensitive actions need a manager's approval, and every change is recorded in an audit trail.",
  },
];

function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-24 sm:px-6">
      <h2 className={`${D} text-3xl font-extrabold sm:text-[2.6rem]`}>Questions, answered.</h2>
      <div className="mt-10 divide-y divide-[var(--line)] border-y border-[var(--line)]">
        {FAQS.map((item, i) => (
          <details key={item.q} className="group py-5">
            <summary data-testid={`landing-faq-${i}`} className={`flex cursor-pointer list-none items-center justify-between gap-4 rounded text-lg font-semibold ${FOCUS}`}>
              {item.q}
              <span className="text-2xl leading-none text-[var(--amber-ink)] transition-transform group-open:rotate-45" aria-hidden="true">
                +
              </span>
            </summary>
            <p className="mt-3 max-w-[65ch] text-[15px] leading-relaxed text-[var(--ink-soft)]">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="px-4 pb-24 sm:px-6">
      <div className="mx-auto max-w-6xl rounded-3xl bg-[var(--amber)] px-6 py-16 text-center sm:px-12">
        <h2 className={`${D} mx-auto max-w-3xl text-3xl leading-tight font-extrabold text-balance sm:text-5xl`}>Run Friday night on RESTIQ.</h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-[var(--ink)]/80">
          Walk through the whole restaurant - POS, kitchen, QR ordering and kiosk - with demo logins, right now.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/demo" data-testid="landing-cta-demo" className={`rounded-full bg-[var(--ink)] px-6 py-3 text-base font-semibold text-white hover:bg-black ${FOCUS}`}>
            Try the live demo &rarr;
          </Link>
          <Link
            href="/admin/login"
            data-testid="landing-cta-owner"
            className={`rounded-full border-2 border-[var(--ink)] px-6 py-3 text-base font-semibold hover:bg-[var(--ink)] hover:text-white ${FOCUS}`}
          >
            Owner sign in
          </Link>
        </div>
      </div>
    </section>
  );
}

const FOOTER_LINKS = [
  { href: "/demo", label: "Live demo", testId: "landing-footer-demo" },
  { href: "/pos/login", label: "Staff POS", testId: "landing-footer-pos" },
  { href: "/kds", label: "Kitchen display", testId: "landing-footer-kds" },
  { href: "/admin/login", label: "Owner console", testId: "landing-footer-admin" },
  { href: "/ops/login", label: "Platform operators", testId: "landing-footer-ops" },
];

function SiteFooter() {
  return (
    <footer className="border-t border-[var(--line)] bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-[var(--ink-soft)]">Restaurant POS for India and Australia, built to keep running offline.</p>
        </div>
        <nav aria-label="Sign in and demo" className="grid grid-cols-2 gap-x-10 gap-y-3 text-sm sm:grid-cols-3">
          {FOOTER_LINKS.map((link) => (
            <Link key={link.href} href={link.href} data-testid={link.testId} className={`rounded text-[var(--ink-soft)] hover:text-[var(--ink)] ${FOCUS}`}>
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <p className={`${M} border-t border-[var(--line)] py-5 text-center text-[11px] text-[var(--ink-soft)]`}>© 2026 RESTIQ</p>
    </footer>
  );
}
