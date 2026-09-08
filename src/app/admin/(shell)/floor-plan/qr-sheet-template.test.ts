import { afterEach, describe, expect, it } from "vitest";
import { defaultQrSheetTemplate, loadQrSheetTemplate, saveQrSheetTemplate } from "./qr-sheet-template";

afterEach(() => window.localStorage.clear());

describe("defaultQrSheetTemplate", () => {
  it("defaults the heading to the outlet name, a standard instruction, every toggle on, and a medium card", () => {
    expect(defaultQrSheetTemplate("Indiranagar Diner")).toEqual({
      heading: "Indiranagar Diner",
      instruction: "Scan to view the menu and order",
      showTableLabel: true,
      showFloorName: true,
      showUrl: true,
      cardSize: "medium",
    });
  });
});

describe("loadQrSheetTemplate", () => {
  it("returns the outlet's defaults when nothing has been saved yet", () => {
    expect(loadQrSheetTemplate("outlet-1", "Indiranagar Diner")).toEqual(defaultQrSheetTemplate("Indiranagar Diner"));
  });

  it("returns a previously saved template for that outlet", () => {
    const saved = { ...defaultQrSheetTemplate("Indiranagar Diner"), heading: "Scan me", cardSize: "large" as const, showUrl: false };
    saveQrSheetTemplate("outlet-1", saved);

    expect(loadQrSheetTemplate("outlet-1", "Indiranagar Diner")).toEqual(saved);
  });

  it("scopes saved templates per outlet - one outlet's save never bleeds into another's load", () => {
    saveQrSheetTemplate("outlet-1", { ...defaultQrSheetTemplate("A"), heading: "Outlet A heading" });

    expect(loadQrSheetTemplate("outlet-2", "Outlet B").heading).toBe("Outlet B");
  });

  it("falls back to defaults when the stored value is corrupted JSON", () => {
    window.localStorage.setItem("qr-sheet-template:outlet-1", "not json");
    expect(loadQrSheetTemplate("outlet-1", "Indiranagar Diner")).toEqual(defaultQrSheetTemplate("Indiranagar Diner"));
  });

  it("falls back to defaults, not a thrown error, when storage access itself throws", () => {
    const original = window.localStorage.getItem;
    window.localStorage.getItem = () => {
      throw new Error("storage disabled");
    };
    try {
      expect(loadQrSheetTemplate("outlet-1", "Indiranagar Diner")).toEqual(defaultQrSheetTemplate("Indiranagar Diner"));
    } finally {
      window.localStorage.getItem = original;
    }
  });
});
