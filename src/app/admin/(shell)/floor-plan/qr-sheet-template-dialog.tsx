"use client";

// "Customise sheet" (issue #175): owner-editable heading/instruction/toggle
// set/card size for the printed & downloaded QR sheet. Same Dialog primitive
// and mount-on-open shape as table-qr-dialog.tsx's TableQrDialog/DialogBody
// split: the outer component renders nothing while closed, so each open
// mounts a fresh DialogBody with the current template as its draft's initial
// state - no effect needed to resync a stale draft against a later prop
// change. Edits happen in that local draft so closing without saving
// (Escape, overlay click, the ✕) never touches the persisted template - only
// the Save button commits, mirroring AddFloorControl's discard-on-cancel
// behaviour elsewhere in this file tree.
import { Dialog } from "radix-ui";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { defaultQrSheetTemplate, QR_SHEET_CARD_SIZES, saveQrSheetTemplate, type QrSheetCardSize, type QrSheetTemplate } from "./qr-sheet-template";

const LABEL_CLASS = "font-label mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground";
const INPUT_CLASS = "w-full rounded-md border border-border bg-input px-2 py-1.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface QrSheetTemplateDialogProps {
  open: boolean;
  outletId: string;
  outletName: string;
  template: QrSheetTemplate;
  onSave: (template: QrSheetTemplate) => void;
  onClose: () => void;
}

export function QrSheetTemplateDialog({ open, outletId, outletName, template, onSave, onClose }: Readonly<QrSheetTemplateDialogProps>) {
  return open ? <DialogBody outletId={outletId} outletName={outletName} template={template} onSave={onSave} onClose={onClose} /> : null;
}

function DialogBody({
  outletId,
  outletName,
  template,
  onSave,
  onClose,
}: Readonly<Omit<QrSheetTemplateDialogProps, "open">>) {
  const [draft, setDraft] = useState(template);

  function save() {
    saveQrSheetTemplate(outletId, draft);
    onSave(draft);
    onClose();
  }

  return (
    <Dialog.Root open onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content
          data-testid="qr-template-dialog"
          className="admin-theme fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border/60 bg-popover p-6 text-foreground shadow-xl"
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="font-headline text-lg font-semibold">Customise QR sheet</Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              data-testid="qr-template-dialog-close"
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              ✕
            </Dialog.Close>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="qr-template-heading" className={LABEL_CLASS}>
                Heading
              </label>
              <input
                id="qr-template-heading"
                data-testid="qr-template-heading"
                value={draft.heading}
                onChange={(event) => setDraft((current) => ({ ...current, heading: event.target.value }))}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label htmlFor="qr-template-instruction" className={LABEL_CLASS}>
                Instruction
              </label>
              <input
                id="qr-template-instruction"
                data-testid="qr-template-instruction"
                value={draft.instruction}
                onChange={(event) => setDraft((current) => ({ ...current, instruction: event.target.value }))}
                className={INPUT_CLASS}
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                data-testid="qr-template-show-label"
                checked={draft.showTableLabel}
                onChange={(event) => setDraft((current) => ({ ...current, showTableLabel: event.target.checked }))}
              />
              Show table label
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                data-testid="qr-template-show-floor"
                checked={draft.showFloorName}
                onChange={(event) => setDraft((current) => ({ ...current, showFloorName: event.target.checked }))}
              />
              Show floor name
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                data-testid="qr-template-show-url"
                checked={draft.showUrl}
                onChange={(event) => setDraft((current) => ({ ...current, showUrl: event.target.checked }))}
              />
              Show URL
            </label>

            <div>
              <label htmlFor="qr-template-card-size" className={LABEL_CLASS}>
                Card size
              </label>
              <select
                id="qr-template-card-size"
                data-testid="qr-template-card-size"
                value={draft.cardSize}
                onChange={(event) => setDraft((current) => ({ ...current, cardSize: event.target.value as QrSheetCardSize }))}
                className={INPUT_CLASS}
              >
                {QR_SHEET_CARD_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 flex justify-between">
            <Button type="button" size="sm" variant="ghost" data-testid="qr-template-reset" onClick={() => setDraft(defaultQrSheetTemplate(outletName))}>
              Reset
            </Button>
            <Button type="button" size="sm" data-testid="qr-template-save" onClick={save}>
              Save
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
