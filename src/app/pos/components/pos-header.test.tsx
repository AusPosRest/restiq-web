// Shared POS header (issue #335): the switch shows the current mode and links to the other.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModeToggle, PosHeader } from "./pos-header";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

afterEach(() => cleanup());

describe("ModeToggle", () => {
  it("shows the current mode and links to the other one", () => {
    render(<ModeToggle current="counter" />);
    expect(screen.getByTestId("pos-mode-counter").dataset.active).toBe("true");
    expect(screen.getByTestId("pos-mode-tables").dataset.active).toBe("false");
    const toggle = screen.getByTestId("pos-mode-toggle");
    expect(toggle.getAttribute("href")).toBe("/pos/table-map");
    expect(toggle.getAttribute("aria-label")).toBe("Switch to Tables mode");
  });

  it("links back to the counter from the table map", () => {
    render(<ModeToggle current="tables" />);
    expect(screen.getByTestId("pos-mode-toggle").getAttribute("href")).toBe("/pos/counter");
  });

  it("renders the title, subtitle, toggle and the screen's own actions", () => {
    render(
      <PosHeader subtitle="Table Map" mode="tables">
        <button type="button" data-testid="extra-action">Refresh</button>
      </PosHeader>,
    );
    expect(screen.getByText("Table Map")).toBeTruthy();
    // PE-19: the till can be locked, and the shift screens reached, from here.
    expect(screen.getByTestId("pos-lock-till").textContent).toContain("Lock");
    expect(screen.getByTestId("pos-header-more").getAttribute("href")).toBe("/pos/shift");
    expect(screen.getByTestId("pos-mode-tables").dataset.active).toBe("true");
    expect(screen.getByTestId("extra-action")).toBeTruthy();
  });
});
