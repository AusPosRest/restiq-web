import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import PrivacyPage, { metadata } from "./page";

afterEach(cleanup);

describe("Privacy policy page (issue #435)", () => {
  it("has the title, one h1 and section headings", () => {
    render(<PrivacyPage />);
    expect(metadata.title).toBe("Privacy policy · RESTIQ");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThanOrEqual(8);
    expect(screen.getByTestId("privacy-updated").textContent).toBe("Last updated: 13 November 2026");
  });

  it("keeps the placeholder tokens to fill in", () => {
    const { container } = render(<PrivacyPage />);
    for (const token of ["[BUSINESS LEGAL NAME]", "[ABN]", "[CONTACT EMAIL]", "[POSTAL ADDRESS]"]) {
      expect(container.textContent).toContain(token);
    }
  });
});
