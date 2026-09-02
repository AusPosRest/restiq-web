import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { QrPrintSheet, type PrintQrCard } from "./qr-print-sheet";

const CARDS: PrintQrCard[] = [
  { table: { id: "t1", label: "T1" }, floorName: "Ground Floor", url: "https://example.com/qr/t/outlet-1/t1", qrDataUrl: "data:image/png;base64,ONE" },
  { table: { id: "t2", label: "T2" }, floorName: "Terrace", url: "https://example.com/qr/t/outlet-1/t2", qrDataUrl: "data:image/png;base64,TWO" },
];

afterEach(() => cleanup());

describe("QrPrintSheet", () => {
  it("renders one card per table, each with its own QR image and URL", () => {
    render(<QrPrintSheet cards={CARDS} />);

    const t1 = screen.getByTestId("qr-print-card-t1");
    expect(t1.textContent).toContain("T1");
    expect(t1.textContent).toContain("Ground Floor");
    expect(t1.textContent).toContain("https://example.com/qr/t/outlet-1/t1");
    expect(t1.querySelector("img")?.getAttribute("src")).toBe("data:image/png;base64,ONE");

    const t2 = screen.getByTestId("qr-print-card-t2");
    expect(t2.textContent).toContain("T2");
    expect(t2.querySelector("img")?.getAttribute("src")).toBe("data:image/png;base64,TWO");
  });
});
