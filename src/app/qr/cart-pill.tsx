"use client";

// DESIGN.md's CartPill: "floating item-count + total, opens Table Order".
// This story (CAP-2, issue #67) builds the pill itself, reading the real
// shared cart through useCartSummary (cart-summary.ts) - not a fake stub
// count, the genuine `GET /guest/v1/cart` total - and links to CAP-3's Q5
// shared-cart review screen at /qr/cart (it was a placeholder no-op until
// that route landed; wired in restiq-web#132).
//
// EXPERIENCE.md State Patterns: "an empty shared cart invites..." - an empty
// cart shows no pill at all rather than a hollow "0 items" one.
import Link from "next/link";
import { useCartSummary } from "./cart-summary";

const CURRENCY_SYMBOLS: Record<string, string> = { INR: "₹" };

function formatTotal(totalMinor: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  return `${symbol}${(totalMinor / 100).toFixed(0)}`;
}

export interface CartPillProps {
  /** Item Detail (Q4) already has its own sticky Add to Cart bar - the pill stacks above it there instead of at the very bottom. */
  stackAboveActionBar?: boolean;
}

export function CartPill({ stackAboveActionBar = false }: Readonly<CartPillProps> = {}) {
  const { summary } = useCartSummary();
  if (summary.count === 0) return null;

  return (
    <Link
      href="/qr/cart"
      data-testid="qr-cart-pill"
      aria-label={`View cart, ${summary.count} item${summary.count === 1 ? "" : "s"}`}
      className={`fixed inset-x-4 z-30 flex items-center justify-between rounded-xl bg-primary px-5 py-3.5 text-primary-foreground shadow-lg ${stackAboveActionBar ? "bottom-24" : "bottom-4"}`}
    >
      <span className="text-sm font-semibold">
        {summary.count} item{summary.count === 1 ? "" : "s"} · {formatTotal(summary.totalMinor, summary.currency)}
      </span>
      <span aria-hidden="true" className="text-sm font-semibold">
        View Cart →
      </span>
    </Link>
  );
}
