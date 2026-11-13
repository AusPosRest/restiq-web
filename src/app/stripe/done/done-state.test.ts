import { describe, expect, it } from "vitest";
import { doneResult } from "./done-state";

const TENANT = "0192cccc-0000-7000-8000-000000000003";
const base = { tenant: TENANT, slug: "joes", baseDomain: "niftypos.com.au" };

describe("doneResult", () => {
  it("sends operators back to the tenant's tab", () => {
    expect(doneResult({ ...base, flow: "onboarding", isOperator: true })).toMatchObject({ kind: "success", href: `/ops/tenants/${TENANT}?tab=payments`, seconds: 5 });
    expect(doneResult({ ...base, flow: "billing", isOperator: true }).href).toBe(`/ops/tenants/${TENANT}?tab=subscription`);
    expect(doneResult({ ...base, flow: "expired", isOperator: true })).toMatchObject({ kind: "expired", href: `/ops/tenants/${TENANT}?tab=payments`, seconds: 2 });
  });

  it("sends owners to their admin, or nowhere without a slug", () => {
    expect(doneResult({ ...base, flow: "onboarding", isOperator: false }).href).toBe("https://joes.niftypos.com.au/admin");
    expect(doneResult({ ...base, slug: undefined, flow: "onboarding", isOperator: false }).href).toBeNull();
    expect(doneResult({ ...base, baseDomain: undefined, flow: "billing", isOperator: false }).href).toBeNull();
  });

  it("refuses tenant and slug values that would change the URL", () => {
    expect(doneResult({ ...base, tenant: "../../evil", flow: "onboarding", isOperator: true }).href).toBe("/ops/tenants");
    expect(doneResult({ ...base, slug: "evil.com/x?", flow: "onboarding", isOperator: false }).href).toBeNull();
  });

  it("maps billing cancel and unknown flows", () => {
    expect(doneResult({ ...base, flow: "billing", cancelled: "1", isOperator: false }).kind).toBe("cancelled");
    expect(doneResult({ ...base, flow: "billing", isOperator: false }).title).toBe("Card saved");
    expect(doneResult({ ...base, flow: "whatever", isOperator: false }).kind).toBe("expired");
  });
});
