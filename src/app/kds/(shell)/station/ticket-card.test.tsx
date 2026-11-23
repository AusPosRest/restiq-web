// #388: a long ticket splits into side-by-side cards so BUMP/REFIRE never fall below the fold.
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { TicketLineView, TicketView } from "../../api";
import { TicketCard } from "./ticket-card";

const FIRED_AT = "2026-08-29T10:00:00.000Z";

function lines(count: number, addOnBatchFrom = Infinity): TicketLineView[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `l${i}`,
    orderLineId: `ol${i}`,
    itemId: "i1",
    itemName: `Dish ${i}`,
    variantName: null,
    quantity: 1,
    seatNumber: null,
    modifiers: [],
    addOnBatch: i >= addOnBatchFrom ? 1 : 0,
    voided: false,
  }));
}

function renderCard(overrides: Partial<TicketView>) {
  const ticket: TicketView = {
    id: "t1",
    orderId: "order-1",
    stationId: "s1",
    stationName: "Tandoor",
    tableLabel: null,
    tokenNumber: 1035,
    status: "queued",
    firedAt: FIRED_AT,
    bumpedAt: null,
    recallCount: 0,
    recalled: false,
    lines: [],
    ...overrides,
  };
  const noop = () => undefined;
  return render(
    <div data-testid="rail">
      <TicketCard ticket={ticket} ageingThresholdMinutes={10} nowMs={Date.parse(FIRED_AT) + 65_000} pending={false} errorMessage={null} onBump={noop} onRecall={noop} onRefire={noop} bumpedSummary="Bumped 10:00 · took 10:00" />
    </div>,
  );
}

describe("TicketCard split (#388)", () => {
  afterEach(cleanup);

  it("splits a 20-line queued ticket into two cards with BUMP/REFIRE only on the last", () => {
    renderCard({ lines: lines(20) });

    const articles = screen.getByTestId("rail").querySelectorAll("article");
    expect(articles).toHaveLength(2);
    const [first, last] = [screen.getByTestId("kds-ticket-t1"), screen.getByTestId("kds-ticket-t1-part-2")];
    expect(screen.getByTestId("kds-ticket-t1-part-1-label").textContent).toBe("1/2");
    expect(screen.getByTestId("kds-ticket-t1-part-2-label").textContent).toBe("cont. 2/2");
    expect(within(last).getByText("#1035")).toBeTruthy();
    expect(last.getAttribute("data-ageing")).toBe(first.getAttribute("data-ageing"));

    expect(screen.getAllByText("BUMP")).toHaveLength(1);
    expect(screen.getAllByText("REFIRE")).toHaveLength(1);
    expect(within(last).getByTestId("kds-ticket-t1-bump")).toBeTruthy();
    expect(within(last).getByTestId("kds-ticket-t1-refire")).toBeTruthy();

    // Ageing colour never stands alone: elapsed time on every part.
    expect(within(first).getByTestId("kds-ticket-t1-elapsed").textContent).toBe("1m 05s");
    expect(within(last).getByTestId("kds-ticket-t1-part-2-elapsed").textContent).toBe("1m 05s");
  });

  it("repeats the ADD-ON divider on a later card when the batch carries over", () => {
    renderCard({ lines: lines(20, 10) });

    expect(within(screen.getByTestId("kds-ticket-t1")).getByTestId("kds-ticket-t1-addon-1")).toBeTruthy();
    expect(within(screen.getByTestId("kds-ticket-t1-part-2")).getByTestId("kds-ticket-t1-part-2-addon-1").textContent).toContain("ADD-ON");
  });

  it("renders a short ticket as one card with no part label", () => {
    renderCard({ lines: lines(3) });

    expect(screen.getByTestId("rail").querySelectorAll("article")).toHaveLength(1);
    expect(screen.queryByTestId("kds-ticket-t1-part-1-label")).toBeNull();
    expect(screen.getByTestId("kds-ticket-t1-bump")).toBeTruthy();
  });

  it("puts RECALL only on the last card of a long bumped ticket", () => {
    renderCard({ status: "bumped", bumpedAt: FIRED_AT, lines: lines(20) });

    expect(screen.getAllByText("RECALL")).toHaveLength(1);
    expect(within(screen.getByTestId("kds-ticket-t1-part-2")).getByTestId("kds-ticket-t1-recall")).toBeTruthy();
    expect(screen.getByTestId("kds-ticket-t1-part-2").hasAttribute("data-ageing")).toBe(false);
  });
});
