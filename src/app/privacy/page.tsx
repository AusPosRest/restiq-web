// Public privacy policy (issue #435). Static server component, no auth, no
// client JS. The proxy matcher only covers /ops /admin /pos /kds /qr, so this
// path is reachable on tenant subdomains too.
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy policy · RESTIQ",
  description: "How RESTIQ collects, uses, shares and protects personal information.",
};

// Fill these in one place before publishing.
const ENTITY = {
  name: "[BUSINESS LEGAL NAME]",
  abn: "[ABN]",
  email: "[CONTACT EMAIL]",
  address: "[POSTAL ADDRESS]",
};
const LAST_UPDATED = "13 November 2026";

const H2 = "mt-10 text-xl font-semibold text-white";
const UL = "mt-3 list-disc space-y-2 pl-5";

export default function PrivacyPage() {
  return (
    <div className="flex-1 bg-[#131315] text-stone-300 antialiased">
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-4 sm:px-6">
          <Link href="/" data-testid="privacy-home" className="rounded-md text-lg font-extrabold tracking-tight text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
            RESTIQ
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12 text-base leading-relaxed sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Privacy policy</h1>
        <p className="mt-3 text-sm text-stone-400" data-testid="privacy-updated">Last updated: {LAST_UPDATED}</p>

        <section aria-labelledby="who">
          <h2 id="who" className={H2}>Who we are</h2>
          <p className="mt-3">
            RESTIQ is a restaurant point-of-sale platform for Australia and India, operated by {ENTITY.name} (ABN {ENTITY.abn}), {ENTITY.address}. This policy explains how we handle personal
            information under the Australian Privacy Act 1988 (including the Australian Privacy Principles) and India&apos;s Digital Personal Data Protection Act 2023.
          </p>
          <p className="mt-3">
            Restaurants are our customers. For their guests&apos; and staff data we act on the restaurant&apos;s behalf; for restaurant owner accounts and the service itself we decide how data is used.
          </p>
        </section>

        <section aria-labelledby="collect">
          <h2 id="collect" className={H2}>What we collect</h2>
          <ul className={UL}>
            <li>Owner and staff accounts: names, email addresses and a phone number if provided. Staff sign in with a 4-digit PIN, which we store only as a hash, never in plain text.</li>
            <li>Restaurant data: menus, orders, bills, refunds, shift reports and tax invoices, including tax registration details such as GSTIN or ABN, and menu photos and branding you upload.</li>
            <li>Devices: POS, kitchen display, printer and kiosk devices are enrolled with one-time codes; we store the identifiers needed to recognise those devices.</li>
            <li>Audit records: changes such as voids, discounts and manager approvals are logged against the staff member who made them.</li>
            <li>Guest orders: guests ordering by QR code or kiosk do not create an account. Orders may include a name the guest chooses to enter. Card details are entered with Stripe and never reach or get stored by RESTIQ; we keep only the payment status and a reference.</li>
          </ul>
        </section>

        <section aria-labelledby="use">
          <h2 id="use" className={H2}>How we use it</h2>
          <p className="mt-3">
            To provide and secure the service: signing people in, taking and settling orders, issuing tax invoices, running reports, enrolling devices, keeping an audit trail, billing restaurants and
            supporting them. We do not sell personal information and we do not use it for advertising.
          </p>
        </section>

        <section aria-labelledby="share">
          <h2 id="share" className={H2}>Who we share it with</h2>
          <p className="mt-3">Only service providers that process data for us:</p>
          <ul className={UL}>
            <li>Stripe, to process card payments and card readers.</li>
            <li>Cloudflare, which serves the web app.</li>
            <li>Fly.io, which hosts our API.</li>
            <li>Neon, which hosts our PostgreSQL database.</li>
          </ul>
          <p className="mt-3">We may also disclose information where the law requires it. Some of these providers store data outside Australia and India, including in the United States.</p>
        </section>

        <section aria-labelledby="retention">
          <h2 id="retention" className={H2}>How long we keep it</h2>
          <p className="mt-3">
            Records that tax law requires restaurants to keep, such as invoices and bills, are kept for the legally required period. Other personal information is deleted or de-identified when a restaurant
            closes its account or when a valid request asks us to, once we no longer need it.
          </p>
        </section>

        <section aria-labelledby="security">
          <h2 id="security" className={H2}>Security</h2>
          <ul className={UL}>
            <li>Data is encrypted in transit over HTTPS.</li>
            <li>Each restaurant&apos;s data is isolated from every other restaurant&apos;s.</li>
            <li>Staff PINs are stored hashed, and sensitive actions need a manager&apos;s approval.</li>
          </ul>
          <p className="mt-3">No system is perfectly secure. If a breach is likely to cause serious harm we will notify affected people and the regulator as the law requires.</p>
        </section>

        <section aria-labelledby="cookies">
          <h2 id="cookies" className={H2}>Cookies</h2>
          <p className="mt-3">
            We use session cookies only to keep staff, owners and operators signed in. We do not use advertising or analytics trackers.
          </p>
        </section>

        <section aria-labelledby="rights">
          <h2 id="rights" className={H2}>Your rights: access, correction and deletion</h2>
          <p className="mt-3">
            You can ask to access, correct or delete personal information we hold about you, or withdraw consent where we rely on it, by emailing{" "}
            <a href={`mailto:${ENTITY.email}`} data-testid="privacy-email" className="text-amber-400 underline underline-offset-2">{ENTITY.email}</a>. If your data belongs to a restaurant&apos;s
            guest or staff records, we may refer you to that restaurant. We respond within a reasonable time, and you can complain to us first. If unsatisfied, you may contact the Office of the Australian
            Information Commissioner (Australia) or the Data Protection Board of India.
          </p>
        </section>

        <section aria-labelledby="children">
          <h2 id="children" className={H2}>Children</h2>
          <p className="mt-3">RESTIQ is a business tool and is not directed at children. Accounts are created by restaurant owners and operators for adults.</p>
        </section>

        <section aria-labelledby="changes">
          <h2 id="changes" className={H2}>Changes to this policy</h2>
          <p className="mt-3">We may update this policy. The date at the top shows the latest version.</p>
        </section>

        <section aria-labelledby="contact">
          <h2 id="contact" className={H2}>Contact us</h2>
          <p className="mt-3">
            {ENTITY.name}, {ENTITY.address}. Email {ENTITY.email}.
          </p>
        </section>
      </main>
    </div>
  );
}
