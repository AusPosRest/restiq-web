"use client";
// Animated pieces of the marketing page (#262). Everything renders complete on
// the server; motion only starts in the browser, and never with reduced motion.
import { useEffect, useRef, useState } from "react";
import { KioskMock, KitchenMock, OwnerMock, PosMock, QrMock } from "./landing-mockups";

const M = "font-[family-name:var(--font-mono)]";

function reducedMotion() {
  return typeof window === "undefined" || !window.matchMedia || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Fades its content up when it scrolls into view. Content already on screen at
// load (or without IntersectionObserver) just stays visible.
export function Reveal({ children, className = "", as = "div" }: Readonly<{ children: React.ReactNode; className?: string; as?: "div" | "li" | "figure" }>) {
  const Tag = as as "div"; // ponytail: same ref type for all three tags
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"wait" | "in" | undefined>(undefined);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined" || reducedMotion()) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    setState("wait");
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setState("in");
        io.disconnect();
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} data-state={state} className={`lp-reveal ${className}`}>
      {children}
    </Tag>
  );
}

// A one-second clock that starts in the browser. Starting from a fixed tick
// keeps the server render and the first client render identical.
function useTick(start: number) {
  const [tick, setTick] = useState(start);
  useEffect(() => {
    if (reducedMotion()) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  return tick;
}

type Tone = "new" | "ageing" | "aged";
const TONE_BAR: Record<Tone, string> = { new: "bg-blue-500", ageing: "bg-yellow-400", aged: "bg-red-500" };

const POOL = [
  { head: "T4", sub: "DINE-IN · 3 SEATS", lines: ["2× BUTTER CHICKEN", "3× GARLIC NAAN", "1× DAL MAKHANI", "  - less chilli"] },
  { head: "#47", sub: "COUNTER · TOKEN", lines: ["1× SMASH BURGER", "1× LOADED FRIES", "2× COLD COFFEE"] },
  { head: "T12", sub: "QR · 3 GUESTS", lines: ["RAHUL 1× BIRYANI", "ANNA 1× PANEER TIKKA", "ANNA 1× MANGO LASSI"] },
  { head: "#48", sub: "KIOSK · TOKEN", lines: ["2× MASALA DOSA", "1× FILTER COFFEE"] },
  { head: "T7", sub: "DINE-IN · 2 SEATS", lines: ["1× LAMB ROGAN JOSH", "2× JEERA RICE", "1× RAITA"] },
];

const EVERY = 5; // a new ticket every 5 s
const SPEED = 30; // kitchen clock runs 30x so tickets visibly age

function mmss(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function network(tick: number) {
  const p = tick % 30;
  if (p < 10) return { label: "ONLINE · IN SYNC", tone: "text-emerald-400", dot: "bg-emerald-400" };
  if (p < 22) return { label: `OFFLINE · ${Math.floor((p - 10) / 2) + 1} QUEUED`, tone: "text-[var(--amber)]", dot: "bg-[var(--amber)] animate-pulse" };
  if (p < 25) return { label: "SYNCING…", tone: "text-sky-400", dot: "bg-sky-400 animate-pulse" };
  return { label: "BACK ONLINE · 0 LOST", tone: "text-emerald-400", dot: "bg-emerald-400" };
}

const BILL = [
  { name: "Butter chicken", qty: 2, minor: 76000 },
  { name: "Garlic naan", qty: 3, minor: 27000 },
  { name: "Dal makhani", qty: 1, minor: 32000 },
  { name: "Mango lassi", qty: 2, minor: 24000 },
  { name: "Gulab jamun", qty: 1, minor: 16000 },
];
const TILES = ["Butter chicken", "Garlic naan", "Dal makhani", "Mango lassi", "Gulab jamun", "Paneer tikka"];
const inr = (minor: number) => `₹${(minor / 100).toLocaleString("en-IN")}`;

const GUESTS = [
  ["R", "Rahul", "Chicken biryani"],
  ["A", "Anna", "Paneer tikka"],
  ["A", "Anna", "Mango lassi"],
  ["S", "Sam", "Gulab jamun"],
];

// The hero picture: a kitchen screen with live, ageing tickets, the POS tablet
// ringing up a bill, and a guest ordering from their phone.
export function HeroScene() {
  const tick = useTick(16);
  const newest = Math.floor(tick / EVERY);
  const tickets = [newest - 3, newest - 2, newest - 1, newest].map((i) => {
    const age = (tick - i * EVERY) * SPEED + 40;
    const tone: Tone = age < 300 ? "new" : age < 600 ? "ageing" : "aged";
    return { i, age, tone, ...POOL[i % POOL.length] };
  });
  const net = network(tick);
  const billCount = Math.min(BILL.length, 1 + Math.floor((tick % 14) / 2));
  const bill = BILL.slice(0, billCount);
  const guests = GUESTS.slice(0, Math.min(GUESTS.length, 1 + Math.floor(((tick + 5) % 12) / 2)));

  return (
    <div aria-hidden="true" className="lp-scene relative mx-auto w-full max-w-6xl select-none md:pb-28">
      {/* Kitchen display */}
      <div className="relative mx-auto w-full rounded-[18px] border border-white/10 bg-[#1c1b1f] p-2 shadow-[0_60px_120px_-40px_rgba(0,0,0,0.9)] md:w-[82%] lg:w-[78%]">
        <div className="rounded-[12px] bg-[#0d0d10] p-4 sm:p-5">
          <div className={`${M} flex items-center justify-between gap-3 text-[10px] tracking-[0.14em] sm:text-[11px]`}>
            <span className="text-stone-400">
              GRILL STATION <span className="text-stone-600">·</span> {tickets.length} OPEN
            </span>
            <span className={`inline-flex items-center gap-2 rounded-full bg-white/5 px-2.5 py-1 ${net.tone}`}>
              <span className={`size-1.5 rounded-full ${net.dot}`} />
              {net.label}
            </span>
          </div>
          <div className="mt-4 h-2 rounded-full bg-gradient-to-b from-stone-300 via-stone-500 to-stone-700" />
          <div className="-mt-1 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
            {tickets.map((t, n) => (
              <div
                key={t.i}
                className={`lp-ticket relative rounded-[4px] bg-[#fbfaf7] text-[#17140f] shadow-[0_10px_20px_-10px_rgba(0,0,0,0.8)] ${n < 2 ? "hidden sm:block" : ""} ${n % 2 ? "rotate-1" : "-rotate-1"}`}
              >
                <span className="absolute -top-1.5 left-1/2 h-2.5 w-8 -translate-x-1/2 rounded-sm bg-gradient-to-b from-stone-300 to-stone-500" />
                <div className={`h-1.5 rounded-t-[4px] transition-colors duration-700 ${TONE_BAR[t.tone]}`} />
                <div className={`${M} p-2.5 text-[10px] leading-snug sm:text-[10.5px]`}>
                  <div className="flex items-baseline justify-between gap-2 font-semibold">
                    <span className="text-[13px]">{t.head}</span>
                    <span className={`tabular-nums ${t.tone === "aged" ? "text-red-600" : ""}`}>{mmss(t.age)}</span>
                  </div>
                  <div className="text-stone-500">{t.sub}</div>
                  <div className="my-1.5 border-t border-dashed border-stone-300" />
                  {t.lines.map((line) => (
                    <div key={line} className="truncate whitespace-pre">
                      {line}
                    </div>
                  ))}
                  <div className="mt-1.5 border-t border-dashed border-stone-300 pt-1 text-stone-500">KOT {419 + t.i}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mx-auto h-6 w-24 bg-gradient-to-b from-[#1c1b1f] to-[#111] md:w-32" />
      <div className="mx-auto h-2 w-48 rounded-t-lg bg-[#1c1b1f] md:w-64" />

      {/* POS tablet */}
      <div className="lp-float absolute bottom-0 left-0 hidden w-[40%] rounded-[20px] border border-white/10 bg-[#222126] p-2.5 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.9)] md:block lg:left-[-2%]">
        <div className="grid grid-cols-[1.25fr_1fr] gap-2 rounded-[12px] bg-[#f6f5f2] p-2.5 text-[#17140f]">
          <div>
            <p className={`${M} text-[9px] tracking-[0.14em] text-stone-500`}>T4 · MAINS</p>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {TILES.map((name, i) => (
                <div
                  key={name}
                  className={`rounded-md border px-1.5 py-2 text-[9.5px] leading-tight font-semibold transition-colors ${
                    i === billCount - 1 ? "border-[var(--amber)] bg-amber-100" : "border-stone-200 bg-white"
                  }`}
                >
                  {name}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col rounded-md bg-white p-2">
            <p className={`${M} text-[9px] tracking-[0.14em] text-stone-500`}>BILL · T4</p>
            <div className="mt-1 flex-1 space-y-1">
              {bill.map((line) => (
                <div key={line.name} className="lp-line flex justify-between gap-1 text-[9.5px]">
                  <span className="truncate">
                    {line.qty}× {line.name}
                  </span>
                  <span className="tabular-nums">{inr(line.minor)}</span>
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between border-t border-stone-200 pt-1 text-[10px] font-bold">
              <span>Total</span>
              <span className="tabular-nums">{inr(bill.reduce((s, l) => s + l.minor, 0))}</span>
            </div>
            <div className="mt-1.5 rounded bg-[#17140f] py-1 text-center text-[9px] font-semibold text-white">Send to kitchen</div>
          </div>
        </div>
      </div>

      {/* Guest phone */}
      <div className="lp-float-late absolute bottom-[-2%] right-[2%] hidden w-[17%] min-w-[150px] rounded-[26px] border border-white/10 bg-[#222126] p-1.5 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.9)] md:block lg:right-[-1%]">
        <div className="rounded-[20px] bg-white p-2.5 text-[#17140f]">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-stone-200" />
          <p className={`${M} text-[8.5px] tracking-[0.14em] text-stone-500`}>TABLE 12 · ORDERING TOGETHER</p>
          <div className="mt-2 space-y-1.5">
            {guests.map(([initial, who, item], i) => (
              <div key={`${who}-${item}`} className="lp-line flex items-center gap-1.5 rounded-md bg-stone-50 px-1.5 py-1.5 text-[9.5px]">
                <span className={`grid size-4 shrink-0 place-items-center rounded-full text-[8px] font-bold text-white ${i % 2 ? "bg-orange-500" : "bg-[#17140f]"}`}>{initial}</span>
                <span className="truncate">{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 rounded-full bg-[var(--amber)] py-1.5 text-center text-[9.5px] font-bold">Place order · {guests.length}</div>
        </div>
      </div>
    </div>
  );
}

// UPI QR that waits, then flips to paid only once the provider confirms.
export function UpiPay() {
  const tick = useTick(0);
  const paid = tick % 8 >= 5;
  return (
    <div aria-hidden="true" className="flex items-center gap-5 rounded-3xl border border-[var(--line)] bg-white p-5 shadow-[0_24px_50px_-30px_rgba(23,20,15,0.4)]">
      <div className="relative grid size-24 shrink-0 grid-cols-9 gap-px rounded-md bg-white p-1.5 shadow-sm">
        {Array.from({ length: 81 }, (_, i) => {
          const r = Math.floor(i / 9), c = i % 9;
          const finder = (r < 3 && (c < 3 || c > 5)) || (r > 5 && c < 3);
          const on = finder ? !(r % 6 === 1 && c % 6 === 1) : (r * 7 + c * 13 + r * c) % 5 < 2;
          return <span key={i} className={on ? "bg-[#17140f]" : ""} />;
        })}
        <span className={`absolute inset-0 grid place-items-center rounded-md bg-emerald-500/90 text-3xl font-bold text-white transition-opacity duration-500 ${paid ? "opacity-100" : "opacity-0"}`}>✓</span>
      </div>
      <div className={`${M} text-[12px] leading-relaxed`}>
        <div className="text-[10px] tracking-[0.16em] text-stone-500">SCAN TO PAY · UPI</div>
        <div className="font-semibold text-[#17140f]">BILL A1-0418 · ₹1,550</div>
        <div className={paid ? "text-emerald-700" : "text-stone-500"}>{paid ? "PAID · confirmed by provider" : "Waiting for UPI…"}</div>
      </div>
    </div>
  );
}

const TOUR = [
  {
    key: "pos",
    tab: "Tablet POS",
    title: "Take orders at the table or the counter",
    text: "A live table map shows who's seated, who's ordered and who's waiting on the bill. Order by seat, split any way, and settle without walking to the till.",
    points: ["Seat-level ordering and split bills", "Counter mode with tokens", "Manager PIN approvals for voids and discounts"],
    Mock: PosMock,
    dark: false,
  },
  {
    key: "kitchen",
    tab: "Kitchen display",
    title: "Tickets that tell the kitchen what's late",
    text: "Every item goes to its station and ages blue, yellow, then red. Expo sees what each table is still waiting on, so food leaves the pass together.",
    points: ["Per-station routing", "Bump, recall and all-day counts", "Expo view of what's missing"],
    Mock: KitchenMock,
    dark: true,
  },
  {
    key: "qr",
    tab: "QR ordering",
    title: "Guests order together from their phones",
    text: "Scan the table QR, browse a photo menu and add to one shared cart. Every line reaches the kitchen with the guest's name on it.",
    points: ["No app to install", "One cart for the whole table", "Request the bill from the phone"],
    Mock: QrMock,
    dark: false,
  },
  {
    key: "kiosk",
    tab: "Self-order kiosk",
    title: "A kiosk that takes the queue",
    text: "Big photo tiles, one-tap add and card payment at the kiosk. Guests walk away with a token receipt while the order is already on the kitchen screen.",
    points: ["Photo menu with categories", "Pay by card on the kiosk", "Token receipt printed on the spot"],
    Mock: KioskMock,
    dark: false,
  },
  {
    key: "owner",
    tab: "Owner console",
    title: "Run every outlet from a browser",
    text: "Menu, floor plan, devices, staff PINs and reports for all your outlets in one place - with a go-live checklist for the first day.",
    points: ["Menu import from a spreadsheet", "Devices join by scanning a QR", "Sales and reports across outlets"],
    Mock: OwnerMock,
    dark: false,
  },
] as const;

// Tabs across the five surfaces; advances on its own until someone picks one.
export function ProductTour() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto || reducedMotion()) return;
    const id = window.setTimeout(() => setActive((a) => (a + 1) % TOUR.length), 7000);
    return () => window.clearTimeout(id);
  }, [active, auto]);
  const item = TOUR[active];
  return (
    <div>
      <div role="tablist" aria-label="RESTIQ surfaces" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {TOUR.map((t, i) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`tour-tab-${t.key}`}
            aria-selected={i === active}
            aria-controls="tour-panel"
            data-testid={`landing-tour-${t.key}`}
            onClick={() => {
              setActive(i);
              setAuto(false);
            }}
            className={`relative shrink-0 overflow-hidden rounded-full border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)] focus-visible:ring-offset-2 ${
              i === active ? "border-[var(--ink)] bg-[var(--ink)] text-white" : "border-[var(--line)] bg-white text-[var(--ink-soft)] hover:border-[var(--ink)] hover:text-[var(--ink)]"
            }`}
          >
            {t.tab}
            {i === active && auto && <span key={active} className="lp-progress absolute inset-x-0 bottom-0 h-0.5 origin-left bg-[var(--amber)]" />}
          </button>
        ))}
      </div>
      <div id="tour-panel" role="tabpanel" aria-labelledby={`tour-tab-${item.key}`} className="mt-8 grid items-stretch gap-8 lg:grid-cols-[1fr_1.7fr]">
        <div key={item.key} className="lp-swap flex flex-col justify-center">
          <h3 className="font-[family-name:var(--font-display)] text-3xl leading-tight font-extrabold tracking-[-0.02em] [font-stretch:118%] text-balance">{item.title}</h3>
          <p className="mt-4 text-[17px] leading-relaxed text-[var(--ink-soft)]">{item.text}</p>
          <ul className="mt-6 space-y-2.5">
            {item.points.map((p) => (
              <li key={p} className="flex gap-3 text-[15px]">
                <span aria-hidden="true" className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-amber-100 text-[11px] text-[var(--amber-ink)]">
                  ✓
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div
          className={`relative min-h-[380px] overflow-hidden rounded-[28px] border sm:min-h-[440px] ${
            item.dark ? "border-transparent bg-[var(--night)]" : "border-[var(--line)] bg-[radial-gradient(circle_at_30%_20%,#fff7e6,transparent_60%),linear-gradient(#f1efeb,#e9e6e1)]"
          }`}
        >
          <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(#00000012_1px,transparent_1px)] bg-[size:18px_18px]" />
          <div key={item.key} className="lp-swap relative h-full">
            <item.Mock />
          </div>
        </div>
      </div>
    </div>
  );
}
