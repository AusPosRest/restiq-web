import { describe, expect, it } from "vitest";
import type { BumpedTicketView } from "../../api";
import { formatBumpedSummary, formatRecallSummary, sortBumpedNewestFirst } from "./bumped-view-state";

function ticket(overrides: Partial<BumpedTicketView>): BumpedTicketView {
  return {
    id: "t1",
    orderId: "order-1",
    stationId: "s1",
    stationName: "Tandoor",
    tableLabel: "T4",
    tokenNumber: 1035,
    status: "bumped",
    firedAt: "2026-08-29T09:50:00.000Z",
    bumpedAt: "2026-08-29T10:00:00.000Z",
    recallCount: 0,
    recalled: false,
    lines: [],
    recallHistory: [],
    ...overrides,
  };
}

describe("sortBumpedNewestFirst", () => {
  it("sorts descending by bumpedAt without mutating the input", () => {
    const earlier = ticket({ id: "earlier", bumpedAt: "2026-08-29T09:55:00.000Z" });
    const later = ticket({ id: "later", bumpedAt: "2026-08-29T10:05:00.000Z" });
    const input = [earlier, later];
    const sorted = sortBumpedNewestFirst(input);
    expect(sorted.map((t) => t.id)).toEqual(["later", "earlier"]);
    expect(input.map((t) => t.id)).toEqual(["earlier", "later"]);
  });
});

describe("formatBumpedSummary", () => {
  it("is a static 'Bumped hh:mm · took m:ss' line from firedAt/bumpedAt", () => {
    const summary = formatBumpedSummary({ firedAt: "2026-08-29T09:50:00.000Z", bumpedAt: "2026-08-29T10:00:10.000Z" });
    expect(summary).toContain("Bumped");
    expect(summary).toContain("took 10:10");
  });
});

describe("formatRecallSummary", () => {
  it("is one quiet line naming the count and the most recent recall", () => {
    const summary = formatRecallSummary(["2026-08-29T09:00:00.000Z", "2026-08-29T09:30:00.000Z"]);
    expect(summary).toContain("Recalled 2×");
    expect(summary).toContain("last");
  });

  it("is null for a never-recalled ticket", () => {
    expect(formatRecallSummary([])).toBeNull();
  });
});
