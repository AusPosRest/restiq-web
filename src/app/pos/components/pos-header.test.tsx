// Shared POS header (issue #335): the toggle marks the current mode and links to both.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ModeToggle, PosHeader } from "./pos-header";

afterEach(() => cleanup());

describe("ModeToggle", () => {
  it("marks the current mode and links to the other", () => {
    render(<ModeToggle current="counter" />);
    expect(screen.getByTestId("pos-mode-counter").getAttribute("aria-current")).toBe("page");
    expect(screen.getByTestId("pos-mode-tables").getAttribute("aria-current")).toBeNull();
    expect(screen.getByTestId("pos-mode-tables").getAttribute("href")).toBe("/pos/table-map");
    expect(screen.getByTestId("pos-mode-counter").getAttribute("href")).toBe("/pos/counter");
  });

  it("renders the title, subtitle, toggle and the screen's own actions", () => {
    render(
      <PosHeader subtitle="Table Map" mode="tables">
        <button type="button" data-testid="extra-action">Refresh</button>
      </PosHeader>,
    );
    expect(screen.getByText("Table Map")).toBeTruthy();
    expect(screen.getByTestId("pos-mode-tables").getAttribute("aria-current")).toBe("page");
    expect(screen.getByTestId("extra-action")).toBeTruthy();
  });
});
