import Link from "next/link";
import { DEMO_STAFF } from "./demo-logins";
import { CredentialValue } from "./landing-credential";
import { deviceOpenHref, fetchLandingDevices } from "./landing-devices";

// The public landing page: one door per user surface. RESTIQ has five disjoint
// auth realms (ops/admin/pos/kds-on-pos/guest) plus the device-enrolment realm,
// each with its own entry route - this page just routes a person to the right
// one and shows the demo credentials, since this is a prototype with no real
// sign-up. Rendered in the charcoal+amber "ops-theme" (globals.css), the
// closest thing RESTIQ has to a house identity.

interface Surface {
  name: string;
  who: string;
  blurb: string;
  href: string;
  cta: string;
  creds: { label: string; value: string }[];
  external?: boolean;
}

// Guest QR entry needs a real outlet+table; this is the seeded demo table with
// the qr_ordering capability enabled (Spice Route outlet, table T1).
const GUEST_QR = "/qr/t/01a042f2-8e56-733d-ad2e-739163950988/22222222-2222-7222-8222-222222220001";

const SURFACES: Surface[] = [
  {
    name: "Platform Console",
    who: "Internal operator",
    blurb: "Onboard tenants, manage plans, devices and fleet health across every restaurant.",
    href: "/ops/login",
    cta: "Operator sign in",
    creds: [
      { label: "Email", value: "admin@restiq.example" },
      { label: "Password", value: "OpsDemo2026!" },
    ],
  },
  {
    name: "Tenant Admin",
    who: "Restaurant owner",
    blurb: "The owner console: go-live checklist, menu, floor plan, staff, devices and branding.",
    href: "/admin",
    cta: "Open owner console",
    creds: [{ label: "Access", value: "By owner invite link (no password login yet)" }],
  },
  {
    name: "POS · Cashier & Waiter",
    who: "Floor staff",
    blurb: "Table map, order taking, fire-to-kitchen and bill settlement on a tablet till.",
    href: "/pos/login",
    cta: "PIN sign in",
    creds: [{ label: "PINs", value: "See the staff logins table below" }],
  },
  {
    name: "Kitchen Display",
    who: "Kitchen",
    blurb: "Live station queues, ticket ageing, bump / recall / refire and the all-day summary.",
    href: "/kds",
    cta: "Open kitchen display",
    creds: [{ label: "Access", value: "Signs in with the same POS PINs" }],
  },
  {
    name: "Guest QR Self-Order",
    who: "Diner",
    blurb: "Scan the table QR, browse the menu, build a shared cart and pay - no app, no staff.",
    href: GUEST_QR,
    cta: "Try the guest flow",
    creds: [{ label: "Access", value: "No login - a table session PIN is shown on screen" }],
  },
  {
    name: "Enrol a Device",
    who: "Any browser",
    blurb: "Turn this browser tab into a POS or KDS terminal with a one-time code from the console.",
    href: "/device",
    cta: "Enrol this browser",
    creds: [{ label: "Access", value: "Generate a code in the ops or admin console" }],
  },
];

export const metadata = {
  title: "RESTIQ",
  description: "Multi-tenant restaurant POS - choose your surface",
};

// Devices/staff-logins below fetch live data server-side on every request -
// prerendering at build time would either need the backend reachable during
// `next build` or bake in a stale snapshot.
export const dynamic = "force-dynamic";

export default async function Home() {
  const devicesResult = await fetchLandingDevices();

  return (
    <div className="ops-theme min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-12 sm:py-16">
        <header className="flex flex-col gap-3">
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold tracking-tight text-primary">RESTIQ</span>
            <span
              className="rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              data-testid="landing-env-badge"
            >
              Demo
            </span>
          </div>
          <h1 className="max-w-2xl text-3xl font-semibold leading-tight text-balance sm:text-4xl">
            Restaurant point of sale, from the back office to the table.
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Six surfaces, one platform. Pick the door for who you are - every demo login is listed on its
            card.
          </p>
        </header>

        <main className="mt-10 grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="landing-surfaces">
          {SURFACES.map((s) => (
            <div
              key={s.name}
              data-testid={`landing-card-${s.href}`}
              className="group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary focus-within:border-primary"
            >
              <div className="flex flex-col gap-1">
                <span className="font-label text-[11px] font-semibold uppercase tracking-wider text-primary">
                  {s.who}
                </span>
                <span className="text-lg font-semibold">{s.name}</span>
              </div>
              <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{s.blurb}</p>
              <dl className="relative z-10 flex flex-col gap-0.5 rounded-lg bg-muted/60 px-2 py-2 text-xs">
                {s.creds.map((c) => (
                  <div key={c.label} className="flex items-center justify-between gap-3">
                    <dt className="shrink-0 pl-1 font-medium text-muted-foreground">{c.label}</dt>
                    <dd className="min-w-0">
                      <CredentialValue label={c.label} value={c.value} />
                    </dd>
                  </div>
                ))}
              </dl>
              {/* Stretched link: the whole card is clickable, but the copy
                  buttons above (z-10) intercept their own clicks. */}
              <Link
                href={s.href}
                className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-primary after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none"
              >
                {s.cta}
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
            </div>
          ))}
        </main>

        <section className="mt-12 flex flex-col gap-3" data-testid="landing-devices">
          <h2 className="text-lg font-semibold">Devices (live)</h2>
          {devicesResult.kind === "unavailable" ? (
            <p className="text-sm text-muted-foreground" data-testid="landing-devices-unavailable">
              Device list unavailable - backend not reachable.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[640px] text-left text-sm" data-testid="landing-devices-table">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Device</th>
                    <th className="px-3 py-2 font-medium">Tenant</th>
                    <th className="px-3 py-2 font-medium">Outlet</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {devicesResult.devices.map((d) => {
                    const openHref = deviceOpenHref(d);
                    return (
                      <tr key={d.id} className="border-b border-border/60 last:border-0" data-testid={`landing-device-${d.id}`}>
                        <td className="px-3 py-2 font-medium">{d.label}</td>
                        <td className="px-3 py-2 text-muted-foreground">{d.tenantName}</td>
                        <td className="px-3 py-2 text-muted-foreground">{d.outletName ?? "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs uppercase">{d.type}</td>
                        <td className="px-3 py-2 text-muted-foreground">{d.status}</td>
                        <td className="px-3 py-2">
                          {openHref ? (
                            <Link
                              href={openHref}
                              target="_blank"
                              rel="noreferrer"
                              className="font-semibold text-primary"
                              data-testid={`landing-device-open-${d.id}`}
                            >
                              Open
                            </Link>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-12 flex flex-col gap-3" data-testid="landing-staff-logins">
          <h2 className="text-lg font-semibold">Staff logins</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[560px] text-left text-sm" data-testid="landing-staff-table">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Tenant</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">PIN</th>
                  <th className="px-3 py-2 font-medium">Open</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_STAFF.map((staff) => (
                  <tr
                    key={`${staff.tenant}-${staff.name}`}
                    className="border-b border-border/60 last:border-0"
                    data-testid={`landing-staff-${staff.name}`}
                  >
                    <td className="px-3 py-2 text-muted-foreground">{staff.tenant}</td>
                    <td className="px-3 py-2 font-medium">{staff.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{staff.role}</td>
                    <td className="px-3 py-2">
                      <CredentialValue label={`${staff.name} PIN`} value={staff.pin} />
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href="/pos/login"
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-primary"
                        data-testid={`landing-staff-open-${staff.name}`}
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="mt-12 border-t border-border pt-6 text-xs text-muted-foreground">
          RESTIQ is a working prototype. All logins above are seeded demo accounts - see the full testing
          guide in <span className="font-mono">wiki/testing-credentials.md</span>.
        </footer>
      </div>
    </div>
  );
}
