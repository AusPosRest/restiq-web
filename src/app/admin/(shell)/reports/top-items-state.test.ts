import { describe, expect, it } from "vitest";
import { topItemLabel } from "./top-items-state";

describe("topItemLabel", () => {
  it("appends the portion when there is one", () => {
    expect(topItemLabel({ name: "Biryani", portionName: "Half" })).toBe("Biryani (Half)");
    expect(topItemLabel({ name: "Dosa", portionName: null })).toBe("Dosa");
  });
});
