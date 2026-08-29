import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GuestTableEntryPage from "./page";

const API_URL = "https://api.example.test";

function upstreamJson(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("GuestTableEntryPage", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = API_URL;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("renders the warm unavailable page, never the menu, when qr_ordering is off", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        upstreamJson(200, {
          outlet: { id: "o1", name: "Spice Route" },
          table: { id: "t1", label: "12" },
          qrOrderingEnabled: false,
          sessionOpen: false,
        }),
      ),
    );

    const ui = await GuestTableEntryPage({ params: Promise.resolve({ outletId: "o1", tableId: "t1" }) });
    render(ui);

    const unavailable = screen.getByTestId("qr-unavailable");
    expect(unavailable.textContent).toContain("Spice Route");
    expect(unavailable.textContent?.toLowerCase()).not.toContain("error");
    expect(screen.queryByTestId("qr-start-form")).toBeNull();
    expect(screen.queryByTestId("qr-join-form")).toBeNull();
  });

  it("renders the unavailable page (never a raw error) when the table can't be found", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstreamJson(404, { error: { code: "not_found" } })));

    const ui = await GuestTableEntryPage({ params: Promise.resolve({ outletId: "o1", tableId: "missing" }) });
    render(ui);

    expect(screen.getByTestId("qr-unavailable")).toBeTruthy();
  });

  it("renders the start form when qr_ordering is on and no session is open", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        upstreamJson(200, {
          outlet: { id: "o1", name: "Spice Route" },
          table: { id: "t1", label: "12" },
          qrOrderingEnabled: true,
          sessionOpen: false,
        }),
      ),
    );

    const ui = await GuestTableEntryPage({ params: Promise.resolve({ outletId: "o1", tableId: "t1" }) });
    render(ui);

    expect(screen.getByTestId("qr-start-form")).toBeTruthy();
    expect(screen.getByTestId("qr-outlet-name").textContent).toBe("Spice Route");
    expect(screen.getByTestId("qr-table-label").textContent).toBe("Table 12");
  });

  it("renders the join form when qr_ordering is on and a session is already open", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        upstreamJson(200, {
          outlet: { id: "o1", name: "Spice Route" },
          table: { id: "t1", label: "12" },
          qrOrderingEnabled: true,
          sessionOpen: true,
        }),
      ),
    );

    const ui = await GuestTableEntryPage({ params: Promise.resolve({ outletId: "o1", tableId: "t1" }) });
    render(ui);

    expect(screen.getByTestId("qr-join-form")).toBeTruthy();
  });
});
