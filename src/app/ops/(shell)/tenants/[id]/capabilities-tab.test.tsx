import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CapabilitiesTab } from "./capabilities-tab";

const outlet = (id: string, name: string, capabilities: Array<{ key: string; enabled: boolean }>) => ({
  id,
  name,
  brandId: "b1",
  brandName: "Binflow",
  address: "A1",
  type: "dine_in",
  timezone: "Asia/Kolkata",
  capabilities,
});

describe("CapabilitiesTab (restiq-backend#191)", () => {
  it("shows each outlet's real switches, read-only, with no toggle buttons", () => {
    render(
      <CapabilitiesTab
        outlets={[
          outlet("o1", "Binflow Indiranagar", [
            { key: "qr_ordering", enabled: true },
            { key: "kiosk", enabled: false },
          ]),
          outlet("o2", "Binflow Express", []),
        ]}
      />,
    );

    expect(screen.getByTestId("capability-o1-qr_ordering").textContent).toBe("QR orderingOn");
    expect(screen.getByTestId("capability-o1-kiosk").textContent).toBe("KioskOff");
    // No rows: the owner's defaults - everything off except menu photos (opt-out).
    expect(screen.getByTestId("capability-o2-qr_ordering").textContent).toBe("QR orderingOff");
    expect(screen.getByTestId("capability-o2-menu_photos").textContent).toBe("Menu photosOn");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
