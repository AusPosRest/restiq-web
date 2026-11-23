import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SimulatorDevices } from "./simulator-devices";

interface FakeWindow {
  closed: boolean;
  focus: ReturnType<typeof vi.fn>;
  close: () => void;
}

function fakeWindow(): FakeWindow {
  const win: FakeWindow = {
    closed: false,
    focus: vi.fn(),
    close: () => {
      win.closed = true;
    },
  };
  return win;
}

describe("SimulatorDevices (PE-26 / CU-25)", () => {
  let opened: FakeWindow[];
  let openSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
    opened = [];
    openSpy = vi.fn(() => {
      const win = fakeWindow();
      opened.push(win);
      return win as unknown as Window;
    });
    vi.stubGlobal("open", openSpy);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("opens each device as its own top-level window on its own sim-*.localhost origin - no iframes", async () => {
    const { container } = render(<SimulatorDevices />);
    await screen.findByTestId("simulator-empty");

    await userEvent.click(screen.getByTestId("simulator-add-pos-till"));
    await userEvent.click(screen.getByTestId("simulator-add-kds"));

    expect(openSpy).toHaveBeenCalledTimes(2);
    const [posUrl, posName, posFeatures] = openSpy.mock.calls[0] as [string, string, string];
    const [kdsUrl, kdsName] = openSpy.mock.calls[1] as [string, string, string];
    expect(posUrl).toMatch(/^http:\/\/sim-[a-z0-9]+\.localhost:3000\/device$/);
    expect(kdsUrl).toMatch(/^http:\/\/sim-[a-z0-9]+\.localhost:3000\/device$/);
    expect(new URL(posUrl).host).not.toBe(new URL(kdsUrl).host);
    expect(posName).not.toBe(kdsName);
    expect(posFeatures).toBe("popup,width=1024,height=768");
    expect(container.querySelector("iframe")).toBeNull();
    const list = within(screen.getByTestId("simulator-device-list"));
    expect(list.getByText("POS till")).toBeTruthy();
    expect(list.getByText("KDS")).toBeTruthy();
  });

  it("focuses, closes and re-opens a device, and notices a window closed by hand", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<SimulatorDevices />);
      await screen.findByTestId("simulator-empty");
      await userEvent.click(screen.getByTestId("simulator-add-owner-console"));
      const status = within(screen.getByTestId("simulator-device-list")).getByText("Open");
      const id = status.getAttribute("data-testid")!.replace("simulator-device-status-", "");
      expect(screen.getByTestId(`simulator-device-status-${id}`).textContent).toBe("Open");

      await userEvent.click(screen.getByTestId(`simulator-device-focus-${id}`));
      expect(opened[0].focus).toHaveBeenCalled();

      await userEvent.click(screen.getByTestId(`simulator-device-close-${id}`));
      expect(opened[0].closed).toBe(true);
      expect(screen.getByTestId(`simulator-device-status-${id}`).textContent).toBe("Closed");

      await userEvent.click(screen.getByTestId(`simulator-device-reopen-${id}`));
      expect(openSpy).toHaveBeenCalledTimes(2);
      expect(openSpy.mock.calls[1][1]).toBe(openSpy.mock.calls[0][1]);

      opened[1].closed = true;
      await act(async () => {
        vi.advanceTimersByTime(1100);
      });
      expect(screen.getByTestId(`simulator-device-status-${id}`).textContent).toBe("Closed");
    } finally {
      vi.useRealTimers();
    }
  });

  it("says so when the browser blocks the pop-up", async () => {
    openSpy.mockReturnValueOnce(null);
    render(<SimulatorDevices />);
    await screen.findByTestId("simulator-empty");
    await userEvent.click(screen.getByTestId("simulator-add-mail-inbox"));
    expect(screen.getByText(/Pop-up blocked/)).toBeTruthy();
  });

  it("keeps the device list across a reload, and Remove drops one", async () => {
    render(<SimulatorDevices />);
    await screen.findByTestId("simulator-empty");
    await userEvent.click(screen.getByTestId("simulator-add-mail-inbox"));
    cleanup();

    render(<SimulatorDevices />);
    expect(within(await screen.findByTestId("simulator-device-list")).getByText("Mail inbox")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Remove Mail inbox" }));
    expect(await screen.findByTestId("simulator-empty")).toBeTruthy();
  });

  it("refuses a custom address that is not a page of this app", async () => {
    render(<SimulatorDevices />);
    await screen.findByTestId("simulator-empty");
    await userEvent.type(screen.getByTestId("simulator-custom-path"), "ftp://example.com");
    await userEvent.click(screen.getByTestId("simulator-custom-add"));
    expect(screen.getByRole("alert").textContent).toContain("same-origin path");
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("Guest QR with no configured table opens nothing, and points at the custom box with a hint", async () => {
    render(<SimulatorDevices />);
    await screen.findByTestId("simulator-empty");

    await userEvent.click(screen.getByTestId("simulator-add-guest-qr"));

    expect(openSpy).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByTestId("simulator-custom-path"));
    expect(screen.getByTestId("simulator-custom-hint").textContent).toBe("Paste the table's QR link (Owner console → Tables).");
    expect(screen.getByTestId("simulator-empty")).toBeTruthy();
  });

  it("a pasted table QR link opens as a phone-sized Guest QR on its path only", async () => {
    render(<SimulatorDevices />);
    await screen.findByTestId("simulator-empty");

    await userEvent.type(screen.getByTestId("simulator-custom-path"), "https://niftypos.com.au/qr/t/o1/t1");
    await userEvent.click(screen.getByTestId("simulator-custom-add"));

    const [url, , features] = openSpy.mock.calls[0] as [string, string, string];
    expect(url).toMatch(/^http:\/\/sim-[a-z0-9]+\.localhost:3000\/qr\/t\/o1\/t1$/);
    expect(features).toBe("popup,width=390,height=844");
    expect(within(screen.getByTestId("simulator-device-list")).getByText("Guest QR")).toBeTruthy();
  });
});
