"use client";

// Print bill (issue #224): sends the bill straight to this POS's printer - the
// one linked to it, else the outlet's shared one - instead of opening the
// invoice page in a new tab, which in an installed app lands in the browser,
// signed out, and never prints.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { sendBillToPrinter } from "./api";

const LABEL = { idle: "Print bill", sending: "Printing…", sent: "Sent to printer", failed: "Couldn't print" } as const;

export function PrintBillButton({ billId }: Readonly<{ billId: string }>) {
  const [state, setState] = useState<keyof typeof LABEL>("idle");

  function print() {
    setState("sending");
    sendBillToPrinter(billId)
      .then(() => setState("sent"))
      .catch(() => setState("failed"))
      .finally(() => setTimeout(() => setState("idle"), 2000));
  }

  return (
    <Button size="lg" variant="outline" data-testid="print-bill" aria-live="polite" disabled={state === "sending"} onClick={print}>
      {LABEL[state]}
    </Button>
  );
}
