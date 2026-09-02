import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeviceScreen } from "./device-screen";
import { readStoredDevice, type DeviceView } from "./device-state";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function typeCode(raw: string) {
  await userEvent.type(screen.getByTestId("device-code-input"), raw);
}

const POS_DEVICE: DeviceView = {
  id: "d1",
  tenantId: "t1",
  outletId: "o1",
  label: "Front Counter 1",
  type: "pos",
  role: "terminal",
  status: "active",
  enrolledAt: "2026-09-02T10:00:00.000Z",
  revokedAt: null,
};

describe("DeviceScreen", () => {
  beforeEach(() => {
    push.mockReset();
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });
  afterEach(cleanup);

  it("shows the enrolment form with no stored device", async () => {
    render(<DeviceScreen />);
    expect(await screen.findByTestId("device-enrol-form")).toBeTruthy();
    expect(screen.getByTestId("device-enrol-submit")).toHaveProperty("disabled", true);
  });

  it("enrols on the happy path, persists the device, and shows the card", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { device: POS_DEVICE }));
    vi.stubGlobal("fetch", fetchMock);
    render(<DeviceScreen />);

    await screen.findByTestId("device-enrol-form");
    await typeCode("ABC234");
    await userEvent.type(screen.getByTestId("device-label-input"), "Front Counter 1");
    await userEvent.click(screen.getByTestId("device-enrol-submit"));

    expect(await screen.findByTestId("device-card")).toBeTruthy();
    expect(screen.getByTestId("device-card-label").textContent).toBe("Front Counter 1");
    expect(screen.getByTestId("device-card-type").textContent).toBe("POS terminal");
    expect(screen.getByTestId("device-card-status").textContent).toBe("Enrolled");
    expect(readStoredDevice()).toEqual(POS_DEVICE);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/device/api/enroll");
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.code).toBe("ABC-234");
    expect(body.label).toBe("Front Counter 1");
    expect(String(body.hardwareKeyFingerprint)).toMatch(/^web-/);
  });

  it.each([
    ["code_invalid", "That code isn't valid. Check it and try again."],
    ["code_expired", "This code has expired. Ask for a fresh one."],
    ["code_already_used", "This code has already been used - each code works once. Generate a new one in the console."],
  ])("shows the honest copy for %s", async (code, expectedMessage) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, { code, message: "backend detail" })));
    render(<DeviceScreen />);

    await screen.findByTestId("device-enrol-form");
    await typeCode("ABC234");
    await userEvent.click(screen.getByTestId("device-enrol-submit"));

    const error = await screen.findByTestId("device-enrol-error");
    expect(error.textContent).toBe(expectedMessage);
    expect(screen.queryByTestId("device-card")).toBeNull();
  });

  it("falls back to the route handler's own error message when it nests under `error`", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(500, { error: { code: "misconfigured", message: "NEXT_PUBLIC_API_URL is not set" } })),
    );
    render(<DeviceScreen />);

    await screen.findByTestId("device-enrol-form");
    await typeCode("ABC234");
    await userEvent.click(screen.getByTestId("device-enrol-submit"));

    expect((await screen.findByTestId("device-enrol-error")).textContent).toBe("NEXT_PUBLIC_API_URL is not set");
  });

  it("reuses the same fingerprint across a re-enrol", async () => {
    // A fresh Response per call - the mocked Response's body stream can only
    // be read (via .json()) once, and this test submits twice.
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse(201, { device: POS_DEVICE }));
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = render(<DeviceScreen />);

    await screen.findByTestId("device-enrol-form");
    await typeCode("ABC234");
    await userEvent.click(screen.getByTestId("device-enrol-submit"));
    await screen.findByTestId("device-card");

    const firstFingerprint = (JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>).hardwareKeyFingerprint;

    await userEvent.click(screen.getByTestId("device-unenrol"));
    unmount();
    render(<DeviceScreen />);
    await screen.findByTestId("device-enrol-form");
    await typeCode("XYZ234");
    await userEvent.click(screen.getByTestId("device-enrol-submit"));
    await screen.findByTestId("device-card");

    const secondFingerprint = (JSON.parse(fetchMock.mock.calls[1][1].body as string) as Record<string, unknown>).hardwareKeyFingerprint;
    expect(secondFingerprint).toBe(firstFingerprint);
  });

  it("routes Continue by device type - pos to /pos/login", async () => {
    window.localStorage.setItem("device:enrolled", JSON.stringify(POS_DEVICE));
    render(<DeviceScreen />);

    await userEvent.click(await screen.findByTestId("device-continue"));
    expect(push).toHaveBeenCalledWith("/pos/login");
  });

  it("routes Continue by device type - kds to /kds", async () => {
    window.localStorage.setItem("device:enrolled", JSON.stringify({ ...POS_DEVICE, type: "kds" }));
    render(<DeviceScreen />);

    await userEvent.click(await screen.findByTestId("device-continue"));
    expect(push).toHaveBeenCalledWith("/kds");
  });

  it("shows a plain no-web-surface line for a kiosk device instead of a Continue button", async () => {
    window.localStorage.setItem("device:enrolled", JSON.stringify({ ...POS_DEVICE, type: "kiosk" }));
    render(<DeviceScreen />);

    expect(await screen.findByTestId("device-continue-unsupported")).toBeTruthy();
    expect(screen.queryByTestId("device-continue")).toBeNull();
  });

  it("un-enrols by clearing only the stored device, returning to the enrolment form", async () => {
    window.localStorage.setItem("device:enrolled", JSON.stringify(POS_DEVICE));
    render(<DeviceScreen />);

    await userEvent.click(await screen.findByTestId("device-unenrol"));

    expect(await screen.findByTestId("device-enrol-form")).toBeTruthy();
    expect(readStoredDevice()).toBeNull();
  });

  it("waits for a complete code before enabling submit", async () => {
    render(<DeviceScreen />);
    await screen.findByTestId("device-enrol-form");
    await typeCode("AB");
    expect(screen.getByTestId("device-enrol-submit")).toHaveProperty("disabled", true);
    await typeCode("C234");
    await waitFor(() => expect(screen.getByTestId("device-enrol-submit")).toHaveProperty("disabled", false));
  });
});
