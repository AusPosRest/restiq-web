// Product pictures for the marketing page (#262), drawn in markup so they stay
// sharp at any size. Decorative only: every mockup is aria-hidden.
const M = "font-[family-name:var(--font-mono)]";
const D = "font-[family-name:var(--font-display)] [font-stretch:118%] tracking-[-0.02em]";

const FOOD = [
  "from-amber-300 to-orange-500",
  "from-rose-300 to-red-500",
  "from-lime-300 to-emerald-500",
  "from-yellow-200 to-amber-400",
  "from-orange-300 to-rose-500",
  "from-emerald-200 to-teal-500",
];

function Dish({ i, className = "" }: Readonly<{ i: number; className?: string }>) {
  // A plate seen from above: rim, food, a sprig.
  return (
    <div className={`relative grid place-items-center rounded-lg bg-gradient-to-br ${FOOD[i % FOOD.length]} ${className}`}>
      <div className="size-[62%] rounded-full bg-white/85 shadow-inner">
        <div className={`m-[18%] size-[64%] rounded-full bg-gradient-to-br ${FOOD[(i + 2) % FOOD.length]} shadow-[inset_0_-4px_8px_rgba(0,0,0,0.15)]`} />
      </div>
    </div>
  );
}

function Tablet({ children, className = "" }: Readonly<{ children: React.ReactNode; className?: string }>) {
  return (
    <div className={`rounded-[22px] border border-black/10 bg-[#1f1e22] p-2.5 shadow-[0_40px_80px_-30px_rgba(23,20,15,0.6)] ${className}`}>
      <div className="overflow-hidden rounded-[14px]">{children}</div>
    </div>
  );
}

function Phone({ children, className = "" }: Readonly<{ children: React.ReactNode; className?: string }>) {
  return (
    <div className={`rounded-[30px] border border-black/10 bg-[#1f1e22] p-1.5 shadow-[0_40px_80px_-30px_rgba(23,20,15,0.6)] ${className}`}>
      <div className="overflow-hidden rounded-[24px] bg-white">
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-stone-200" />
        {children}
      </div>
    </div>
  );
}

const FLOOR = [
  { t: "T1", s: "free", x: "col-span-1" },
  { t: "T2", s: "seated", x: "col-span-1" },
  { t: "T3", s: "free", x: "col-span-2" },
  { t: "T4", s: "ordered", x: "col-span-2" },
  { t: "T5", s: "bill", x: "col-span-1" },
  { t: "T6", s: "seated", x: "col-span-1" },
  { t: "T7", s: "ordered", x: "col-span-1" },
  { t: "T8", s: "free", x: "col-span-1" },
  { t: "T9", s: "seated", x: "col-span-2" },
] as const;
const STATUS = {
  free: "border-stone-200 bg-white text-stone-400",
  seated: "border-emerald-500 bg-emerald-50 text-emerald-700",
  ordered: "border-amber-500 bg-amber-50 text-amber-800",
  bill: "border-blue-500 bg-blue-50 text-blue-700",
};

export function PosMock() {
  return (
    <div aria-hidden="true" className="grid h-full place-items-center p-4 sm:p-8">
      <Tablet className="w-full max-w-[640px]">
        <div className="grid grid-cols-[1fr_190px] bg-[#f6f5f2] text-[#17140f] max-sm:grid-cols-1">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <span className={`${D} text-sm font-bold`}>Main floor</span>
              <span className={`${M} text-[9px] tracking-[0.14em] text-stone-500`}>9 TABLES · 6 OPEN</span>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {FLOOR.map((f, i) => (
                <div
                  key={f.t}
                  style={{ "--i": i } as React.CSSProperties}
                  className={`${M} ${f.x} flex h-14 flex-col items-center justify-center rounded-xl border-2 text-xs font-semibold ${STATUS[f.s]} ${f.t === "T4" ? "ring-2 ring-[#17140f] ring-offset-2 ring-offset-[#f6f5f2]" : ""}`}
                >
                  {f.t}
                  {f.s !== "free" && <span className="text-[8px] font-normal opacity-70">{f.s === "bill" ? "bill" : `${12 + i * 4}m`}</span>}
                </div>
              ))}
            </div>
          </div>
          <div className="border-l border-stone-200 bg-white p-4 max-sm:hidden">
            <p className={`${M} text-[9px] tracking-[0.14em] text-stone-500`}>T4 · 3 GUESTS · 32 MIN</p>
            <div className="mt-2 space-y-1.5 text-[11px]">
              {[
                ["Seat 1", "Butter chicken", "₹380"],
                ["Seat 1", "Garlic naan ×2", "₹180"],
                ["Seat 2", "Dal makhani", "₹320"],
                ["Seat 3", "Paneer tikka", "₹340"],
              ].map(([seat, item, amt]) => (
                <div key={item} className="flex items-baseline justify-between gap-2">
                  <span>
                    <span className="text-stone-400">{seat} </span>
                    {item}
                  </span>
                  <span className="tabular-nums">{amt}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-between border-t border-stone-200 pt-2 text-xs font-bold">
              <span>Total</span>
              <span>₹1,220</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-1.5 text-[10px] font-semibold">
              <span className="rounded-md border border-stone-200 py-1.5 text-center">Split</span>
              <span className="rounded-md bg-[#17140f] py-1.5 text-center text-white">Settle</span>
            </div>
          </div>
        </div>
      </Tablet>
    </div>
  );
}

const KDS = [
  { h: "T4", t: "12:40", c: "bg-red-500", l: ["2× BUTTER CHICKEN", "3× GARLIC NAAN"] },
  { h: "#47", t: "7:05", c: "bg-yellow-400", l: ["1× SMASH BURGER", "1× LOADED FRIES"] },
  { h: "T12", t: "4:20", c: "bg-blue-500", l: ["1× BIRYANI", "1× PANEER TIKKA", "1× LASSI"] },
  { h: "#48", t: "1:10", c: "bg-blue-500", l: ["2× MASALA DOSA"] },
];

export function KitchenMock() {
  return (
    <div aria-hidden="true" className="grid h-full place-items-center p-4 sm:p-8">
      <div className="w-full max-w-[680px] rounded-[18px] border border-white/10 bg-[#1c1b1f] p-2 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.8)]">
        <div className="rounded-[12px] bg-[#0d0d10] p-4">
          <div className={`${M} flex flex-wrap items-center gap-2 text-[10px] tracking-[0.12em]`}>
            {["GRILL 4", "TANDOOR 2", "BAR 1", "EXPO"].map((s, i) => (
              <span key={s} className={`rounded-full px-2.5 py-1 ${i === 0 ? "bg-[var(--amber)] text-[#17140f]" : "bg-white/5 text-stone-400"}`}>
                {s}
              </span>
            ))}
            <span className="ml-auto text-stone-500">AVG 6:40</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {KDS.map((k, i) => (
              <div key={k.h} className={`rounded-[4px] bg-[#fbfaf7] text-[#17140f] ${i > 1 ? "max-sm:hidden" : ""}`}>
                <div className={`h-1.5 rounded-t-[4px] ${k.c}`} />
                <div className={`${M} p-2.5 text-[10px] leading-snug`}>
                  <div className="flex justify-between font-semibold">
                    <span className="text-[13px]">{k.h}</span>
                    <span className={k.c === "bg-red-500" ? "text-red-600" : ""}>{k.t}</span>
                  </div>
                  <div className="my-1.5 border-t border-dashed border-stone-300" />
                  {k.l.map((line, j) => (
                    <div key={line} className={i === 0 && j === 0 ? "text-stone-400 line-through" : ""}>
                      {line}
                    </div>
                  ))}
                  <div className="mt-2 rounded bg-[#17140f] py-1 text-center text-[9px] text-white">BUMP</div>
                </div>
              </div>
            ))}
          </div>
          <div className={`${M} mt-3 flex items-center gap-3 rounded-md bg-white/5 px-3 py-2 text-[10px] text-stone-400`}>
            <span className="text-[var(--amber)]">EXPO</span> T4 waiting on 3× GARLIC NAAN · tandoor
          </div>
        </div>
      </div>
    </div>
  );
}

const MENU = ["Chicken biryani", "Paneer tikka", "Masala dosa", "Mango lassi"];

export function QrMock() {
  return (
    <div aria-hidden="true" className="flex h-full items-center justify-center gap-4 p-4 sm:gap-8 sm:p-8">
      <Phone className="w-[200px] shrink-0">
        <div className="p-3 text-[#17140f]">
          <p className={`${M} text-[8px] tracking-[0.14em] text-stone-500`}>SPICE ROUTE · TABLE 12</p>
          <p className={`${D} mt-1 text-base font-bold`}>Mains</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {MENU.map((m, i) => (
              <div key={m} className="rounded-lg border border-stone-100 p-1">
                <Dish i={i} className="aspect-square" />
                <div className="mt-1 flex items-center justify-between gap-1">
                  <span className="truncate text-[8.5px] font-semibold">{m}</span>
                  <span className="grid size-4 shrink-0 place-items-center rounded-full bg-[var(--amber)] text-[10px] font-bold">+</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Phone>
      <Phone className="w-[200px] shrink-0 max-sm:hidden sm:mt-16">
        <div className="p-3 text-[#17140f]">
          <p className={`${M} text-[8px] tracking-[0.14em] text-stone-500`}>SHARED CART · 3 GUESTS</p>
          <div className="mt-2 space-y-1.5">
            {[
              ["R", "Rahul", "Chicken biryani", "bg-[#17140f]"],
              ["A", "Anna", "Paneer tikka", "bg-orange-500"],
              ["A", "Anna", "Mango lassi", "bg-orange-500"],
              ["S", "Sam", "Masala dosa", "bg-emerald-600"],
            ].map(([initial, who, item, bg]) => (
              <div key={item} className="flex items-center gap-1.5 rounded-lg bg-stone-50 px-2 py-1.5 text-[9px]">
                <span className={`grid size-4 shrink-0 place-items-center rounded-full text-[7px] font-bold text-white ${bg}`}>{initial}</span>
                <span className="flex-1 truncate">{item}</span>
                <span className="text-stone-400">{who}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-full bg-[var(--amber)] py-2 text-center text-[10px] font-bold">Send to kitchen · 4</div>
          <p className="mt-2 text-center text-[8px] text-stone-400">Everyone at the table sees this cart</p>
        </div>
      </Phone>
    </div>
  );
}

export function KioskMock() {
  return (
    <div aria-hidden="true" className="flex h-full items-end justify-center gap-6 p-4 pt-8 sm:p-8">
      <div className="flex w-[250px] shrink-0 flex-col items-center">
        <div className="w-full rounded-[18px] bg-[#1f1e22] p-2 shadow-[0_40px_80px_-30px_rgba(23,20,15,0.6)]">
          <div className="grid grid-cols-[46px_1fr] overflow-hidden rounded-[12px] bg-white text-[#17140f]">
            <div className="space-y-1 bg-stone-900 p-1.5 pt-3">
              {["Mains", "Dosa", "Drinks", "Sweet"].map((c, i) => (
                <div key={c} className={`rounded px-1 py-1.5 text-center text-[7px] font-semibold ${i === 0 ? "bg-[var(--amber)] text-[#17140f]" : "text-stone-400"}`}>
                  {c}
                </div>
              ))}
            </div>
            <div className="p-2">
              <p className={`${D} text-xs font-bold`}>What are you craving?</p>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i}>
                    <Dish i={i} className="aspect-[4/3]" />
                    <div className="mt-0.5 h-1 w-3/4 rounded bg-stone-200" />
                  </div>
                ))}
              </div>
              <div className="mt-2 rounded-full bg-[var(--amber)] py-1.5 text-center text-[9px] font-bold">Pay ₹640 by card</div>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between px-2">
            <span className="h-1.5 w-14 rounded-full bg-black" />
            <span className="size-3 rounded-sm bg-stone-600" />
          </div>
        </div>
        <div className="h-20 w-8 bg-gradient-to-b from-[#2a292e] to-[#161518]" />
        <div className="h-2.5 w-28 rounded-t-lg bg-[#2a292e]" />
      </div>
      <div className={`${M} mb-24 w-[150px] shrink-0 rotate-2 bg-white p-3 text-[9px] leading-snug text-[#17140f] shadow-xl max-sm:hidden`}>
        <p className="text-center tracking-[0.14em] text-stone-500">YOUR TOKEN</p>
        <p className={`${D} text-center text-4xl font-extrabold`}>48</p>
        <div className="my-2 border-t border-dashed border-stone-300" />
        <p>2× MASALA DOSA</p>
        <p>1× FILTER COFFEE</p>
        <div className="my-2 border-t border-dashed border-stone-300" />
        <p className="flex justify-between font-semibold">
          <span>CARD</span>
          <span>₹640</span>
        </p>
      </div>
    </div>
  );
}

export function OwnerMock() {
  const points = [30, 42, 38, 55, 48, 70, 62, 84, 76, 92];
  const path = points.map((p, i) => `${(i / (points.length - 1)) * 300},${100 - p}`).join(" L");
  return (
    <div aria-hidden="true" className="grid h-full place-items-center p-4 sm:p-8">
      <div className="w-full max-w-[680px] overflow-hidden rounded-xl border border-black/10 bg-white text-[#17140f] shadow-[0_40px_80px_-30px_rgba(23,20,15,0.5)]">
        <div className="flex items-center gap-1.5 border-b border-stone-200 bg-stone-50 px-3 py-2">
          {["bg-red-400", "bg-amber-400", "bg-emerald-400"].map((c) => (
            <span key={c} className={`size-2 rounded-full ${c}`} />
          ))}
          <span className={`${M} ml-3 rounded bg-white px-2 py-0.5 text-[9px] text-stone-400`}>restiq · owner console</span>
        </div>
        <div className="grid grid-cols-[120px_1fr] max-sm:grid-cols-1">
          <div className="space-y-1 border-r border-stone-200 p-3 text-[10px] max-sm:hidden">
            {["Dashboard", "Menu", "Floor plan", "Devices", "Staff", "Reports"].map((n, i) => (
              <div key={n} className={`rounded px-2 py-1.5 ${i === 0 ? "bg-[#17140f] font-semibold text-white" : "text-stone-500"}`}>
                {n}
              </div>
            ))}
          </div>
          <div className="p-4">
            <div className="grid grid-cols-3 gap-2">
              {[
                ["Sales today", "₹1,24,500", "+12%"],
                ["Orders", "312", "+8%"],
                ["Avg ticket", "₹399", "+3%"],
              ].map(([label, value, delta]) => (
                <div key={label} className="rounded-lg border border-stone-200 p-2.5">
                  <p className="text-[9px] text-stone-500">{label}</p>
                  <p className={`${D} mt-0.5 text-sm font-bold tabular-nums sm:text-base`}>{value}</p>
                  <p className="text-[9px] font-semibold text-emerald-600">{delta}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-stone-200 p-3">
              <p className="text-[9px] text-stone-500">Sales by hour · 3 outlets</p>
              <svg viewBox="0 0 300 100" className="mt-1 h-28 w-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="lp-area" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="#f59e0b" stopOpacity="0.35" />
                    <stop offset="1" stopColor="#f59e0b" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[25, 50, 75].map((y) => (
                  <line key={y} x1="0" x2="300" y1={y} y2={y} stroke="#e7e5e4" strokeWidth="0.5" />
                ))}
                <path d={`M${path} L300,100 L0,100 Z`} fill="url(#lp-area)" />
                <path d={`M${path}`} fill="none" stroke="#f59e0b" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                <circle cx="300" cy={100 - points[points.length - 1]} r="3" fill="#f59e0b" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Payment rail pictures.
export function TerminalMock() {
  return (
    <div aria-hidden="true" className="mx-auto w-[128px] rounded-[18px] bg-[#1f1e22] p-2 shadow-xl">
      <div className="flex items-center justify-between px-1 pb-1.5">
        <span className={`${M} text-[7px] tracking-[0.2em] text-stone-400`}>RESTIQ PAY</span>
        <span className="size-1.5 rounded-full bg-emerald-400" />
      </div>
      <div className="rounded-lg bg-[#e9f5ee] p-2.5 text-center text-[#17140f]">
        <div className="mx-auto grid size-7 place-items-center rounded-full bg-emerald-500 text-sm font-bold text-white">✓</div>
        <p className={`${M} mt-1.5 text-[8px] tracking-[0.14em] text-emerald-800`}>APPROVED</p>
        <p className={`${D} text-sm font-bold`}>₹1,220</p>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1">
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className="h-3.5 rounded-sm bg-white/10" />
        ))}
      </div>
    </div>
  );
}

export function DrawerMock() {
  return (
    <div aria-hidden="true" className={`${M} mx-auto w-full max-w-[220px] rounded-md bg-white p-3 text-[10px] leading-relaxed text-[#17140f] shadow-xl`}>
      <p className="text-center tracking-[0.14em] text-stone-500">SHIFT CLOSE · TILL 1</p>
      <div className="my-2 border-t border-dashed border-stone-300" />
      {[
        ["Expected", "₹18,420"],
        ["Counted", "₹18,380"],
      ].map(([k, v]) => (
        <p key={k} className="flex justify-between">
          <span>{k}</span>
          <span className="tabular-nums">{v}</span>
        </p>
      ))}
      <p className="flex justify-between font-semibold text-red-600">
        <span>Short</span>
        <span className="tabular-nums">−₹40</span>
      </p>
      <div className="my-2 border-t border-dashed border-stone-300" />
      <p className="text-center text-stone-500">recorded · locked</p>
    </div>
  );
}

// Setup step pictures.
export function SheetMini() {
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-lg border border-stone-200 bg-white text-[9px] text-[#17140f]">
      <div className="grid grid-cols-[1.4fr_1fr_0.7fr] bg-emerald-600 font-semibold text-white">
        {["Item", "Category", "Price"].map((h) => (
          <span key={h} className="px-2 py-1">
            {h}
          </span>
        ))}
      </div>
      {[
        ["Biryani", "Mains", "320"],
        ["Dosa", "Tiffin", "140"],
        ["Lassi", "Drinks", "120"],
      ].map((row) => (
        <div key={row[0]} className="grid grid-cols-[1.4fr_1fr_0.7fr] border-t border-stone-100">
          {row.map((c) => (
            <span key={c} className="px-2 py-1">
              {c}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function FloorMini() {
  return (
    <div aria-hidden="true" className="relative h-[78px] rounded-lg border border-dashed border-stone-300 bg-[linear-gradient(#e7e5e4_1px,transparent_1px),linear-gradient(90deg,#e7e5e4_1px,transparent_1px)] bg-[size:12px_12px]">
      <span className="absolute left-3 top-3 size-8 rounded-full border-2 border-stone-400 bg-white" />
      <span className="absolute left-14 top-4 h-7 w-12 rounded-md border-2 border-stone-400 bg-white" />
      <span className="absolute right-4 top-8 h-9 w-9 rounded-md border-2 border-[var(--amber)] bg-amber-50 shadow-md" />
      <span className="absolute bottom-2 left-6 h-6 w-16 rounded-md border-2 border-stone-400 bg-white" />
    </div>
  );
}

export function QrMini() {
  return (
    <div aria-hidden="true" className="flex h-[78px] items-center justify-center gap-3 rounded-lg bg-white">
      <div className="grid size-14 grid-cols-5 gap-px rounded bg-white p-1 ring-1 ring-stone-200">
        {Array.from({ length: 25 }, (_, i) => (
          <span key={i} className={(i * 7 + (i % 3)) % 3 !== 1 ? "bg-[#17140f]" : ""} />
        ))}
      </div>
      <span className="text-lg text-stone-400">→</span>
      <span className={`${M} rounded-md bg-emerald-50 px-2 py-1 text-[9px] font-semibold text-emerald-700`}>KDS · enrolled</span>
    </div>
  );
}

export function PinMini() {
  return (
    <div aria-hidden="true" className="flex h-[78px] items-center justify-center gap-3 rounded-lg bg-white">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`size-2.5 rounded-full ${i < 3 ? "bg-[#17140f]" : "border border-stone-300"}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <span key={n} className={`${M} grid size-5 place-items-center rounded bg-stone-100 text-[8px]`}>
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}
