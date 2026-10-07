"use client";

// One "send this bill to the printer" button (issue #208), shared by settle
// and counter ("Print bill" - fires the spool directly, no invoice page in
// between) and by the invoice page ("Send to printer"). Pessimistic with a
// transient result on the button itself: Sending… → Sent to printer /
// Couldn't send → back to the label so a reprint is one more tap.
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { sendBillToPrinter } from "../api";

const RESET_MS = 2_000;
type SendState = "idle" | "sending" | "sent" | "failed";

export function PrintBillButton({
  billId,
  label,
  testId,
  size = "sm",
}: Readonly<{ billId: string; label: string; testId: string; size?: React.ComponentProps<typeof Button>["size"] }>) {
  const [state, setState] = useState<SendState>("idle");
  const reset = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => clearTimeout(reset.current ?? undefined), []);

  function send() {
    setState("sending");
    sendBillToPrinter(billId)
      .then(() => setState("sent"))
      .catch(() => setState("failed"))
      .finally(() => {
        reset.current = setTimeout(() => setState("idle"), RESET_MS);
      });
  }

  return (
    <Button type="button" size={size} variant="outline" data-testid={testId} disabled={state === "sending"} aria-live="polite" onClick={send}>
      {state === "sending" ? "Sending…" : state === "sent" ? "Sent to printer" : state === "failed" ? "Couldn't send" : label}
    </Button>
  );
}
