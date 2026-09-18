// Public marketing landing page (issue #262). The demo portal that used to
// live here (sign-in doors, demo logins, live devices) is now /demo.
// Static on purpose: no API calls, so it renders even when the backend is down.
import type { Metadata } from "next";
import Link from "next/link";
import { body, display, mono } from "./landing-fonts";
import { HeroScene, Reveal, UpiPay } from "./landing-motion";
import "./landing.css";

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
      <span className="grid size-7 place-items-center rounded-[6px] bg-[var(--amber)] text-sm font-bold text-[var(--ink)]" aria-hidden="true">
        R
      </span>
      <span className={`${D} text-lg font-extrabold`}>RESTIQ</span>
    </Link>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[var(--night)] text-stone-100">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Logo />
        <div className="ml-4 hidden items-center gap-6 text-sm text-stone-400 md:flex">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} data-testid={`landing-nav-${item.label.toLowerCase()}`} className={`rounded hover:text-white ${FOCUS}`}>
              {item.label}
            </a>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/admin/login" data-testid="landing-sign-in" className={`hidden rounded-full px-3 py-2 text-sm font-medium hover:bg-white/10 sm:inline-block ${FOCUS}`}>
            Sign in
          </Link>
          <Link
            href="/demo"
            data-testid="landing-nav-demo"
            className={`rounded-full bg-[var(--amber)] px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:brightness-110 ${FOCUS}`}
          >
            Live demo
          </Link>
        </div>
      </nav>
    </header>
  );
}

const HEADLINE = "The restaurant POS that keeps cooking when the internet doesn’t.";

function Hero() {
  const words = HEADLINE.split(" ");
  return (
    <section className="relative overflow-hidden bg-[var(--night)] text-stone-100">
      {/* Backdrop: a warm glow over a faint grid, like a pass under heat lamps. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_50%_30%,black,transparent_75%)]" />
        <div className="lp-glow absolute left-1/2 top-[38%] h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(245,158,11,0.35),transparent)] blur-2xl" />
      </div>
      <div className="relative mx-auto max-w-6xl px-4 pb-28 pt-16 sm:px-6 lg:pb-36 lg:pt-24">
        <div className="mx-auto max-w-4xl text-center">
          <p className="lp-fade inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-stone-300">
            <span className="size-1.5 rounded-full bg-[var(--amber)] motion-safe:animate-pulse" aria-hidden="true" />
            Now onboarding pilot restaurants in India &amp; Australia
          </p>
          <h1 className={`${D} mt-7 text-[2.5rem] leading-[1] font-extrabold text-balance sm:text-6xl lg:text-7xl`}>
            {words.map((word, i) => (
              <span key={i}>
                <span className={`lp-word ${i >= 5 && i <= 6 ? "text-[var(--amber)]" : ""}`} style={{ "--i": i } as React.CSSProperties}>
                  {word}
                </span>
                {i < words.length - 1 ? " " : ""}
              </span>
            ))}
          </h1>
          <p className="lp-fade mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-stone-400 sm:text-xl" style={{ "--d": "700ms" } as React.CSSProperties}>
            Tables, counter, kitchen screens, QR ordering and self-order kiosks: one system that runs the whole service, online or off.
          </p>
          <div className="lp-fade mt-9 flex flex-wrap justify-center gap-3" style={{ "--d": "850ms" } as React.CSSProperties}>
            <Link
              href="/demo"
              data-testid="landing-hero-demo"
              className={`rounded-full bg-[var(--amber)] px-7 py-3.5 text-base font-semibold text-[var(--ink)] shadow-[0_10px_40px_-8px_rgba(245,158,11,0.7)] transition hover:-translate-y-0.5 hover:brightness-110 ${FOCUS}`}
            >
              Try the live demo &rarr;
            </Link>
            <a
              href="#product"
              data-testid="landing-hero-tour"
              className={`rounded-full border border-white/20 px-7 py-3.5 text-base font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/10 ${FOCUS}`}
            >
              See how it works
            </a>
          </div>
          <p className={`${M} lp-fade mt-6 text-[11px] uppercase tracking-[0.14em] text-stone-500`} style={{ "--d": "1000ms" } as React.CSSProperties}>
            No sign-up · demo logins are on the next page
          </p>
        </div>
        <div className="lp-fade mt-16 lg:mt-20" style={{ "--d": "600ms" } as React.CSSProperties}>
          <HeroScene />
        </div>
      </div>
    </section>
  );
}

const KINDS = ["Dine-in restaurants", "QSR counters", "Cafés", "Cloud kitchens", "Food courts", "Bars & bistros", "Multi-outlet chains"];

function BuiltFor() {
  return (
    <section aria-label="Built for" className="overflow-hidden border-y border-[var(--ink)] bg-[var(--amber)] py-4">
      <div className={`${M} lp-marquee flex w-max text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--ink)]`}>
        {[0, 1].map((copy) => (
          <div key={copy} aria-hidden={copy === 1} className="flex shrink-0 items-center">
            {KINDS.map((kind) => (
              <span key={kind} className="flex items-center gap-8 pr-8">
                {kind}
                <span aria-hidden="true">✦</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionHead({ eyebrow, title, intro, dark = false }: Readonly<{ eyebrow: string; title: string; intro: string; dark?: boolean }>) {
  return (
    <Reveal className="max-w-2xl">
      <p className={`${M} text-[11px] uppercase tracking-[0.16em] ${dark ? "text-[var(--amber)]" : "text-[var(--amber-ink)]"}`}>{eyebrow}</p>
      <h2 className={`${D} mt-3 text-[2.1rem] leading-[1.05] font-extrabold text-balance sm:text-5xl`}>{title}</h2>
      <p className={`mt-5 text-lg leading-relaxed ${dark ? "text-stone-400" : "text-[var(--ink-soft)]"}`}>{intro}</p>
    </Reveal>
  );
}

function Card({ label, title, text, className = "", children }: Readonly<{ label: string; title: string; text: string; className?: string; children: React.ReactNode }>) {
  return (
    <Reveal
      as="li"
      className={`group flex flex-col overflow-hidden rounded-3xl border border-[var(--line)] bg-white transition-[box-shadow,translate] duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_-24px_rgba(23,20,15,0.35)] ${className}`}
    >
      <div className="p-7 pb-5">
        <p className={`${M} text-[11px] uppercase tracking-[0.14em] text-[var(--amber-ink)]`}>{label}</p>
        <h3 className={`${D} mt-2 text-2xl leading-tight font-bold`}>{title}</h3>
        <p className="mt-2.5 text-[15px] leading-relaxed text-[var(--ink-soft)]">{text}</p>
      </div>
      <div aria-hidden="true" className="mt-auto border-t border-[var(--line)] bg-[#f4f3f0] px-7 py-6">
        {children}
      </div>
    </Reveal>
  );
}

function Product() {
  return (
    <section id="product" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6 lg:py-32">
      <SectionHead
        eyebrow="The platform"
        title="Every station in the restaurant. One system."
        intro="Front of house, the kitchen, your guests' phones and the back office all work from the same live orders - no double entry, no lost tickets."
      />
      <ul className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-6">
        <Card
          label="Tablet POS"
          title="Take orders at the table or the counter"
          text="Table map, seat-level ordering, split bills and manager PIN approvals. Counter mode rings up, settles and issues a token in one screen."
          className="lg:col-span-3"
        >
          <div className="grid grid-cols-3 gap-2.5">
            {["T1", "T2", "T3", "T4", "T5", "T6"].map((t, i) => (
              <div key={t} style={{ "--i": i } as React.CSSProperties} className={`${M} lp-table flex h-16 items-center justify-center rounded-xl border-2 border-stone-200 bg-white text-sm font-semibold text-stone-400`}>
                {t}
              </div>
            ))}
          </div>
          <div className={`${M} mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] uppercase tracking-[0.12em] text-stone-500`}>
            <span><i className="mr-1 inline-block size-2 rounded-full bg-emerald-500" />Seated</span>
            <span><i className="mr-1 inline-block size-2 rounded-full bg-[var(--amber)]" />Ordered</span>
            <span><i className="mr-1 inline-block size-2 rounded-full bg-blue-500" />Bill</span>
          </div>
        </Card>
        <Card
          label="Kitchen display"
          title="Tickets that tell the kitchen what's late"
          text="Every item routes to its station and ages blue, then yellow, then red. Bump, recall, and an expo view of what each order is still waiting on."
          className="lg:col-span-3"
        >
          <div className="flex gap-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex-1 rounded-md bg-white shadow-sm">
                <div style={{ "--i": i } as React.CSSProperties} className="lp-age h-2 rounded-t-md" />
                <div className="space-y-1.5 p-3">
                  <div className="h-1.5 w-3/4 rounded bg-stone-300" />
                  <div className="h-1.5 w-1/2 rounded bg-stone-200" />
                  <div className="h-1.5 w-2/3 rounded bg-stone-200" />
                  {i !== 1 && <div className="h-1.5 w-1/3 rounded bg-stone-200" />}
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card label="QR ordering" title="Guests order together" text="Scan the table QR, add from your own phone, and every line reaches the kitchen with the guest's name on it." className="lg:col-span-2">
          <div className="space-y-2">
            {[
              ["R", "Rahul", "Chicken biryani"],
              ["A", "Anna", "Paneer tikka"],
              ["S", "Sam", "Mango lassi"],
            ].map(([who, name, item], i) => (
              <div key={item} style={{ "--i": i } as React.CSSProperties} className="lp-stagger flex items-center gap-2.5 rounded-xl bg-white px-3 py-2.5 text-sm shadow-sm">
                <span className="grid size-6 place-items-center rounded-full bg-[var(--ink)] text-[11px] font-bold text-white">{who}</span>
                <span className="flex-1">{item}</span>
                <span className="text-xs text-stone-400">{name}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card label="Self-order kiosk" title="A kiosk that takes the queue" text="Photo menu, one-tap add, pay by card at the kiosk and walk away with a token receipt." className="lg:col-span-2">
          <div className="rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 p-5 text-white">
            <p className={`${M} text-[9px] tracking-[0.2em] opacity-80`}>SELF-SERVICE KIOSK</p>
            <p className={`${D} mt-1 text-2xl leading-tight font-extrabold`}>Hungry? Order here.</p>
            <div className="lp-ring mt-4 inline-block rounded-full bg-white px-4 py-1.5 text-xs font-bold text-orange-700">Tap to start</div>
          </div>
        </Card>
        <Card label="Owner console" title="Run every outlet from a browser" text="Menu, floor plan, devices, staff PINs and reports across all your outlets." className="lg:col-span-2">
          <div className="flex h-24 items-end gap-2">
            {[40, 62, 48, 75, 58, 92, 68].map((h, i) => (
              <div key={i} style={{ height: `${h}%`, "--i": i } as React.CSSProperties} className={`lp-bar flex-1 rounded-t-md ${i === 5 ? "bg-[var(--amber)]" : "bg-stone-300"}`} />
            ))}
          </div>
          <div className={`${M} mt-2 flex justify-between text-[10px] text-stone-500`}>
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <span key={i} className="flex-1 text-center">{d}</span>
            ))}
          </div>
        </Card>
      </ul>
    </section>
  );
}

const SERVICE_LOG = [
  { t: "19:42:08", e: "INTERNET DOWN", tone: "text-red-600 font-semibold" },
  { t: "19:42:31", e: "KOT 0419 → GRILL · local network", tone: "" },
  { t: "19:47:02", e: "BILL A1-0418 · finalised · printed", tone: "" },
  { t: "19:51:40", e: "CASH ₹1,240 · drawer", tone: "" },
  { t: "20:31:15", e: "INTERNET BACK", tone: "text-emerald-700 font-semibold" },
  { t: "20:31:17", e: "SYNC 14 changes · in order · 0 lost", tone: "font-semibold" },
];

function Offline() {
  return (
    <section id="offline" className="relative scroll-mt-16 overflow-hidden bg-[var(--night)] text-stone-100">
      <div aria-hidden="true" className="lp-glow pointer-events-none absolute -right-40 top-10 h-[480px] w-[640px] rounded-full bg-[radial-gradient(closest-side,rgba(245,158,11,0.22),transparent)] blur-2xl" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:py-32">
        <div>
          <SectionHead
            dark
            eyebrow="Offline-first"
            title="The Wi-Fi drops at 7:42 on a Friday. Service doesn't."
            intro="RESTIQ is built to keep trading without the cloud. Each till keeps what it needs, numbers its own bills and queues every change in order. When the connection returns, everything syncs - nothing lost, nothing counted twice."
          />
          <Reveal as="div" className="mt-9">
            <ul className="space-y-3.5 text-[15px] text-stone-300">
              {[
                "Orders, kitchen tickets and bills keep flowing",
                "Bills stay gapless and tamper-evident on every device",
                "Cash and UPI keep working with the right safeguards",
                "Changes sync in order the moment you're back online",
              ].map((point, i) => (
                <li key={point} style={{ "--i": i } as React.CSSProperties} className="lp-stagger flex gap-3">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[var(--amber)]/15 text-[11px] text-[var(--amber)]" aria-hidden="true">✓</span>
                  {point}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
        <Reveal as="figure" className="mx-auto w-full max-w-md">
          {/* The printer the log feeds out of. */}
          <div aria-hidden="true" className="relative z-10 mx-auto h-9 w-[92%] rounded-t-xl bg-gradient-to-b from-stone-600 to-stone-800 shadow-lg">
            <div className="absolute inset-x-6 bottom-0 h-1.5 rounded-full bg-black" />
            <span className="absolute right-4 top-3 size-2 rounded-full bg-emerald-400 motion-safe:animate-pulse" />
          </div>
          <div className="mx-auto -mt-1 w-[84%] rounded-b-sm bg-white p-6 text-[var(--ink)] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8)] [background-image:radial-gradient(circle_at_8px_100%,var(--night)_6px,transparent_6.5px)] [background-position:bottom] [background-repeat:repeat-x] [background-size:16px_12px] pb-8">
            <figcaption className={`${M} text-center text-[11px] tracking-[0.18em] text-stone-500`}>SERVICE LOG · FRIDAY</figcaption>
            <div className="my-4 border-t border-dashed border-stone-300" />
            <ol className={`${M} space-y-2.5 text-[12px] leading-snug`}>
              {SERVICE_LOG.map((row, i) => (
                <li key={row.t} style={{ "--i": i } as React.CSSProperties} className="lp-printed grid grid-cols-[4.6rem_1fr] gap-3">
                  <span className="tabular-nums text-stone-500">{row.t}</span>
                  <span className={row.tone}>{row.e}</span>
                </li>
              ))}
            </ol>
            <div className="my-4 border-t border-dashed border-stone-300" />
            <p style={{ "--i": SERVICE_LOG.length } as React.CSSProperties} className={`${M} lp-printed text-center text-[11px] text-stone-500`}>
              no order was lost during this outage
            </p>
          </div>
        </Reveal>
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
    <section id="payments" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6 lg:py-32">
      <div className="grid items-end gap-10 lg:grid-cols-[1.2fr_1fr]">
        <SectionHead
          eyebrow="Payments"
          title="Money you can trust at close."
          intro="Every electronic payment stays provisional until the provider says it's real - so the bills, the drawer and the bank all agree at the end of the night."
        />
        <Reveal>
          <UpiPay />
        </Reveal>
      </div>
      <ul className="mt-12 grid gap-5 md:grid-cols-3">
        {rails.map((rail) => (
          <Reveal as="li" key={rail.title} className="rounded-3xl border border-[var(--line)] bg-white p-7 transition-[box-shadow,translate] duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_-24px_rgba(23,20,15,0.35)]">
            <p className={`${M} text-[11px] uppercase tracking-[0.14em] text-[var(--amber-ink)]`}>{rail.label}</p>
            <h3 className={`${D} mt-2 text-2xl font-bold`}>{rail.title}</h3>
            <p className="mt-2.5 text-[15px] leading-relaxed text-[var(--ink-soft)]">{rail.text}</p>
          </Reveal>
        ))}
      </ul>
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
    <section id="setup" className="border-y border-[var(--line)] bg-white">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-32">
        <SectionHead eyebrow="Going live" title="Open on RESTIQ in an afternoon." intro="The owner console walks you through a go-live checklist. Four steps and your first order is on the kitchen screen." />
        <Reveal className="relative mt-14">
          <div aria-hidden="true" className="absolute left-0 right-0 top-[15px] hidden h-0.5 bg-[var(--line)] lg:block">
            <div className="lp-bar-x h-full bg-[var(--amber)]" />
          </div>
          <ol className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <li key={step.title} style={{ "--i": i } as React.CSSProperties} className="lp-stagger relative">
                <span className={`${M} relative grid size-8 place-items-center rounded-full bg-[var(--ink)] text-[12px] font-semibold text-[var(--amber)]`}>{i + 1}</span>
                <h3 className={`${D} mt-5 text-xl font-bold`}>{step.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink-soft)]">{step.text}</p>
              </li>
            ))}
          </ol>
        </Reveal>
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
      <Reveal>
        <h2 className={`${D} text-[2.1rem] font-extrabold sm:text-5xl`}>Questions, answered.</h2>
      </Reveal>
      <div className="mt-10 divide-y divide-[var(--line)] border-y border-[var(--line)]">
        {FAQS.map((item, i) => (
          <details key={item.q} className="group py-5">
            <summary data-testid={`landing-faq-${i}`} className={`flex cursor-pointer list-none items-center justify-between gap-4 rounded text-lg font-semibold ${FOCUS}`}>
              {item.q}
              <span className="grid size-8 shrink-0 place-items-center rounded-full border border-[var(--line)] text-xl leading-none text-[var(--amber-ink)] transition-transform duration-300 group-open:rotate-45 group-hover:border-[var(--ink)]" aria-hidden="true">
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
    <section className="px-4 pb-24 pt-8 sm:px-6">
      <Reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-[var(--night)] px-6 py-20 text-center text-white sm:px-12">
        <div aria-hidden="true" className="lp-glow pointer-events-none absolute left-1/2 top-full h-[420px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(245,158,11,0.55),transparent)] blur-2xl" />
        <div className="relative">
          <h2 className={`${D} mx-auto max-w-3xl text-4xl leading-[1.02] font-extrabold text-balance sm:text-6xl`}>
            Run Friday night on <span className="text-[var(--amber)]">RESTIQ</span>.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-stone-400">
            Walk through the whole restaurant - POS, kitchen, QR ordering and kiosk - with demo logins, right now.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link
              href="/demo"
              data-testid="landing-cta-demo"
              className={`rounded-full bg-[var(--amber)] px-7 py-3.5 text-base font-semibold text-[var(--ink)] shadow-[0_10px_40px_-8px_rgba(245,158,11,0.7)] transition hover:-translate-y-0.5 hover:brightness-110 ${FOCUS}`}
            >
              Try the live demo &rarr;
            </Link>
            <Link
              href="/admin/login"
              data-testid="landing-cta-owner"
              className={`rounded-full border border-white/25 px-7 py-3.5 text-base font-semibold transition hover:-translate-y-0.5 hover:bg-white/10 ${FOCUS}`}
            >
              Owner sign in
            </Link>
          </div>
        </div>
      </Reveal>
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
