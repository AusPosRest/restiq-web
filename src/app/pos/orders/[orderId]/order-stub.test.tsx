import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrderStub } from "./order-stub";
import type { OrderStubView } from "../../api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const ORDER: OrderStubView = {
  id: "order-t9",
  tableId: "t9",
  tableLabel: "T9",
  status: "occupied",
  ownerStaffId: "staff-me",
  ownerStaffName: "Ravi",
  openedAt: new Date().toISOString(),
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("OrderStub", () => {
  it("proves the order id round-trips: shows the table and owner it was opened/transferred for", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(ORDER))),
    );
    render(<OrderStub orderId="order-t9" />);

    await waitFor(() => expect(screen.getByTestId("order-stub-view")).toBeTruthy());
    expect(screen.getByText("Table T9")).toBeTruthy();
    expect(screen.getByText("Ravi")).toBeTruthy();
    expect(screen.getByTestId("back-to-table-map").getAttribute("href")).toBe("/pos/table-map");
  });

  it("shows a retryable error panel when the order can't be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse({ error: { message: "not found" } }, 404))),
    );
    render(<OrderStub orderId="missing" />);

    await waitFor(() => expect(screen.getByTestId("order-stub-error")).toBeTruthy());
  });
});
