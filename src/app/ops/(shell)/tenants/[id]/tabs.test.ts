import { describe, expect, it } from "vitest";
import { regionLabel, titleCase } from "./tabs";

describe("tenant overview wording (PE-28)", () => {
  it("says plainly when an Australian tenant is hosted in the India region", () => {
    expect(regionLabel("in-mumbai", "IN")).toBe("India (Mumbai)");
    expect(regionLabel("in-mumbai", "AU")).toBe("India (Mumbai) - no Australian region yet");
    expect(regionLabel("ap-south-1", "IN")).toBe("ap-south-1");
  });

  it("labels the Sydney region and flags Indian tenants hosted there (#399)", () => {
    expect(regionLabel("au-sydney", "AU")).toBe("Australia (Sydney)");
    expect(regionLabel("au-sydney", "IN")).toBe("Australia (Sydney) - no Indian region yet");
  });

  it("capitalises plan and billing period", () => {
    expect(`${titleCase("standard")} · ${titleCase("monthly")}`).toBe("Standard · Monthly");
  });
});
