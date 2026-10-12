import { afterEach, describe, expect, it, vi } from "vitest";
import { openDrawerForTenders, printPage } from "./desktop";

afterEach(() => {
  delete (window as Window & { restiqDesktop?: unknown }).restiqDesktop;
  vi.restoreAllMocks();
});

function installApp() {
  const app = { print: vi.fn(() => Promise.resolve()), openDrawer: vi.fn(() => Promise.resolve()) };
  (window as Window & { restiqDesktop?: unknown }).restiqDesktop = app;
  return app;
}

describe("printPage", () => {
  it("uses the browser print dialog outside the Windows app", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    await printPage();
    expect(print).toHaveBeenCalledOnce();
  });

  it("prints through the app inside it", async () => {
    const app = installApp();
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    await printPage();
    expect(app.print).toHaveBeenCalledOnce();
    expect(print).not.toHaveBeenCalled();
  });
});

describe("openDrawerForTenders", () => {
  it("opens the drawer only when a cash tender was taken", () => {
    const app = installApp();
    openDrawerForTenders([{ method: "upi_manual" }]);
    expect(app.openDrawer).not.toHaveBeenCalled();
    openDrawerForTenders([{ method: "upi_manual" }, { method: "cash" }]);
    expect(app.openDrawer).toHaveBeenCalledOnce();
  });

  it("does nothing in a browser", () => {
    expect(() => openDrawerForTenders([{ method: "cash" }])).not.toThrow();
  });
});
