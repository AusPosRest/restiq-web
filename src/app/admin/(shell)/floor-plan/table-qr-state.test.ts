import { afterEach, describe, expect, it, vi } from "vitest";
import { guestOrderUrl, qrPngFilename, qrSheetHtml, qrZipPngFilename, renderTableQrPng, slug } from "./table-qr-state";
import { defaultQrSheetTemplate } from "./qr-sheet-template";

const TEMPLATE = defaultQrSheetTemplate("Indiranagar Diner");

vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn(() => Promise.resolve("data:image/png;base64,FAKE")) },
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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

describe("slug", () => {
  it("lowercases and dash-separates, stripping anything that isn't alphanumeric", () => {
    expect(slug("Ground Floor")).toBe("ground-floor");
    expect(slug("Patio / 2")).toBe("patio-2");
    expect(slug("  T-1  ")).toBe("t-1");
  });

  it("falls back to a placeholder rather than an empty segment", () => {
    expect(slug("")).toBe("item");
    expect(slug("###")).toBe("item");
  });
});

describe("qrZipPngFilename", () => {
  it("combines the floor and table slugs into one ZIP entry name", () => {
    expect(qrZipPngFilename("Ground Floor", "T-1")).toBe("ground-floor-t-1-qr.png");
  });
});

describe("qrSheetHtml", () => {
  const CARDS = [
    { table: { id: "t1", label: "<b>T1</b>" }, floorName: "Ground & Co", url: "https://example.com/qr/t/o/t1", qrDataUrl: "data:image/png;base64,ONE" },
    { table: { id: "t2", label: "T2" }, floorName: "Terrace", url: "https://example.com/qr/t/o/t2", qrDataUrl: "data:image/png;base64,TWO" },
  ];

  it("renders one card per table with its QR, and escapes owner-entered labels", () => {
    const html = qrSheetHtml(CARDS, TEMPLATE);

    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).not.toContain("<b>T1</b>");
    expect(html).toContain("&#60;b&#62;T1&#60;/b&#62;");
    expect(html).toContain("Ground &#38; Co");
    expect(html).toContain('src="data:image/png;base64,ONE"');
    expect(html).toContain('src="data:image/png;base64,TWO"');
    expect(html).toContain("https://example.com/qr/t/o/t2");
  });

  it("shows the template's heading and instruction once, escaped, at the top of the sheet", () => {
    const html = qrSheetHtml(CARDS, { ...TEMPLATE, heading: "<b>Diner</b>", instruction: "Scan & order" });
    expect(html).toContain("<header>");
    expect(html).toContain("&#60;b&#62;Diner&#60;/b&#62;");
    expect(html).toContain("Scan &#38; order");
  });

  it("omits the header entirely when heading and instruction are both blank", () => {
    const html = qrSheetHtml(CARDS, { ...TEMPLATE, heading: "", instruction: "" });
    expect(html).not.toContain("<header>");
  });

  it("drops a per-card field's markup when its toggle is off", () => {
    const html = qrSheetHtml(CARDS, { ...TEMPLATE, showFloorName: false, showTableLabel: false, showUrl: false });
    expect(html).not.toContain("Terrace");
    expect(html).not.toContain("<h2>T2</h2>");
    expect(html).not.toContain("https://example.com/qr/t/o/t2");
    // The QR image itself, and its accessible alt text, always stay.
    expect(html).toContain('src="data:image/png;base64,TWO"');
    expect(html).toContain('alt="Self-order QR code for T2"');
  });

  it("sizes the QR image per the template's card size", () => {
    const html = qrSheetHtml(CARDS, { ...TEMPLATE, cardSize: "large" });
    expect(html).toContain("width:64mm;height:64mm");
  });
});

describe("renderTableQrPng", () => {
  function stubImage() {
    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = "";
      get src() {
        return this._src;
      }
      set src(value: string) {
        this._src = value;
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal("Image", FakeImage);
  }

  function stubCanvas() {
    const fillText = vi.fn();
    const drawImage = vi.fn();
    const toDataURL = vi.fn(() => "data:image/png;base64,COMPOSITE");
    const context = { fillStyle: "", font: "", textAlign: "", textBaseline: "", fillRect: vi.fn(), fillText, drawImage };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(toDataURL);
    return { fillText, drawImage, toDataURL };
  }

  it("returns the plain QR untouched when every per-card toggle is off", async () => {
    const png = await renderTableQrPng({ label: "T1" }, "Ground Floor", "https://example.com/qr/t/o/t1", {
      ...TEMPLATE,
      showTableLabel: false,
      showFloorName: false,
      showUrl: false,
    });
    expect(png).toBe("data:image/png;base64,FAKE");
  });

  it("composites the heading, instruction, and enabled per-card fields onto a canvas", async () => {
    stubImage();
    const { fillText, drawImage, toDataURL } = stubCanvas();

    const png = await renderTableQrPng({ label: "T1" }, "Ground Floor", "https://example.com/qr/t/o/t1", {
      ...TEMPLATE,
      heading: "Indiranagar Diner",
      instruction: "Scan to order",
    });

    expect(drawImage).toHaveBeenCalledOnce();
    const [drawnImage] = drawImage.mock.calls[0] as [{ src: string }];
    expect(drawnImage.src).toBe("data:image/png;base64,FAKE");
    const texts = fillText.mock.calls.map((call) => call[0]);
    expect(texts).toContain("Indiranagar Diner");
    expect(texts).toContain("Scan to order");
    expect(texts).toContain("Ground Floor");
    expect(texts).toContain("T1");
    expect(texts).toContain("https://example.com/qr/t/o/t1");
    expect(png).toBe("data:image/png;base64,COMPOSITE");
    expect(toDataURL).toHaveBeenCalledWith("image/png");
  });

  it("omits a field's text row when its toggle is off", async () => {
    stubImage();
    const { fillText } = stubCanvas();

    await renderTableQrPng({ label: "T1" }, "Ground Floor", "https://example.com/qr/t/o/t1", {
      ...TEMPLATE,
      showFloorName: false,
      showUrl: true,
      showTableLabel: true,
    });

    const texts = fillText.mock.calls.map((call) => call[0]);
    expect(texts).not.toContain("Ground Floor");
    expect(texts).toContain("T1");
  });
});
