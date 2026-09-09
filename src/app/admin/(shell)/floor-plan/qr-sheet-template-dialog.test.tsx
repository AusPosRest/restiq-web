import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QrSheetTemplateDialog } from "./qr-sheet-template-dialog";
import { defaultQrSheetTemplate, loadQrSheetTemplate } from "./qr-sheet-template";

const TEMPLATE = defaultQrSheetTemplate("Indiranagar Diner");

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("QrSheetTemplateDialog", () => {
  it("renders nothing when closed", () => {
    render(<QrSheetTemplateDialog open={false} outletId="outlet-1" outletName="Indiranagar Diner" template={TEMPLATE} onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByTestId("qr-template-dialog")).toBeNull();
  });

  it("saves edits, persists them for the outlet, and closes", async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<QrSheetTemplateDialog open outletId="outlet-1" outletName="Indiranagar Diner" template={TEMPLATE} onSave={onSave} onClose={onClose} />);

    const heading = screen.getByTestId("qr-template-heading");
    await userEvent.clear(heading);
    await userEvent.type(heading, "Scan me");
    await userEvent.click(screen.getByTestId("qr-template-show-url"));
    await userEvent.selectOptions(screen.getByTestId("qr-template-card-size"), "large");
    await userEvent.click(screen.getByTestId("qr-template-save"));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ heading: "Scan me", showUrl: false, cardSize: "large" }));
    expect(onClose).toHaveBeenCalled();
    expect(loadQrSheetTemplate("outlet-1", "Indiranagar Diner")).toEqual(expect.objectContaining({ heading: "Scan me", showUrl: false, cardSize: "large" }));
  });

  it("resets the draft to the outlet's defaults without saving or closing", async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    const edited = { ...TEMPLATE, heading: "Custom heading", showTableLabel: false };
    render(<QrSheetTemplateDialog open outletId="outlet-1" outletName="Indiranagar Diner" template={edited} onSave={onSave} onClose={onClose} />);

    expect(screen.getByTestId("qr-template-heading")).toHaveProperty("value", "Custom heading");

    await userEvent.click(screen.getByTestId("qr-template-reset"));

    expect(screen.getByTestId("qr-template-heading")).toHaveProperty("value", "Indiranagar Diner");
    expect(screen.getByTestId("qr-template-show-label")).toHaveProperty("checked", true);
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("discards edits made before Save when closed via the ✕ button", async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<QrSheetTemplateDialog open outletId="outlet-1" outletName="Indiranagar Diner" template={TEMPLATE} onSave={onSave} onClose={onClose} />);

    await userEvent.type(screen.getByTestId("qr-template-heading"), " edited");
    await userEvent.click(screen.getByTestId("qr-template-dialog-close"));

    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(loadQrSheetTemplate("outlet-1", "Indiranagar Diner")).toEqual(TEMPLATE);
  });
});
