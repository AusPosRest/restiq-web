import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_OWNER, DEMO_STAFF } from "../demo-logins";
import Home from "./page";

const API_URL = "https://api.example.test";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const DEVICES = [
  { id: "d-pos", tenantId: "tenant-spice", label: "POS-1", type: "pos", status: "active", tenantName: "Spice Route Hospitality", outletName: "Spice Route Outlet" },
  { id: "d-kiosk", tenantId: "tenant-bayleaf", label: "KIOSK-1", type: "kiosk", status: "active", tenantName: "Bay Leaf Kitchens", outletId: "outlet-bayleaf", outletName: "Bay Leaf Counter" },
  { id: "d-kds", tenantId: "tenant-spice", label: "KDS-1", type: "kds", status: "active", tenantName: "Spice Route Hospitality", outletName: "Spice Route Outlet" },
  { id: "d-cds", tenantId: "tenant-bayleaf", label: "CDS-1", type: "cds", status: "active", tenantName: "Bay Leaf Kitchens", outletName: null },
  { id: "d-printer", tenantId: "tenant-spice", label: "Counter printer", type: "printer", status: "active", tenantName: "Spice Route Hospitality", outletName: "Spice Route Outlet" },
  { id: "d-terminal", tenantId: "tenant-spice", label: "Counter terminal", type: "terminal", status: "active", tenantName: "Spice Route Hospitality", outletName: "Spice Route Outlet" },
  { id: "d-revoked", tenantId: "tenant-bayleaf", label: "POS-OLD", type: "pos", status: "revoked", tenantName: "Bay Leaf Kitchens", outletName: null },
];

// Both demo restaurants are in Test mode; a Live one ("Real Diner") must never show up on /demo.
const TENANTS = [
  { id: "tenant-spice", name: "Spice Route Hospitality", testMode: true },
  { id: "tenant-bayleaf", name: "Bay Leaf Kitchens", testMode: true },
  { id: "tenant-real", name: "Real Diner", testMode: false },
];
const LIVE_DEVICE = { id: "d-live", tenantId: "tenant-real", label: "POS-LIVE", type: "pos", status: "active", tenantName: "Real Diner", outletName: "Main" };

function stubDevicesFetch(tenants = TENANTS) {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { token: "t-1" }))
      .mockResolvedValueOnce(jsonResponse(200, { tenants, nextCursor: null, total: tenants.length }))
      .mockResolvedValueOnce(jsonResponse(200, { devices: [...DEVICES, LIVE_DEVICE], nextCursor: null, total: DEVICES.length + 1 })),
  );
}

describe("Landing page", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = API_URL;
    process.env.DEMO_OPS_EMAIL = "admin@restiq.example";
    process.env.DEMO_OPS_PASSWORD = "OpsDemo2026!";
    delete process.env.DEMO_PAGES;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("renders a navigable card for every user surface with its entry route", async () => {
    stubDevicesFetch();
    render(await Home());
    const routes = ["/ops/login", "/admin/login", "/pos/login", "/kds", "/device"];
    for (const href of routes) {
      const card = screen.getByTestId(`landing-card-${href}`);
      // The card is a stretched-link container; the CTA anchor carries the href.
      expect(card.querySelector("a")?.getAttribute("href")).toBe(href);
    }
    // The guest QR card carries a full table-session URL, not a bare route.
    const guest = screen.getByText("Guest QR Self-Order").closest("[data-testid^='landing-card-']");
    expect(guest?.querySelector("a")?.getAttribute("href")).toContain("/qr/t/");
  });

  // PE-30 Blocker: the platform operator login is never published.
  it("never shows a platform operator login", async () => {
    stubDevicesFetch();
    const { container } = render(await Home());
    const opsCard = within(screen.getByTestId("landing-card-/ops/login"));
    expect(opsCard.queryByRole("button")).toBeNull();
    expect(opsCard.getByText("Operators sign in with their own account")).toBeTruthy();
    expect(container.textContent).not.toContain("admin@restiq.example");
    expect(container.textContent).not.toContain(process.env.DEMO_OPS_PASSWORD);
  });

  it("makes the demo owner login copyable while its restaurant is in Test mode", async () => {
    stubDevicesFetch();
    render(await Home());
    const owner = within(screen.getByTestId("landing-owner-login"));
    expect(owner.getByRole("button", { name: `Copy Email: ${DEMO_OWNER.email}` })).toBeTruthy();
    expect(owner.getByRole("button", { name: `Copy Password: ${DEMO_OWNER.password}` })).toBeTruthy();
    expect(within(screen.getByTestId("landing-card-/admin/login")).getByRole("link", { name: /Open owner console/ }).getAttribute("href")).toBe("/admin/login");
  });

  it("lists only Test-mode tenants' logins and devices", async () => {
    stubDevicesFetch(TENANTS.map((tenant) => (tenant.name === "Bay Leaf Kitchens" ? { ...tenant, testMode: false } : tenant)));
    render(await Home());
    expect(screen.getByTestId("landing-owner-login-none")).toBeTruthy();
    for (const staff of DEMO_STAFF) {
      expect(Boolean(screen.queryByTestId(`landing-staff-${staff.name}`))).toBe(staff.tenant === "Spice Route Hospitality");
    }
    expect(screen.queryByTestId("landing-device-d-kiosk")).toBeNull();
    expect(screen.queryByTestId("landing-device-d-live")).toBeNull();
    expect(screen.getByTestId("landing-device-d-pos")).toBeTruthy();
  });

  it("shows no logins at all when the platform can't say which tenants are in Test mode", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));
    render(await Home());
    expect(screen.getByTestId("landing-owner-login-none")).toBeTruthy();
    expect(screen.getByTestId("landing-staff-none")).toBeTruthy();
  });

  it("is a 404 in production unless DEMO_PAGES=on", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      await expect(Home()).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
      vi.stubEnv("DEMO_PAGES", "on");
      stubDevicesFetch();
      render(await Home());
      expect(screen.getByTestId("landing-surfaces")).toBeTruthy();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("lists live devices sorted by tenant, with Open links mapped by type and revoked devices skipped", async () => {
    stubDevicesFetch();
    render(await Home());

    expect(screen.getByTestId("landing-device-open-d-pos").getAttribute("href")).toBe("/pos/login?device=d-pos&tenant=tenant-spice");
    expect(screen.getByTestId("landing-device-open-d-kiosk").getAttribute("href")).toBe("/qr/kiosk/outlet-bayleaf?device=d-kiosk");
    expect(screen.getByTestId("landing-device-open-d-kds").getAttribute("href")).toBe("/kds");
    expect(screen.getByTestId("landing-device-open-d-printer").getAttribute("href")).toBe("/pos/login?next=%2Fpos%2Fprinter");
    expect(screen.getByTestId("landing-device-open-d-terminal").getAttribute("href")).toBe("/pos/login?next=%2Fpos%2Fterminal");
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
    expect(screen.getByText("Staff PINs are in the table below")).toBeTruthy();
  });
});
