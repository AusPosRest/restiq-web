import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HubStatus } from "../../api";
import { HubLockBanner, OfflineIndicatorPill } from "./offline-indicator-pill";

const HUB: HubStatus = { online: true, lastSyncAt: "2026-11-13T10:00:00.000Z", outboxDepth: 0, mustSyncBefore: "2026-11-14T10:00:00.000Z", locked: false, lockReason: null, rejections: 0, orphans: 0 };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("OfflineIndicatorPill (W2)", () => {
  it("off a hub, keeps the browser's own online/offline signal", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    render(<OfflineIndicatorPill hub={null} />);
    const pill = screen.getByTestId("pos-connectivity-status-pill");
    expect(pill.textContent).toBe("Offline");
    expect(pill.getAttribute("data-hub")).toBeNull();
  });

  it("on a hub that reaches the cloud, shows Online", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    render(<OfflineIndicatorPill hub={HUB} />);
    expect(screen.getByTestId("pos-connectivity-status-pill").textContent).toBe("Online");
  });

  it("on an offline hub, shows how many sales are waiting to sync", () => {
    const { rerender } = render(<OfflineIndicatorPill hub={{ ...HUB, online: false, outboxDepth: 12 }} />);
    expect(screen.getByTestId("pos-connectivity-status-pill").textContent).toBe("Offline · 12 sales waiting to sync");
    expect(screen.getByTestId("pos-connectivity-status-pill").getAttribute("data-online")).toBe("false");
    rerender(<OfflineIndicatorPill hub={{ ...HUB, online: false, outboxDepth: 1 }} />);
    expect(screen.getByTestId("pos-connectivity-status-pill").textContent).toBe("Offline · 1 sale waiting to sync");
  });
});

describe("HubLockBanner (W2)", () => {
  it("renders nothing off a hub or while the hub is not locked", () => {
    const { rerender } = render(<HubLockBanner hub={null} />);
    expect(screen.queryByTestId("pos-hub-lock-banner")).toBeNull();
    rerender(<HubLockBanner hub={HUB} />);
    expect(screen.queryByTestId("pos-hub-lock-banner")).toBeNull();
  });

  it("explains the offline-limit lock with its deadline and what still works (D-8)", () => {
    render(<HubLockBanner hub={{ ...HUB, online: false, locked: true, lockReason: "offline_limit" }} />);
    const banner = screen.getByTestId("pos-hub-lock-banner");
    expect(banner.getAttribute("role")).toBe("alert");
    const message = screen.getByTestId("pos-hub-lock-banner-message").textContent ?? "";
    expect(message).toContain("New sales are paused");
    expect(message).toContain("14 Nov 2026");
    expect(message).toContain("close open bills and print");
  });

  it("explains a revoked till", () => {
    render(<HubLockBanner hub={{ ...HUB, locked: true, lockReason: "revoked" }} />);
    expect(screen.getByTestId("pos-hub-lock-banner").getAttribute("data-reason")).toBe("revoked");
    expect(screen.getByTestId("pos-hub-lock-banner-message").textContent).toContain("removed by the owner");
  });
});
