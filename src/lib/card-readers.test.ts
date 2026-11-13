import { describe, expect, it } from "vitest";
import { currencyForCountry, deviceTypeLabel, shippingSummary } from "./card-readers";

describe("card-readers", () => {
  it("names Stripe device types in plain words", () => {
    expect(deviceTypeLabel("stripe_s700")).toBe("Stripe Reader S700");
    expect(deviceTypeLabel("simulated_wisepos_e")).toBe("WisePOS E (simulated)");
    expect(deviceTypeLabel("verifone_p400")).toBe("verifone p400");
  });

  it("summarises a shipping address and maps country to currency", () => {
    expect(shippingSummary({ name: "Sam Lee", line1: "1 George St", city: "Sydney", state: "NSW", postcode: "2000", phone: "0400" })).toBe("Sam Lee, Sydney NSW 2000");
    expect(currencyForCountry("IN")).toBe("INR");
    expect(currencyForCountry("AU")).toBe("AUD");
  });
});
