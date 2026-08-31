import { describe, expect, it } from "vitest";
import {
  dataFromDraft,
  emptyWizardData,
  firstIncompleteStep,
  toSubmitPayload,
  validateStep,
} from "./wizard-state";

function completeData() {
  const data = emptyWizardData();
  data.business = {
    companyName: "Spice Route Hospitality",
    registeredAddress: "12 MG Road, Bengaluru",
    contactName: "Arjun Mehta",
    contactEmail: "arjun@spiceroute.example",
    contactPhone: "+91 98765 43210",
  };
  data.tax = {
    country: "IN",
    registrationNumber: "29ABCDE1234F1Z5",
    legalEntityName: "Spice Route Hospitality Pvt Ltd",
    taxProfile: "India GST - CGST/SGST split",
    fssaiLicense: "",
    compositionScheme: false,
  };
  data.brandsOutlets = {
    brandName: "Spice Route",
    outlets: [{ name: "Indiranagar", address: "100 Feet Road", type: "dine_in", timezone: "Asia/Kolkata" }],
  };
  data.subscription = { plan: "enterprise", billingPeriod: "monthly" };
  data.ownerInvite = { email: "owner@spiceroute.example", firstName: "Arjun", lastName: "Mehta" };
  return data;
}

describe("validateStep", () => {
  it("flags every missing required field on step 1", () => {
    const errors = validateStep(1, emptyWizardData());
    expect(Object.keys(errors).sort()).toEqual([
      "companyName",
      "contactEmail",
      "contactName",
      "contactPhone",
      "registeredAddress",
    ]);
  });

  it("rejects a malformed contact email", () => {
    const data = completeData();
    data.business.contactEmail = "not-an-email";
    expect(validateStep(1, data)).toHaveProperty("contactEmail");
  });

  it("validates GSTIN format for India", () => {
    const data = completeData();
    data.tax.registrationNumber = "BADGSTIN";
    expect(validateStep(2, data)).toHaveProperty("registrationNumber");
    data.tax.registrationNumber = "29ABCDE1234F1Z5";
    expect(validateStep(2, data)).toEqual({});
  });

  it("validates ABN format for Australia", () => {
    const data = completeData();
    data.tax.country = "AU";
    data.tax.registrationNumber = "29ABCDE1234F1Z5";
    expect(validateStep(2, data)).toHaveProperty("registrationNumber");
    data.tax.registrationNumber = "51824753556";
    expect(validateStep(2, data)).toEqual({});
  });

  it("rejects a non-14-digit FSSAI licence but accepts an empty one", () => {
    const data = completeData();
    data.tax.fssaiLicense = "123";
    expect(validateStep(2, data)).toHaveProperty("fssaiLicense");
    data.tax.fssaiLicense = "";
    expect(validateStep(2, data)).toEqual({});
  });

  it("indexes outlet errors per outlet", () => {
    const data = completeData();
    data.brandsOutlets.outlets.push({ name: "", address: "", type: "", timezone: "Asia/Kolkata" });
    const errors = validateStep(3, data);
    expect(errors["outlets.1.name"]).toBeTruthy();
    expect(errors["outlets.1.address"]).toBeTruthy();
    expect(errors["outlets.1.type"]).toBeTruthy();
    expect(errors["outlets.0.name"]).toBeUndefined();
  });

  it("requires a plan on step 4 and full owner details on step 5", () => {
    const data = completeData();
    data.subscription.plan = "";
    expect(validateStep(4, data)).toHaveProperty("plan");
    data.ownerInvite.email = "";
    expect(validateStep(5, data)).toHaveProperty("email");
  });
});

describe("firstIncompleteStep", () => {
  it("is 1 for an empty wizard and 5 for a complete one", () => {
    expect(firstIncompleteStep(emptyWizardData())).toBe(1);
    expect(firstIncompleteStep(completeData())).toBe(5);
  });

  it("lands on the first step whose data does not validate", () => {
    const data = completeData();
    data.brandsOutlets.brandName = "";
    expect(firstIncompleteStep(data)).toBe(3);
  });
});

describe("dataFromDraft", () => {
  it("merges saved steps over the empty shape and ignores junk", () => {
    const data = dataFromDraft({
      "1": { companyName: "Draft Co" },
      "4": { plan: "standard" },
      "5": "garbage",
    });
    expect(data.business.companyName).toBe("Draft Co");
    expect(data.business.contactEmail).toBe("");
    expect(data.subscription.plan).toBe("standard");
    expect(data.ownerInvite.email).toBe("");
  });
});

describe("toSubmitPayload", () => {
  it("normalizes the registration number and omits an empty FSSAI licence", () => {
    const data = completeData();
    data.tax.registrationNumber = " 29abcde1234f1z5 ";
    const payload = toSubmitPayload(data) as { tax: Record<string, unknown> };
    expect(payload.tax.registrationNumber).toBe("29ABCDE1234F1Z5");
    expect(payload.tax).not.toHaveProperty("fssaiLicense");
  });
});
