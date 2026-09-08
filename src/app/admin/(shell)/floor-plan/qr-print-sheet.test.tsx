import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { QrPrintSheet, type PrintQrCard } from "./qr-print-sheet";
import { defaultQrSheetTemplate } from "./qr-sheet-template";

const CARDS: PrintQrCard[] = [
  { table: { id: "t1", label: "T1" }, floorName: "Ground Floor", url: "https://example.com/qr/t/outlet-1/t1", qrDataUrl: "data:image/png;base64,ONE" },
  { table: { id: "t2", label: "T2" }, floorName: "Terrace", url: "https://example.com/qr/t/outlet-1/t2", qrDataUrl: "data:image/png;base64,TWO" },
];

const TEMPLATE = defaultQrSheetTemplate("Indiranagar");

afterEach(() => cleanup());

describe("QrPrintSheet", () => {
  it("renders one card per table, each with its own QR image and URL", () => {
    render(<QrPrintSheet cards={CARDS} template={TEMPLATE} />);

    const t1 = screen.getByTestId("qr-print-card-t1");
    expect(t1.textContent).toContain("T1");
    expect(t1.textContent).toContain("Ground Floor");
    expect(t1.textContent).toContain("https://example.com/qr/t/outlet-1/t1");
    expect(t1.querySelector("img")?.getAttribute("src")).toBe("data:image/png;base64,ONE");

    const t2 = screen.getByTestId("qr-print-card-t2");
    expect(t2.textContent).toContain("T2");
    expect(t2.querySelector("img")?.getAttribute("src")).toBe("data:image/png;base64,TWO");
  });

  it("shows the template's heading and instruction once at the top of the sheet", () => {
    render(<QrPrintSheet cards={CARDS} template={{ ...TEMPLATE, heading: "Indiranagar Diner", instruction: "Scan to order" }} />);

    const header = screen.getByTestId("qr-print-sheet-header");
    expect(header.textContent).toContain("Indiranagar Diner");
    expect(header.textContent).toContain("Scan to order");
  });

  it("hides the header entirely when both heading and instruction are blank", () => {
    render(<QrPrintSheet cards={CARDS} template={{ ...TEMPLATE, heading: "", instruction: "" }} />);
    expect(screen.queryByTestId("qr-print-sheet-header")).toBeNull();
  });

  it("hides per-card fields whose toggle is off, but keeps the QR image accessible", () => {
    render(<QrPrintSheet cards={CARDS} template={{ ...TEMPLATE, showTableLabel: false, showFloorName: false, showUrl: false }} />);

    const t1 = screen.getByTestId("qr-print-card-t1");
    expect(t1.textContent).not.toContain("Ground Floor");
    expect(t1.textContent?.trim()).toBe("");
    expect(t1.querySelector("img")?.getAttribute("alt")).toBe("Self-order QR code for T1");
  });

  it("sizes the QR image per the template's card size", () => {
    render(<QrPrintSheet cards={CARDS} template={{ ...TEMPLATE, cardSize: "large" }} />);
    expect(screen.getByTestId("qr-print-card-t1").querySelector("img")).toHaveProperty("width", 260);
  });
});
