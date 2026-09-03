import { describe, expect, it } from "vitest";
import {
  appendPaymentsPage,
  defaultDateRange,
  formatBillTime,
  outletDateEndIso,
  outletDateStartIso,
  outletLocalDate,
  refundedMinorFor,
  sourceLabel,
  tableOrTokenLabel,
  taxLines,
  toIsoRange,
  type PaymentRow,
  type PaymentsResponse,
} from "./payments-state";

const KOLKATA = "Asia/Kolkata"; // UTC+5:30, no DST - deterministic across the year.

function paymentRow(overrides: Partial<PaymentRow> = {}): PaymentRow {
  return {
    billId: "bill-1",
    billNumber: 101,
    finalizedAt: "2026-09-03T08:05:00.000Z",
    outletId: "outlet-1",
    outletName: "Indiranagar",
    orderId: "order-1",
    source: "pos",
    tableLabel: null,
    tokenNumber: null,
    cashierName: "Asha",
    subtotalMinor: 100000,
    discountMinor: null,
    discountReason: null,
    taxMinor: 5000,
    totalMinor: 105000,
    tenders: [],
    creditNotes: [],
    ...overrides,
  };
}

describe("outletLocalDate", () => {
  it("rolls the calendar date forward past the outlet's local midnight", () => {
    expect(outletLocalDate(new Date("2026-09-03T20:00:00.000Z"), KOLKATA)).toBe("2026-09-04");
  });

  it("keeps the same calendar date earlier in the outlet's day", () => {
    expect(outletLocalDate(new Date("2026-09-03T10:00:00.000Z"), KOLKATA)).toBe("2026-09-03");
  });
});

describe("outletDateStartIso / outletDateEndIso", () => {
  it("converts an outlet-local calendar date's start-of-day to the matching UTC instant", () => {
    expect(outletDateStartIso("2026-09-03", KOLKATA)).toBe("2026-09-02T18:30:00.000Z");
  });

  it("converts an outlet-local calendar date's end-of-day to the matching UTC instant", () => {
    expect(outletDateEndIso("2026-09-03", KOLKATA)).toBe("2026-09-03T18:29:59.999Z");
  });
});

describe("defaultDateRange", () => {
  it("defaults both ends of the range to today, outlet-local", () => {
    expect(defaultDateRange(new Date("2026-09-03T20:00:00.000Z"), KOLKATA)).toEqual({
      fromDate: "2026-09-04",
      toDate: "2026-09-04",
    });
  });
});

describe("toIsoRange", () => {
  it("expands local calendar dates to the API's from/to ISO instants", () => {
    expect(toIsoRange({ fromDate: "2026-09-03", toDate: "2026-09-03" }, KOLKATA)).toEqual({
      from: "2026-09-02T18:30:00.000Z",
      to: "2026-09-03T18:29:59.999Z",
    });
  });

  it("spans multiple days when from and to differ", () => {
    expect(toIsoRange({ fromDate: "2026-09-01", toDate: "2026-09-03" }, KOLKATA)).toEqual({
      from: "2026-08-31T18:30:00.000Z",
      to: "2026-09-03T18:29:59.999Z",
    });
  });
});

describe("tableOrTokenLabel", () => {
  it("prefers the table label when present", () => {
    expect(tableOrTokenLabel({ tableLabel: "T4", tokenNumber: 7 })).toBe("T4");
  });

  it("falls back to a token number", () => {
    expect(tableOrTokenLabel({ tableLabel: null, tokenNumber: 12 })).toBe("Token #12");
  });

  it("falls back to an em dash when neither is present", () => {
    expect(tableOrTokenLabel({ tableLabel: null, tokenNumber: null })).toBe("—");
  });
});

describe("sourceLabel", () => {
  it("maps pos to POS and qr to QR", () => {
    expect(sourceLabel("pos")).toBe("POS");
    expect(sourceLabel("qr")).toBe("QR");
  });
});

describe("taxLines", () => {
  it("renders a labelled line per breakdown entry when present", () => {
    const row = paymentRow({
      taxMinor: 7000,
      taxBreakdown: [
        { label: "CGST", ratePercent: 2.5, amountMinor: 2500 },
        { label: "SGST", ratePercent: 2.5, amountMinor: 2500 },
      ],
    });
    expect(taxLines(row)).toEqual([
      { label: "CGST (2.5%)", amountMinor: 2500 },
      { label: "SGST (2.5%)", amountMinor: 2500 },
    ]);
  });

  it("falls back to one unlabelled line off taxMinor when the breakdown is absent", () => {
    const row = paymentRow({ taxMinor: 5000 });
    expect(taxLines(row)).toEqual([{ label: "", amountMinor: 5000 }]);
  });

  it("falls back to taxMinor when the breakdown is an empty array", () => {
    const row = paymentRow({ taxMinor: 5000, taxBreakdown: [] });
    expect(taxLines(row)).toEqual([{ label: "", amountMinor: 5000 }]);
  });
});

describe("refundedMinorFor", () => {
  it("sums credit note amounts", () => {
    const row = paymentRow({
      creditNotes: [
        { id: "cn-1", amountMinor: 100, reason: "Wrong item", createdAt: "2026-09-03T09:00:00.000Z" },
        { id: "cn-2", amountMinor: 50, reason: "Goodwill", createdAt: "2026-09-03T09:05:00.000Z" },
      ],
    });
    expect(refundedMinorFor(row)).toBe(150);
  });

  it("is zero when there are no credit notes", () => {
    expect(refundedMinorFor(paymentRow())).toBe(0);
  });
});

describe("formatBillTime", () => {
  it("renders the outlet-local clock time", () => {
    expect(formatBillTime("2026-09-03T08:05:00.000Z", KOLKATA)).toMatch(/1:35\s?PM/i);
  });
});

describe("appendPaymentsPage", () => {
  it("appends the page's items and replaces the cursor and totals", () => {
    const totals = { count: 2, subtotalMinor: 1, discountMinor: 0, taxMinor: 0, totalMinor: 1, tenderedMinor: 1, refundedMinor: 0 };
    const current: PaymentsResponse = { items: [paymentRow({ billId: "bill-1" })], nextCursor: "cursor-1", totals };
    const page: PaymentsResponse = { items: [paymentRow({ billId: "bill-2" })], nextCursor: "cursor-2", totals };

    const merged = appendPaymentsPage(current, page);

    expect(merged.items.map((row) => row.billId)).toEqual(["bill-1", "bill-2"]);
    expect(merged.nextCursor).toBe("cursor-2");
    expect(merged.totals).toBe(totals);
  });

  it("clears the cursor once the last page reports none", () => {
    const totals = { count: 1, subtotalMinor: 1, discountMinor: 0, taxMinor: 0, totalMinor: 1, tenderedMinor: 1, refundedMinor: 0 };
    const current: PaymentsResponse = { items: [paymentRow()], nextCursor: "cursor-1", totals };
    const page: PaymentsResponse = { items: [], nextCursor: null, totals };

    expect(appendPaymentsPage(current, page).nextCursor).toBeNull();
  });
});
