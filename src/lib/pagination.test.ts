import { describe, expect, it } from "vitest";
import { paginate } from "./pagination";

const rows = Array.from({ length: 32 }, (_, i) => i + 1);

describe("paginate", () => {
  it("slices 20 per page and reports display bounds", () => {
    expect(paginate(rows, 1)).toMatchObject({ page: 1, pageCount: 2, from: 1, to: 20, total: 32 });
    expect(paginate(rows, 2).items).toEqual(rows.slice(20));
    expect(paginate(rows, 2)).toMatchObject({ from: 21, to: 32 });
  });

  it("clamps out-of-range pages and handles empty lists", () => {
    expect(paginate(rows, 9).page).toBe(2);
    expect(paginate(rows, 0).page).toBe(1);
    expect(paginate(rows, Number.NaN).page).toBe(1);
    expect(paginate([], 3)).toEqual({ items: [], page: 1, pageCount: 1, from: 0, to: 0, total: 0 });
    expect(paginate(rows.slice(0, 20), 1).pageCount).toBe(1);
  });
});
