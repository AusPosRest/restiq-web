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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstreamJson(200, { available: false, reason: "qr_ordering_disabled" })));

    const ui = await GuestTableEntryPage({ params: Promise.resolve({ outletId: "o1", tableId: "t1" }) });
    render(ui);

    const unavailable = screen.getByTestId("qr-unavailable");
    expect(unavailable.textContent?.toLowerCase()).not.toContain("error");
    expect(screen.queryByTestId("qr-start-form")).toBeNull();
    expect(screen.queryByTestId("qr-join-form")).toBeNull();
  });

  it("renders the unavailable page (never a raw error) when the outlet can't be found", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstreamJson(200, { available: false, reason: "not_found" })));

    const ui = await GuestTableEntryPage({ params: Promise.resolve({ outletId: "o1", tableId: "missing" }) });
    render(ui);

    expect(screen.getByTestId("qr-unavailable")).toBeTruthy();
  });

  it("renders the unavailable page when the availability endpoint is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));

    const ui = await GuestTableEntryPage({ params: Promise.resolve({ outletId: "o1", tableId: "t1" }) });
    render(ui);

    expect(screen.getByTestId("qr-unavailable")).toBeTruthy();
  });

  it("renders the welcome flow (both start and join affordances) when qr_ordering is available", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstreamJson(200, { available: true })));

    const ui = await GuestTableEntryPage({ params: Promise.resolve({ outletId: "o1", tableId: "t1" }) });
    render(ui);

    expect(screen.getByTestId("qr-start-form")).toBeTruthy();
    expect(screen.getByTestId("qr-switch-to-join")).toBeTruthy();
    expect(screen.queryByTestId("qr-join-form")).toBeNull();
  });
});
