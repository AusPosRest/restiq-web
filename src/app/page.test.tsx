import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_STAFF } from "./demo-logins";
import Home from "./page";

const API_URL = "https://api.example.test";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const DEVICES = [
  { id: "d-pos", label: "POS-1", type: "pos", status: "active", tenantName: "Spice Route Hospitality", outletName: "Spice Route Outlet" },
  { id: "d-kiosk", label: "KIOSK-1", type: "kiosk", status: "active", tenantName: "Bay Leaf Kitchens", outletName: null },
  { id: "d-kds", label: "KDS-1", type: "kds", status: "active", tenantName: "Spice Route Hospitality", outletName: "Spice Route Outlet" },
  { id: "d-cds", label: "CDS-1", type: "cds", status: "active", tenantName: "Bay Leaf Kitchens", outletName: null },
  { id: "d-revoked", label: "POS-OLD", type: "pos", status: "revoked", tenantName: "Bay Leaf Kitchens", outletName: null },
];

function stubDevicesFetch() {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { token: "t-1" }))
      .mockResolvedValueOnce(jsonResponse(200, { devices: DEVICES, nextCursor: null, total: DEVICES.length })),
  );
}

describe("Landing page", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = API_URL;
    process.env.DEMO_OPS_EMAIL = "admin@restiq.example";
    process.env.DEMO_OPS_PASSWORD = "OpsDemo2026!";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("renders a navigable card for every user surface with its entry route", async () => {
    stubDevicesFetch();
    render(await Home());
    const routes = ["/ops/login", "/admin", "/pos/login", "/kds", "/device"];
    for (const href of routes) {
      const card = screen.getByTestId(`landing-card-${href}`);
      // The card is a stretched-link container; the CTA anchor carries the href.
      expect(card.querySelector("a")?.getAttribute("href")).toBe(href);
    }
    // The guest QR card carries a full table-session URL, not a bare route.
    const guest = screen.getByText("Guest QR Self-Order").closest("[data-testid^='landing-card-']");
    expect(guest?.querySelector("a")?.getAttribute("href")).toContain("/qr/t/");
  });

  it("makes each credential value a copy button", async () => {
    stubDevicesFetch();
    render(await Home());
    const emailCopy = screen.getByTestId("landing-copy-Email");
    expect(emailCopy.tagName).toBe("BUTTON");
    expect(emailCopy.getAttribute("aria-label")).toContain("admin@restiq.example");
  });

  it("lists live devices sorted by tenant, with Open links mapped by type and revoked devices skipped", async () => {
    stubDevicesFetch();
    render(await Home());

    expect(screen.getByTestId("landing-device-open-d-pos").getAttribute("href")).toBe("/pos/login");
    expect(screen.getByTestId("landing-device-open-d-kiosk").getAttribute("href")).toBe("/pos/login");
    expect(screen.getByTestId("landing-device-open-d-kds").getAttribute("href")).toBe("/kds");
    // cds has no login surface; the revoked pos device is never openable.
    expect(screen.queryByTestId("landing-device-open-d-cds")).toBeNull();
    expect(screen.queryByTestId("landing-device-open-d-revoked")).toBeNull();
    expect(screen.getByTestId("landing-device-d-revoked")).toBeTruthy();
  });

  it("shows a calm unavailable note when the devices API can't be reached, without breaking the rest of the page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));
    render(await Home());

    expect(screen.getByTestId("landing-devices-unavailable").textContent).toContain("Device list unavailable");
    expect(screen.queryByTestId("landing-devices-table")).toBeNull();
    expect(screen.getByTestId("landing-card-/pos/login")).toBeTruthy();
  });

  it("shows the unavailable note when the ops demo credentials aren't configured", async () => {
    delete process.env.DEMO_OPS_EMAIL;
    delete process.env.DEMO_OPS_PASSWORD;
    render(await Home());

    expect(screen.getByTestId("landing-devices-unavailable")).toBeTruthy();
  });

  it("renders the staff logins table with every DEMO_STAFF row, a copyable PIN and a POS open link", async () => {
    stubDevicesFetch();
    render(await Home());

    for (const staff of DEMO_STAFF) {
      const row = screen.getByTestId(`landing-staff-${staff.name}`);
      expect(row.textContent).toContain(staff.tenant);
      expect(row.textContent).toContain(staff.role);

      const copyButton = screen.getByTestId(`landing-copy-${staff.name} PIN`);
      expect(copyButton.tagName).toBe("BUTTON");
      expect(copyButton.textContent).toContain(staff.pin);

      expect(screen.getByTestId(`landing-staff-open-${staff.name}`).getAttribute("href")).toBe("/pos/login");
    }
  });

  it("points the POS card at the staff logins table instead of duplicating PINs", async () => {
    stubDevicesFetch();
    render(await Home());
    expect(screen.queryByText("PIN 1234")).toBeNull();
    expect(screen.getByText("See the staff logins table below")).toBeTruthy();
  });
});
