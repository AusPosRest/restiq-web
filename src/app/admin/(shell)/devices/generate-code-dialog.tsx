"use client";

// "Enrol device" dialog: pick a device type, generate a one-time code. Unlike
// Platform Console's fleet-wide version, the outlet is already fixed by the
// shell's outlet switcher, so there's no tenant/outlet picker - only device
// type.
import { Dialog } from "radix-ui";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AdminApiError, generateEnrolmentCode } from "../../api";
import { useToast } from "../toast";
import { CodeChip } from "./code-chip";
import { DEVICE_TYPE_LABELS, DEVICE_TYPE_OPTIONS, type DeviceType, type EnrolmentCodeResult } from "./devices-state";

const SELECT_CLASSES =
  "h-10 w-full rounded-lg border border-border bg-input px-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

interface GenerateCodeDialogProps {
  open: boolean;
  onClose: () => void;
  outletId: string;
  onGenerated: (result: EnrolmentCodeResult) => void;
}

export function GenerateCodeDialog(props: Readonly<GenerateCodeDialogProps>) {
  return props.open ? <DialogBody key="open" {...props} /> : null;
}

function DialogBody({ onClose, outletId, onGenerated }: Readonly<GenerateCodeDialogProps>) {
  const toast = useToast();
  const [deviceType, setDeviceType] = useState<DeviceType>(DEVICE_TYPE_OPTIONS[0]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<EnrolmentCodeResult | null>(null);

  async function generate() {
    setBusy(true);
    try {
      const res = await generateEnrolmentCode(outletId, deviceType);
      setResult(res);
      onGenerated(res);
    } catch (error) {
      toast({ kind: "error", message: error instanceof AdminApiError ? error.message : "Could not generate an enrolment code." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content
          data-testid="generate-code-dialog"
          className="admin-theme fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto border-l border-border/60 bg-popover p-6 text-foreground shadow-xl"
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="font-headline text-lg font-semibold">Enrol a device</Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              data-testid="generate-code-close"
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              ✕
            </Dialog.Close>
          </div>

          <div className="mt-5 grid gap-4">
            <div>
              <label className="font-label mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Device Type
              </label>
              <select
                data-testid="generate-code-type"
                value={deviceType}
                disabled={result !== null}
                onChange={(event) => setDeviceType(event.target.value as DeviceType)}
                className={SELECT_CLASSES}
              >
                {DEVICE_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {DEVICE_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>

            {result && (
              <CodeChip key={result.code} code={result.code} expiresAt={result.expiresAt} onRegenerate={() => void generate()} regenerating={busy} />
            )}
          </div>

          <div className="mt-6 flex justify-end">
            {result ? (
              <Button data-testid="generate-code-done" onClick={onClose}>
                Done
              </Button>
            ) : (
              <Button data-testid="generate-code-submit" disabled={busy} onClick={() => void generate()}>
                {busy ? "Generating..." : "Generate code"}
              </Button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
