import { afterEach, describe, expect, it, vi } from "vitest";
import { guestOrderUrl, qrPngFilename, renderTableQrPng, wrapText } from "./table-qr-state";
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
    const context = { fillStyle: "", font: "", textAlign: "", textBaseline: "", fillRect: vi.fn(), fillText, drawImage, measureText: (text: string) => ({ width: text.length * 10 }) };
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

// PE-20 / CU-8: the long table link on a downloaded PNG was clipped at both edges.
describe("wrapText", () => {
  const measure = (text: string) => text.length * 10;

  it("keeps short text on one line", () => {
    expect(wrapText("T1", 100, measure)).toEqual(["T1"]);
  });

  it("breaks a long URL into lines that each fit", () => {
    const url = "http://bay-leaf.localhost:3105/qr/t/01a12afd-0a44-72cd-a839-75e12aaaaaaa/01a12afd-0a44-72cd-a839-75e12bbbbbbb";
    const lines = wrapText(url, 300, measure);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line) => measure(line) <= 300)).toBe(true);
    expect(lines.join("")).toBe(url);
  });

  it("breaks words at spaces", () => {
    expect(wrapText("Scan to view the menu", 120, measure)).toEqual(["Scan to view", "the menu"]);
  });
});
