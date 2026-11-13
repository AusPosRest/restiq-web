import { beforeEach, describe, expect, it } from "vitest";
import { createDevice, deviceUrl, loadDevices, nextLabel, PRESETS, saveDevices, validateCustomPath, windowFeatures, windowName } from "./simulator-state";

describe("PRESETS", () => {
  it("keeps the owner console, POS, KDS, kiosk, guest QR and mail inbox presets", () => {
    expect(PRESETS.map((preset) => preset.key)).toEqual(
      expect.arrayContaining(["owner-console", "pos-till", "kds", "kiosk", "guest-qr", "mail-inbox"]),
    );
    expect(PRESETS.find((preset) => preset.key === "mail-inbox")?.path).toBe("/ops/inbox");
  });
});

describe("nextLabel", () => {
  it("numbers repeats of the same preset", () => {
    const first = createDevice({ label: "POS till", path: "/device", width: 1, height: 1 });
    expect(nextLabel([], "POS till")).toBe("POS till");
    expect(nextLabel([first], "POS till")).toBe("POS till 2");
    const second = { ...first, id: "x", label: "POS till 2" };
    expect(nextLabel([first, second], "POS till")).toBe("POS till 3");
  });
});

describe("validateCustomPath", () => {
  it("accepts a same-origin path", () => {
    expect(validateCustomPath("/pos/login")).toEqual({ ok: true, path: "/pos/login" });
  });

  it.each(["https://x", "//evil.com", "javascript:x", "", "   ", "/\\evil.com"])("rejects %s", (input) => {
    expect(validateCustomPath(input).ok).toBe(false);
  });
});

describe("deviceUrl", () => {
  const LOCALHOST = { protocol: "http:", hostname: "localhost", port: "3105" };

  it("gives each device its own *.localhost origin on localhost", () => {
    expect(deviceUrl("/pos/login", "abcdef1234567890", LOCALHOST)).toBe("http://sim-abcdef12.localhost:3105/pos/login");
  });

  it("does the same for 127.0.0.1", () => {
    expect(deviceUrl("/pos/login", "abcdef1234567890", { protocol: "http:", hostname: "127.0.0.1", port: "3105" })).toBe(
      "http://sim-abcdef12.localhost:3105/pos/login",
    );
  });

  it("leaves the path unchanged on a hosted deployment", () => {
    expect(deviceUrl("/pos/login", "abcdef1234567890", { protocol: "https:", hostname: "restiq-web.vercel.app", port: "" })).toBe("/pos/login");
  });

  it("gives different devices different hosts", () => {
    expect(deviceUrl("/pos/login", "id-one-aaaaaaaa", LOCALHOST)).not.toBe(deviceUrl("/pos/login", "id-two-bbbbbbbb", LOCALHOST));
  });
});

describe("window name and features", () => {
  it("names a device's window after its id, so Re-open reuses it", () => {
    expect(windowName("abc-123")).toBe("restiq-sim-abc-123");
  });

  it("opens a popup at the device's size", () => {
    expect(windowFeatures({ width: 1024.4, height: 768 })).toBe("popup,width=1024,height=768");
  });
});

describe("localStorage persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips the device list", () => {
    const devices = [createDevice({ label: "KDS", path: "/device", width: 1280, height: 720 })];
    saveDevices(devices);
    expect(loadDevices()).toEqual(devices);
  });

  it("starts empty when storage is empty, corrupt or holds something else", () => {
    expect(loadDevices()).toEqual([]);
    window.localStorage.setItem("restiq:simulator:v2", "{not json");
    expect(loadDevices()).toEqual([]);
    window.localStorage.setItem("restiq:simulator:v2", JSON.stringify([{ id: "x" }]));
    expect(loadDevices()).toEqual([]);
  });
});
