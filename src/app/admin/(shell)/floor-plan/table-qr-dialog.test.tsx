import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TableQrDialog } from "./table-qr-dialog";
import type { DiningTableView } from "./floor-plan-state";

const TABLE: DiningTableView = { id: "t1", floorId: "f1", label: "T1", x: 0, y: 0, width: 40, height: 40, shape: "square", seatCapacity: 4 };

// The qrcode package does real image-encoding work that's slow and
// irrelevant here - this dialog only needs to know it renders whatever
// data: URL toDataURL resolves with, not that qrcode's own encoding is
// correct (that's qrcode's own test suite's job).
vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn(() => Promise.resolve("data:image/png;base64,FAKE")) },
}));

Object.assign(navigator, { clipboard: { writeText: vi.fn(() => Promise.resolve()) } });

afterEach(() => cleanup());

describe("TableQrDialog", () => {
  it("shows the table's label, guest URL, and a QR image with a data: src", async () => {
    render(<TableQrDialog table={TABLE} outletId="outlet-1" qrOrderingEnabled onClose={vi.fn()} />);

    expect(screen.getByTestId("table-qr-dialog-label").textContent).toBe("T1");
    expect(screen.getByTestId("table-qr-dialog-url").textContent).toBe(`${window.location.origin}/qr/t/outlet-1/t1`);

    const image = await screen.findByTestId("table-qr-dialog-image");
    expect(image.getAttribute("src")).toMatch(/^data:/);
    expect(screen.queryByTestId("table-qr-dialog-capability-note")).toBeNull();
  });

  it("copies the guest URL to the clipboard", async () => {
    render(<TableQrDialog table={TABLE} outletId="outlet-1" qrOrderingEnabled onClose={vi.fn()} />);

    await userEvent.click(screen.getByTestId("table-qr-dialog-copy"));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${window.location.origin}/qr/t/outlet-1/t1`);
  });

  it("opens the guest URL in a new tab via the Open link", async () => {
    render(<TableQrDialog table={TABLE} outletId="outlet-1" qrOrderingEnabled onClose={vi.fn()} />);

    const open = screen.getByTestId("table-qr-dialog-open");
    expect(open.getAttribute("href")).toBe(`${window.location.origin}/qr/t/outlet-1/t1`);
    expect(open.getAttribute("target")).toBe("_blank");
  });

  it("shows a note when qr_ordering is off for the outlet, but still shows the QR", async () => {
    render(<TableQrDialog table={TABLE} outletId="outlet-1" qrOrderingEnabled={false} onClose={vi.fn()} />);

    expect(screen.getByTestId("table-qr-dialog-capability-note").textContent).toContain("Self-ordering is off for this outlet");
    await waitFor(() => expect(screen.getByTestId("table-qr-dialog-image")).toBeTruthy());
  });

  it("closes when the close button is clicked", async () => {
    const onClose = vi.fn();
    render(<TableQrDialog table={TABLE} outletId="outlet-1" qrOrderingEnabled onClose={onClose} />);

    await userEvent.click(screen.getByTestId("table-qr-dialog-close"));

    expect(onClose).toHaveBeenCalled();
  });

  it("renders nothing when no table is selected", () => {
    render(<TableQrDialog table={null} outletId="outlet-1" qrOrderingEnabled={null} onClose={vi.fn()} />);
    expect(screen.queryByTestId("table-qr-dialog")).toBeNull();
  });
});
