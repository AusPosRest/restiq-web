import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OPS_SESSION_COOKIE } from "@/lib/ops-session";
import { AutoRefresh } from "./auto-refresh";
import { linkify, type InboxMessage, type InboxResult } from "./inbox-state";

export const metadata: Metadata = { title: "Mail inbox" };
export const dynamic = "force-dynamic";

// Issue #325: every email the backend would have sent, when it runs with
// MAIL_PROVIDER=simulator (restiq-backend#198). Read server-side with the
// operator's session, so it needs no CORS.
async function fetchInbox(to: string | undefined): Promise<InboxResult | "unauthorized"> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return { kind: "unreachable" };
  const token = (await cookies()).get(OPS_SESSION_COOKIE)?.value;
  if (!token) return "unauthorized";
  try {
    const res = await fetch(`${apiUrl}/ops/v1/dev-inbox${to ? `?to=${encodeURIComponent(to)}` : ""}`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.status === 401) return "unauthorized";
    if (res.status === 404) return { kind: "off" };
    if (!res.ok) return { kind: "unreachable" };
    const body = (await res.json()) as { messages: InboxMessage[] };
    return { kind: "ok", messages: body.messages };
  } catch {
    return { kind: "unreachable" };
  }
}

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const to = (await searchParams).to?.trim() || undefined;
  const inbox = await fetchInbox(to);
  if (inbox === "unauthorized") redirect(`/ops/login?next=${encodeURIComponent("/ops/inbox")}&expired=1`);

  return (
    <section className="flex flex-1 flex-col">
      <AutoRefresh />
      <h1 className="font-headline text-2xl font-semibold">Mail inbox</h1>
      <p className="mt-1 text-sm text-muted-foreground">Emails RESTIQ would have sent, kept by the mail simulator. Nothing here left the building.</p>

      <form className="mt-6 flex max-w-3xl gap-2" action="/ops/inbox">
        <label htmlFor="inbox-to" className="sr-only">
          Email address
        </label>
        <input
          id="inbox-to"
          name="to"
          type="email"
          defaultValue={to}
          placeholder="Show one address, e.g. ravi@binflow.in"
          data-testid="inbox-filter"
          className="h-10 flex-1 rounded-lg border border-border bg-input px-3 text-sm"
        />
        <button type="submit" data-testid="inbox-filter-apply" className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
          Filter
        </button>
      </form>

      <div className="mt-6 max-w-3xl" data-testid="inbox">
        {inbox.kind === "off" && (
          <p data-testid="inbox-off" className="rounded-lg border border-border p-4 text-sm">
            The mail simulator is off. Start the backend with <code>MAIL_PROVIDER=simulator</code> to collect emails here.
          </p>
        )}
        {inbox.kind === "unreachable" && (
          <p data-testid="inbox-unreachable" role="alert" className="rounded-lg border border-status-alert p-4 text-sm">
            Couldn&apos;t reach the RESTIQ server. It retries every few seconds.
          </p>
        )}
        {inbox.kind === "ok" && inbox.messages.length === 0 && (
          <p data-testid="inbox-empty" className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No emails yet{to ? ` for ${to}` : ""}. New ones appear here on their own.
          </p>
        )}
        {inbox.kind === "ok" && inbox.messages.length > 0 && (
          <ul className="space-y-3">
            {inbox.messages.map((message, index) => (
              <li key={message.id}>
                <details open={index === 0} data-testid={`inbox-message-${message.id}`} className="rounded-lg border border-border bg-card">
                  <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
                    <span className="font-medium">{message.subject}</span>
                    <span className="text-sm text-muted-foreground">to {message.to}</span>
                    <time className="ml-auto text-xs text-muted-foreground" dateTime={message.sentAt}>
                      {new Date(message.sentAt).toLocaleString()}
                    </time>
                  </summary>
                  <p className="whitespace-pre-wrap break-words border-t border-border px-4 py-3 text-sm">
                    {linkify(message.text).map((part, i) =>
                      part.kind === "link" ? (
                        <a key={i} href={part.value} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">
                          {part.value}
                        </a>
                      ) : (
                        <span key={i}>{part.value}</span>
                      ),
                    )}
                  </p>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
