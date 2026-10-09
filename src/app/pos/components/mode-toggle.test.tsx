// Counter | Tables toggle (issue #335): marks the current mode, links to both.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ModeToggle } from "./mode-toggle";

afterEach(() => cleanup());

describe("ModeToggle", () => {
  it("marks the current mode and links to the other", () => {
    render(<ModeToggle current="counter" />);
    expect(screen.getByTestId("pos-mode-counter").getAttribute("aria-current")).toBe("page");
    expect(screen.getByTestId("pos-mode-tables").getAttribute("aria-current")).toBeNull();
    expect(screen.getByTestId("pos-mode-tables").getAttribute("href")).toBe("/pos/table-map");
    expect(screen.getByTestId("pos-mode-counter").getAttribute("href")).toBe("/pos/counter");
  });
});
