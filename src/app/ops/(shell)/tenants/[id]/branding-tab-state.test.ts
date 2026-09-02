import { describe, expect, it } from "vitest";
import {
  brandingDraftEqual,
  buildBrandingPayload,
  clampCornerRadius,
  expandHex,
  isValidHexColor,
  MAX_CORNER_RADIUS_PX,
  normalizeBrandingDraft,
} from "./branding-tab-state";

describe("isValidHexColor", () => {
  it("accepts 3- and 6-digit hex, mirroring the backend's IsHexColor", () => {
    expect(isValidHexColor("#f59e0b")).toBe(true);
    expect(isValidHexColor("#F59E0B")).toBe(true);
    expect(isValidHexColor("#fff")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isValidHexColor("f59e0b")).toBe(false);
    expect(isValidHexColor("#F59E0")).toBe(false);
    expect(isValidHexColor("#GGGGGG")).toBe(false);
    expect(isValidHexColor("")).toBe(false);
  });
});

describe("expandHex", () => {
  it("expands a 3-digit shorthand to 6 digits for input[type=color]", () => {
    expect(expandHex("#f59")).toBe("#ff5599");
    expect(expandHex("#FFF")).toBe("#ffffff");
  });

  it("lower-cases an already 6-digit value", () => {
    expect(expandHex("#F59E0B")).toBe("#f59e0b");
  });

  it("falls back to black for an invalid value", () => {
    expect(expandHex("not-a-color")).toBe("#000000");
  });
});

describe("clampCornerRadius", () => {
  it("clamps into the backend's 0-64 range", () => {
    expect(clampCornerRadius(-5)).toBe(0);
    expect(clampCornerRadius(999)).toBe(MAX_CORNER_RADIUS_PX);
    expect(clampCornerRadius(12)).toBe(12);
  });

  it("falls back to 0 for non-finite input", () => {
    expect(clampCornerRadius(Number.NaN)).toBe(0);
  });
});

describe("normalizeBrandingDraft", () => {
  it("fills defaults for a tenant with no branding tokens at all", () => {
    const draft = normalizeBrandingDraft({});
    expect(draft.primaryColor).toBe("#f59e0b");
    expect(draft.cornerRadiusPx).toBe(8);
    expect(draft.font).toBe("");
    expect(draft.logoUrl).toBe("");
    expect(draft.receiptHeader).toBe("");
    expect(draft.receiptFooter).toBe("");
  });

  it("keeps valid values already on the tenant, including an unknown custom key", () => {
    const draft = normalizeBrandingDraft({
      primaryColor: "#111111",
      font: "Inter",
      cornerRadiusPx: "20",
      customThing: "kept-on-tenant-but-not-in-the-draft",
    });
    expect(draft.primaryColor).toBe("#111111");
    expect(draft.font).toBe("Inter");
    expect(draft.cornerRadiusPx).toBe(20);
  });

  it("defaults an invalid stored color instead of surfacing garbage", () => {
    expect(normalizeBrandingDraft({ primaryColor: "not-a-color" }).primaryColor).toBe("#f59e0b");
  });

  it("defaults a non-numeric stored corner radius", () => {
    expect(normalizeBrandingDraft({ cornerRadiusPx: "not-a-number" }).cornerRadiusPx).toBe(8);
  });
});

describe("brandingDraftEqual", () => {
  const base = normalizeBrandingDraft({});

  it("is true for two structurally equal drafts", () => {
    expect(brandingDraftEqual(base, { ...base })).toBe(true);
  });

  it("is false when any single field differs", () => {
    expect(brandingDraftEqual(base, { ...base, receiptFooter: "Thanks!" })).toBe(false);
    expect(brandingDraftEqual(base, { ...base, cornerRadiusPx: 20 })).toBe(false);
  });
});

describe("buildBrandingPayload", () => {
  it("sends only the changed fields, merged onto the tenant's current full token map", () => {
    const current = { primaryColor: "#111111", customThing: "operator-set-this-directly" };
    const initial = normalizeBrandingDraft(current);
    const draft = { ...initial, receiptFooter: "Thanks for visiting!" };

    const payload = buildBrandingPayload(current, initial, draft);

    expect(payload).toEqual({
      primaryColor: "#111111",
      customThing: "operator-set-this-directly",
      receiptFooter: "Thanks for visiting!",
    });
  });

  it("never drops a custom key this form doesn't know about", () => {
    const current = { customThing: "keep-me" };
    const initial = normalizeBrandingDraft(current);
    const draft = { ...initial, font: "Inter" };

    expect(buildBrandingPayload(current, initial, draft)).toMatchObject({ customThing: "keep-me", font: "Inter" });
  });

  it("removes a field cleared back to empty rather than sending an empty string", () => {
    const current = { receiptHeader: "GSTIN 27ABCDE1234F1Z5" };
    const initial = normalizeBrandingDraft(current);
    const draft = { ...initial, receiptHeader: "" };

    const payload = buildBrandingPayload(current, initial, draft);
    expect(payload).not.toHaveProperty("receiptHeader");
  });

  it("writes cornerRadiusPx as a numeric string - the backend rejects a non-string value", () => {
    const initial = normalizeBrandingDraft({});
    const draft = { ...initial, cornerRadiusPx: 24 };

    const payload = buildBrandingPayload({}, initial, draft);
    expect(payload.cornerRadiusPx).toBe("24");
    expect(typeof payload.cornerRadiusPx).toBe("string");
  });
});
