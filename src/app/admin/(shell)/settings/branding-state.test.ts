import { describe, expect, it } from "vitest";
import {
  brandingEqual,
  clampCornerRadius,
  DEFAULT_BRANDING,
  hexLabel,
  isAcceptedLogoFile,
  isValidHexColor,
  MAX_CORNER_RADIUS_PX,
  normalizeBranding,
} from "./branding-state";

describe("isValidHexColor", () => {
  it("accepts a 6-digit hex color", () => {
    expect(isValidHexColor("#F59E0B")).toBe(true);
    expect(isValidHexColor("#f59e0b")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isValidHexColor("F59E0B")).toBe(false);
    expect(isValidHexColor("#F59E0")).toBe(false);
    expect(isValidHexColor("#GGGGGG")).toBe(false);
    expect(isValidHexColor("")).toBe(false);
  });
});

describe("clampCornerRadius", () => {
  it("clamps into the backend's 0-64 range (UpdateBrandingDto @Min(0) @Max(64))", () => {
    expect(clampCornerRadius(-5)).toBe(0);
    expect(clampCornerRadius(100)).toBe(MAX_CORNER_RADIUS_PX);
    expect(clampCornerRadius(12)).toBe(12);
  });

  it("rounds fractional values", () => {
    expect(clampCornerRadius(8.6)).toBe(9);
  });

  it("falls back to the minimum for non-finite input", () => {
    expect(clampCornerRadius(Number.NaN)).toBe(0);
  });
});

describe("normalizeBranding", () => {
  it("fills every field with the default for a fresh tenant's all-null response", () => {
    expect(
      normalizeBranding({
        primaryColor: null,
        secondaryColor: null,
        accentColor: null,
        surfaceColor: null,
        font: null,
        cornerRadiusPx: null,
        logoUrl: null,
        receiptHeader: null,
        receiptFooter: null,
      }),
    ).toEqual(DEFAULT_BRANDING);
  });

  it("fills every field with the default when given null/undefined outright", () => {
    expect(normalizeBranding(null)).toEqual(DEFAULT_BRANDING);
    expect(normalizeBranding(undefined)).toEqual(DEFAULT_BRANDING);
  });

  it("keeps valid values and only defaults the invalid/missing ones", () => {
    const result = normalizeBranding({
      primaryColor: "#111111",
      secondaryColor: "not-a-color",
      accentColor: "#333333",
      surfaceColor: "#444444",
      font: "Inter",
      cornerRadiusPx: 999,
      logoUrl: "https://cdn.example.com/logo.png",
      receiptHeader: "GSTIN 27ABCDE1234F1Z5",
    });
    expect(result.primaryColor).toBe("#111111");
    expect(result.secondaryColor).toBe(DEFAULT_BRANDING.secondaryColor);
    expect(result.font).toBe("Inter");
    expect(result.cornerRadiusPx).toBe(MAX_CORNER_RADIUS_PX);
    expect(result.logoUrl).toBe("https://cdn.example.com/logo.png");
    expect(result.receiptHeader).toBe("GSTIN 27ABCDE1234F1Z5");
    expect(result.receiptFooter).toBe("");
  });

  it("rejects a font the editor doesn't offer", () => {
    expect(normalizeBranding({ font: "Comic Sans" }).font).toBe(DEFAULT_BRANDING.font);
  });
});

describe("brandingEqual", () => {
  it("is true for two structurally equal token sets", () => {
    expect(brandingEqual(DEFAULT_BRANDING, { ...DEFAULT_BRANDING })).toBe(true);
  });

  it("is false when any single field differs", () => {
    expect(brandingEqual(DEFAULT_BRANDING, { ...DEFAULT_BRANDING, receiptFooter: "Thanks!" })).toBe(false);
    expect(brandingEqual(DEFAULT_BRANDING, { ...DEFAULT_BRANDING, primaryColor: "#000000" })).toBe(false);
  });
});

describe("isAcceptedLogoFile", () => {
  it("accepts a reasonably-sized svg or png", () => {
    expect(isAcceptedLogoFile({ type: "image/png", size: 1024 })).toBe(true);
    expect(isAcceptedLogoFile({ type: "image/svg+xml", size: 1024 })).toBe(true);
  });

  it("rejects other file types", () => {
    expect(isAcceptedLogoFile({ type: "image/jpeg", size: 1024 })).toBe(false);
    expect(isAcceptedLogoFile({ type: "application/pdf", size: 1024 })).toBe(false);
  });

  it("rejects empty and oversized files", () => {
    expect(isAcceptedLogoFile({ type: "image/png", size: 0 })).toBe(false);
    expect(isAcceptedLogoFile({ type: "image/png", size: 3 * 1024 * 1024 })).toBe(false);
  });
});

describe("hexLabel", () => {
  it("strips the # and upper-cases", () => {
    expect(hexLabel("#8b2028")).toBe("8B2028");
    expect(hexLabel("8b2028")).toBe("8B2028");
  });
});
