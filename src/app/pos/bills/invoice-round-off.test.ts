import { describe, expect, it } from "vitest";
import { invoiceCashRoundOff } from "./invoice-round-off";

const cash = (amountMinor: number) => ({ method: "cash", amountMinor, createdAt: "2026-10-11T10:00:00.000Z" });

describe("invoiceCashRoundOff (CU-11)", () => {
  it("rounds an all-cash rupee bill, carrying the round-off on the last cash tender", () => {
    const result = invoiceCashRoundOff({ status: "finalized", currency: "INR", totalMinor: 89040, tenders: [cash(50000), cash(39040)] });
    expect(result.roundOffMinor).toBe(-40);
    expect(result.tenders.map((t) => t.amountMinor)).toEqual([50000, 39000]);
  });

  it("leaves mixed-tender, open, and AUD bills exact", () => {
    expect(invoiceCashRoundOff({ status: "finalized", currency: "INR", totalMinor: 89040, tenders: [cash(50000), { ...cash(39040), method: "upi_manual" }] }).roundOffMinor).toBe(0);
    expect(invoiceCashRoundOff({ status: "open", currency: "INR", totalMinor: 89040, tenders: [] }).roundOffMinor).toBe(0);
    expect(invoiceCashRoundOff({ status: "finalized", currency: "AUD", totalMinor: 1995, tenders: [cash(1995)] }).roundOffMinor).toBe(0);
  });
});
