"use client";

// Bump/recall/refire (EXPERIENCE.md: "every action is a single tap with no
// confirmation... failed bump/recall re-queues the action visually and
// retries - the cook taps once, the system owns delivery"). One automatic
// retry after a short delay covers a transient blip without masking a real,
// persistent failure behind silent infinite retries - a still-failing action
// surfaces its error and stays re-tappable by another tap, same one-tap
// contract, rather than spinning forever.
import { useRef, useState } from "react";
import { bumpTicket, KdsApiError, recallTicket, refireTicket, type TicketView } from "../../api";

const RETRY_DELAY_MS = 2_000;

export interface TicketActions {
  /** Ticket ids with an action currently in flight (including its one auto-retry) - the button shows a busy state and ignores further taps. */
  pendingIds: ReadonlySet<string>;
  /** Ticket id -> the message from the most recent failed attempt, cleared on the next tap. */
  errors: Readonly<Record<string, string>>;
  bump: (ticketId: string) => void;
  recall: (ticketId: string) => void;
  refire: (ticketId: string) => void;
}

/** `onSettled` re-polls the board immediately on success (see use-station-queue.ts's `refresh`) so the board updates within this action, not the rest of the 5s interval. */
export function useTicketActions(onSettled: () => void): TicketActions {
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const retried = useRef<Set<string>>(new Set());

  function setPending(ticketId: string, isPending: boolean) {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (isPending) next.add(ticketId);
      else next.delete(ticketId);
      return next;
    });
  }

  function run(ticketId: string, action: (id: string) => Promise<TicketView>) {
    retried.current.delete(ticketId);
    setErrors((prev) => {
      if (!(ticketId in prev)) return prev;
      const rest = { ...prev };
      delete rest[ticketId];
      return rest;
    });
    setPending(ticketId, true);

    async function attempt() {
      try {
        await action(ticketId);
        setPending(ticketId, false);
        onSettled();
      } catch (error) {
        if (!retried.current.has(ticketId)) {
          retried.current.add(ticketId);
          setTimeout(() => void attempt(), RETRY_DELAY_MS);
          return;
        }
        setPending(ticketId, false);
        setErrors((prev) => ({ ...prev, [ticketId]: error instanceof KdsApiError ? error.message : "The action failed" }));
      }
    }

    void attempt();
  }

  return {
    pendingIds,
    errors,
    bump: (ticketId) => run(ticketId, bumpTicket),
    recall: (ticketId) => run(ticketId, recallTicket),
    refire: (ticketId) => run(ticketId, refireTicket),
  };
}
