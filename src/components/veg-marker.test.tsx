import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { VegMarker } from "./veg-marker";

describe("VegMarker", () => {
  afterEach(cleanup);

  it("labels a vegetarian dish and uses the healthy (green) colour", () => {
    render(<VegMarker marker="veg" data-testid="vm" />);
    const el = screen.getByTestId("vm");
    expect(el.getAttribute("role")).toBe("img");
    expect(el.getAttribute("aria-label")).toBe("Vegetarian");
    expect(el.className).toContain("text-status-available");
  });

  it("labels a non-vegetarian dish and uses the error (red) colour", () => {
    render(<VegMarker marker="non_veg" data-testid="vm" />);
    const el = screen.getByTestId("vm");
    expect(el.getAttribute("aria-label")).toBe("Non-vegetarian");
    expect(el.className).toContain("text-destructive");
  });

  it.each([null, undefined])("renders nothing for %s", (marker) => {
    const { container } = render(<VegMarker marker={marker} data-testid="vm" />);
    expect(container.firstChild).toBeNull();
  });
});
