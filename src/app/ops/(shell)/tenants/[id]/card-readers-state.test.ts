import { describe, expect, it } from "vitest";
import { emptyRegisterForm, validateRegisterForm } from "./card-readers-state";

describe("card-readers-state", () => {
  const base = { ...emptyRegisterForm("o1"), label: " Counter 1 ", registrationCode: " apple-banana " };

  it("builds the register body from a filled form", () => {
    expect(validateRegisterForm(base)).toEqual({ outletId: "o1", label: "Counter 1", registrationCode: "apple-banana" });
  });

  it("uses the simulated code when the sandbox box is ticked", () => {
    expect(validateRegisterForm({ ...base, registrationCode: "", simulated: true })).toMatchObject({ registrationCode: "simulated-wpe" });
  });

  it("requires outlet, label and code", () => {
    expect(validateRegisterForm({ ...base, outletId: "" })).toHaveProperty("error");
    expect(validateRegisterForm({ ...base, label: " " })).toHaveProperty("error");
    expect(validateRegisterForm({ ...base, registrationCode: "" })).toHaveProperty("error");
  });

  it("requires and sends the address only once the API asked for it", () => {
    expect(validateRegisterForm({ ...base, needsAddress: true, line1: "1 George St", city: "Sydney", state: "NSW" })).toHaveProperty("error");
    expect(validateRegisterForm({ ...base, needsAddress: true, line1: "1 George St", city: "Sydney", state: "NSW", postcode: "2000" })).toMatchObject({
      address: { line1: "1 George St", city: "Sydney", state: "NSW", postcode: "2000" },
    });
  });
});
