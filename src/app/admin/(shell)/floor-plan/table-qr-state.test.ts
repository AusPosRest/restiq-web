import { describe, expect, it } from "vitest";
import { guestOrderUrl, qrPngFilename, qrSheetHtml } from "./table-qr-state";

describe("guestOrderUrl", () => {
  it("builds the exact guest self-order route the QR must point at", () => {
    expect(guestOrderUrl("https://app.example.com", "outlet-1", "t1")).toBe("https://app.example.com/qr/t/outlet-1/t1");
  });
});

describe("qrPngFilename", () => {
  it("keeps word characters and dashes, replaces the rest", () => {
    expect(qrPngFilename("T-1")).toBe("T-1-qr.png");
    expect(qrPngFilename("Patio / 2")).toBe("Patio_2-qr.png");
  });
});

describe("qrSheetHtml", () => {
  it("renders one card per table with its QR, and escapes owner-entered labels", () => {
    const html = qrSheetHtml([
      { table: { id: "t1", label: "<b>T1</b>" }, floorName: "Ground & Co", url: "https://example.com/qr/t/o/t1", qrDataUrl: "data:image/png;base64,ONE" },
      { table: { id: "t2", label: "T2" }, floorName: "Terrace", url: "https://example.com/qr/t/o/t2", qrDataUrl: "data:image/png;base64,TWO" },
    ]);

    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).not.toContain("<b>T1</b>");
    expect(html).toContain("&#60;b&#62;T1&#60;/b&#62;");
    expect(html).toContain("Ground &#38; Co");
    expect(html).toContain('src="data:image/png;base64,ONE"');
    expect(html).toContain('src="data:image/png;base64,TWO"');
    expect(html).toContain("https://example.com/qr/t/o/t2");
  });
});
