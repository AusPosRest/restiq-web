import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { PaginationControls, usePagination } from "./pagination";

function Harness({ rows, filterKey }: Readonly<{ rows: number[]; filterKey: string }>) {
  const pager = usePagination(rows, filterKey);
  return (
    <div>
      <ul data-testid="rows">
        {pager.items.map((row) => (
          <li key={row}>{row}</li>
        ))}
      </ul>
      <PaginationControls pager={pager} testId="pager" />
    </div>
  );
}

afterEach(cleanup);

describe("usePagination + PaginationControls", () => {
  it("hides the pager when everything fits on one page", () => {
    render(<Harness rows={[1, 2, 3]} filterKey="" />);
    expect(screen.queryByTestId("pager")).toBeNull();
    expect(screen.getByTestId("rows").children).toHaveLength(3);
  });

  it("pages 20 at a time, and a changed filter key returns to page 1", async () => {
    const rows = Array.from({ length: 45 }, (_, i) => i + 1);
    const { rerender } = render(<Harness rows={rows} filterKey="" />);
    expect(screen.getByTestId("rows").children).toHaveLength(20);
    expect(screen.getByTestId("pager-range").textContent).toBe("1–20 of 45");
    expect(screen.getByTestId("pager-prev").hasAttribute("disabled")).toBe(true);

    await userEvent.click(screen.getByTestId("pager-next"));
    await userEvent.click(screen.getByTestId("pager-next"));
    expect(screen.getByTestId("pager-range").textContent).toBe("41–45 of 45");
    expect(screen.getByTestId("pager-next").hasAttribute("disabled")).toBe(true);

    rerender(<Harness rows={rows.slice(0, 25)} filterKey="q" />);
    expect(screen.getByTestId("pager-range").textContent).toBe("1–20 of 25");
  });
});
