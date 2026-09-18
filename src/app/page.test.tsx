import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// next/font only works inside the Next compiler.
vi.mock("./landing-fonts", () => ({ display: { variable: "" }, body: { variable: "" }, mono: { variable: "" } }));

import Home from "./page";

afterEach(cleanup);

describe("Marketing landing page (issue #262)", () => {
  it("leads with the offline promise and sends visitors to the live demo, now at /demo", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/keeps cooking when the internet/);
    for (const id of ["landing-nav-demo", "landing-hero-demo", "landing-cta-demo", "landing-footer-demo"]) {
      expect(screen.getByTestId(id).getAttribute("href")).toBe("/demo");
    }
  });

  it("links every surface's sign-in from the footer", () => {
    render(<Home />);
    expect(screen.getByTestId("landing-footer-pos").getAttribute("href")).toBe("/pos/login");
    expect(screen.getByTestId("landing-footer-kds").getAttribute("href")).toBe("/kds");
    expect(screen.getByTestId("landing-footer-admin").getAttribute("href")).toBe("/admin/login");
    expect(screen.getByTestId("landing-footer-ops").getAttribute("href")).toBe("/ops/login");
  });

  it("anchors the nav to real sections", () => {
    const { container } = render(<Home />);
    for (const id of ["product", "offline", "payments", "faq"]) {
      expect(container.querySelector(`#${id}`)).not.toBeNull();
    }
  });
});
