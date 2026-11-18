import { describe, expect, it } from "vitest";
import { installMode, isIos, type InstallEnv } from "./install-state";

const base: InstallEnv = { standalone: false, ios: false, promptReady: false, dismissed: false, path: "/admin" };

describe("installMode", () => {
  it("offers the browser prompt on Android/Chrome once it's ready", () => {
    expect(installMode(base)).toBeNull();
    expect(installMode({ ...base, promptReady: true })).toBe("prompt");
  });

  it("shows the Add to Home Screen steps on iOS", () => {
    expect(installMode({ ...base, ios: true })).toBe("ios");
  });

  it("says nothing inside the installed app, after a dismiss, or on guest QR pages", () => {
    expect(installMode({ ...base, promptReady: true, standalone: true })).toBeNull();
    expect(installMode({ ...base, ios: true, dismissed: true })).toBeNull();
    expect(installMode({ ...base, ios: true, path: "/qr/kiosk/out-1" })).toBeNull();
    expect(installMode({ ...base, ios: true, path: "/" })).toBeNull(); // public marketing page (issue #262)
  });

  it("never covers the till or kitchen screens (issue #373)", () => {
    for (const path of ["/pos", "/pos/login", "/pos/orders/o-1/settle", "/kds", "/kds/station-1"]) {
      expect(installMode({ ...base, ios: true, path })).toBeNull();
      expect(installMode({ ...base, promptReady: true, path })).toBeNull();
    }
    expect(installMode({ ...base, ios: true, path: "/posters" })).toBe("ios");
  });
});

describe("isIos", () => {
  it("spots iPhone and iPad, including iPadOS posing as a Mac", () => {
    expect(isIos("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", "iPhone", 5)).toBe(true);
    expect(isIos("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 5)).toBe(true);
    expect(isIos("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 0)).toBe(false);
    expect(isIos("Mozilla/5.0 (Linux; Android 14; Pixel 8)", "Linux armv8l", 5)).toBe(false);
  });
});
