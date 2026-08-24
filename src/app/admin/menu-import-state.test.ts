import { describe, expect, it } from "vitest";
import {
  canCommit,
  confidenceLevel,
  isAcceptedMenuFile,
  majorStringToPriceMinor,
  MenuImportItem,
  priceMinorToMajorString,
  reviewedCount,
} from "./menu-import-state";

function item(overrides: Partial<MenuImportItem> = {}): MenuImportItem {
  return {
    id: "1",
    name: "Paneer Tikka",
    shortName: "Paneer Tikka",
    category: "Starters",
    priceMinor: 32000,
    currency: "INR",
    confidence: { name: 1, shortName: 1, category: 1, price: 1, overall: 1 },
    ...overrides,
  };
}

function file(name: string): File {
  return new File(["x"], name);
}

describe("confidenceLevel", () => {
  it("is high at and above 0.85", () => {
    expect(confidenceLevel(0.85)).toBe("high");
    expect(confidenceLevel(0.99)).toBe("high");
  });

  it("is medium between 0.5 and just under 0.85", () => {
    expect(confidenceLevel(0.5)).toBe("medium");
    expect(confidenceLevel(0.84)).toBe("medium");
  });

  it("is low below 0.5", () => {
    expect(confidenceLevel(0.49)).toBe("low");
    expect(confidenceLevel(0)).toBe("low");
  });
});

describe("isAcceptedMenuFile", () => {
  it("accepts the extensions the backend's resolveSourceType maps to a source type", () => {
    expect(isAcceptedMenuFile(file("menu.csv"))).toBe(true);
    expect(isAcceptedMenuFile(file("menu.xlsx"))).toBe(true);
    expect(isAcceptedMenuFile(file("menu.pdf"))).toBe(true);
    expect(isAcceptedMenuFile(file("menu.PNG"))).toBe(true);
    expect(isAcceptedMenuFile(file("menu.jpg"))).toBe(true);
    expect(isAcceptedMenuFile(file("menu.jpeg"))).toBe(true);
  });

  it("rejects extensions the backend doesn't recognise, and anything else", () => {
    expect(isAcceptedMenuFile(file("menu.xls"))).toBe(false);
    expect(isAcceptedMenuFile(file("menu.heic"))).toBe(false);
    expect(isAcceptedMenuFile(file("menu.txt"))).toBe(false);
    expect(isAcceptedMenuFile(file("menu"))).toBe(false);
  });
});

describe("price conversion", () => {
  it("renders minor units as a 2-decimal major string", () => {
    expect(priceMinorToMajorString(32000)).toBe("320.00");
    expect(priceMinorToMajorString(5)).toBe("0.05");
    expect(priceMinorToMajorString(0)).toBe("0.00");
  });

  it("parses a major-unit string back to minor units", () => {
    expect(majorStringToPriceMinor("320")).toBe(32000);
    expect(majorStringToPriceMinor("320.5")).toBe(32050);
    expect(majorStringToPriceMinor("0")).toBe(0);
  });

  it("rejects negative or non-numeric input", () => {
    expect(majorStringToPriceMinor("-5")).toBeNull();
    expect(majorStringToPriceMinor("abc")).toBeNull();
    expect(majorStringToPriceMinor("")).toBeNull();
  });
});

describe("reviewedCount / canCommit", () => {
  const items = [item({ id: "1" }), item({ id: "2" }), item({ id: "3" })];

  it("counts how many drafted items have been reviewed", () => {
    expect(reviewedCount(new Set(["1", "2"]), items)).toBe(2);
    expect(reviewedCount(new Set(), items)).toBe(0);
  });

  it("cannot commit an empty draft", () => {
    expect(canCommit(new Set(), [])).toBe(false);
  });

  it("cannot commit while any item is unreviewed", () => {
    expect(canCommit(new Set(["1", "2"]), items)).toBe(false);
  });

  it("can commit once every item is reviewed", () => {
    expect(canCommit(new Set(["1", "2", "3"]), items)).toBe(true);
  });
});
