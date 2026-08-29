import { describe, expect, it } from "vitest";
import type { ExpoOrderView, ExpoStationEntryView, TicketLineView, TicketView } from "../../api";
import { buildWaitingOnEntries, oldestUnbumpedTicket, readyProgress, rollUpItems, sortOrdersOldestFirst } from "./expo-state";

function line(overrides: Partial<TicketLineView>): TicketLineView {
  return {
    id: "l1",
    orderLineId: "ol1",
    itemId: "i1",
    itemName: "Garlic Naan",
    variantName: null,
    quantity: 1,
    seatNumber: null,
    modifiers: [],
    addOnBatch: 0,
    voided: false,
    ...overrides,
  };
}

function ticket(overrides: Partial<TicketView>): TicketView {
  return {
    id: "t1",
    orderId: "order-1",
    stationId: "s1",
    stationName: "Tandoor",
    tableLabel: "T4",
    tokenNumber: 1035,
    status: "queued",
    firedAt: "2026-08-29T10:00:00.000Z",
    bumpedAt: null,
    recallCount: 0,
    recalled: false,
    lines: [],
    ...overrides,
  };
}

function stationEntry(overrides: Partial<ExpoStationEntryView>): ExpoStationEntryView {
  return { stationId: "s1", stationName: "Tandoor", ready: false, tickets: [], ...overrides };
}

function order(overrides: Partial<ExpoOrderView>): ExpoOrderView {
  return { orderId: "order-1", tableLabel: "T4", tokenNumber: 1035, stations: [], waitingOn: [], ...overrides };
}

describe("rollUpItems", () => {
  it("sums quantity for the same item+variant across the original fire and an ADD-ON batch", () => {
    const tickets = [
      { lines: [line({ id: "l1", itemId: "naan", itemName: "Garlic Naan", quantity: 2, addOnBatch: 0 })] },
      { lines: [line({ id: "l2", itemId: "naan", itemName: "Garlic Naan", quantity: 1, addOnBatch: 1 })] },
    ];
    expect(rollUpItems(tickets)).toEqual([{ key: "naan:", itemName: "Garlic Naan", variantName: null, quantity: 3 }]);
  });

  it("keeps distinct variants of the same item separate", () => {
    const tickets = [{ lines: [line({ id: "l1", itemId: "naan", variantName: "Butter" }), line({ id: "l2", itemId: "naan", variantName: "Garlic" })] }];
    expect(rollUpItems(tickets).map((i) => i.variantName)).toEqual(["Butter", "Garlic"]);
  });

  it("drops voided lines - a void was never going to be served", () => {
    const tickets = [{ lines: [line({ id: "l1", quantity: 5, voided: true })] }];
    expect(rollUpItems(tickets)).toEqual([]);
  });
});

describe("readyProgress", () => {
  it("counts ready stations against the order's total station count", () => {
    const o = order({ stations: [stationEntry({ ready: true }), stationEntry({ ready: false }), stationEntry({ ready: true })] });
    expect(readyProgress(o)).toEqual({ ready: 2, total: 3 });
  });
});

describe("oldestUnbumpedTicket", () => {
  it("finds the oldest still-queued ticket across every station", () => {
    const o = order({
      stations: [
        stationEntry({ stationId: "curry", tickets: [ticket({ id: "t-curry", stationId: "curry", firedAt: "2026-08-29T10:02:00.000Z" })] }),
        stationEntry({ stationId: "tandoor", tickets: [ticket({ id: "t-tandoor", stationId: "tandoor", firedAt: "2026-08-29T09:55:00.000Z" })] }),
      ],
    });
    expect(oldestUnbumpedTicket(o)).toEqual({ firedAt: "2026-08-29T09:55:00.000Z", stationId: "tandoor" });
  });

  it("ignores bumped tickets - they no longer age the order", () => {
    const o = order({
      stations: [stationEntry({ stationId: "curry", tickets: [ticket({ status: "bumped", firedAt: "2026-08-29T09:00:00.000Z" })] })],
    });
    expect(oldestUnbumpedTicket(o)).toBeNull();
  });
});

describe("sortOrdersOldestFirst", () => {
  it("orders by oldest still-queued ticket, longest-waiting first", () => {
    const older = order({
      orderId: "older",
      stations: [stationEntry({ tickets: [ticket({ id: "a", firedAt: "2026-08-29T09:50:00.000Z" })] })],
    });
    const newer = order({
      orderId: "newer",
      stations: [stationEntry({ tickets: [ticket({ id: "b", firedAt: "2026-08-29T09:59:00.000Z" })] })],
    });
    expect(sortOrdersOldestFirst([newer, older]).map((o) => o.orderId)).toEqual(["older", "newer"]);
  });

  it("falls back to a fully-ready order's earliest ticket overall, rather than dropping it to an arbitrary end", () => {
    const ready = order({
      orderId: "ready",
      stations: [stationEntry({ tickets: [ticket({ id: "a", status: "bumped", firedAt: "2026-08-29T09:00:00.000Z" })] })],
    });
    const stillCooking = order({
      orderId: "cooking",
      stations: [stationEntry({ tickets: [ticket({ id: "b", firedAt: "2026-08-29T09:30:00.000Z" })] })],
    });
    expect(sortOrdersOldestFirst([stillCooking, ready]).map((o) => o.orderId)).toEqual(["ready", "cooking"]);
  });
});

describe("buildWaitingOnEntries", () => {
  it("flattens each order's authoritative waitingOn lines with station/table/firedAt context, oldest-first", () => {
    const waitingLine = line({ id: "l-naan", itemName: "Garlic Naan" });
    const t = ticket({ id: "t1", stationId: "tandoor", firedAt: "2026-08-29T09:58:00.000Z", lines: [waitingLine] });
    const o = order({
      orderId: "order-1",
      tableLabel: "T7",
      tokenNumber: 1042,
      stations: [stationEntry({ stationId: "tandoor", stationName: "Tandoor", ready: false, tickets: [t] })],
      waitingOn: [waitingLine],
    });

    const entries = buildWaitingOnEntries([o]);
    expect(entries).toEqual([
      {
        orderId: "order-1",
        tableLabel: "T7",
        tokenNumber: 1042,
        stationId: "tandoor",
        stationName: "Tandoor",
        firedAt: "2026-08-29T09:58:00.000Z",
        line: waitingLine,
      },
    ]);
  });

  it("sorts across multiple orders by firedAt, oldest first", () => {
    const olderLine = line({ id: "older-line" });
    const newerLine = line({ id: "newer-line" });
    const olderTicket = ticket({ id: "t-older", firedAt: "2026-08-29T09:00:00.000Z", lines: [olderLine] });
    const newerTicket = ticket({ id: "t-newer", firedAt: "2026-08-29T09:10:00.000Z", lines: [newerLine] });
    const orders = [
      order({ orderId: "o2", stations: [stationEntry({ tickets: [newerTicket] })], waitingOn: [newerLine] }),
      order({ orderId: "o1", stations: [stationEntry({ tickets: [olderTicket] })], waitingOn: [olderLine] }),
    ];
    expect(buildWaitingOnEntries(orders).map((e) => e.line.id)).toEqual(["older-line", "newer-line"]);
  });

  it("drops a waitingOn line with no owning queued ticket found (defensive - structurally shouldn't happen)", () => {
    const orphan = line({ id: "orphan" });
    const o = order({ stations: [], waitingOn: [orphan] });
    expect(buildWaitingOnEntries([o])).toEqual([]);
  });
});
