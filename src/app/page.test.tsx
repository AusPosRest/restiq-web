import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Home from "./page";

describe("Landing page", () => {
  afterEach(cleanup);

  it("renders a navigable card for every user surface with its entry route", () => {
    render(<Home />);
    const routes = [
      "/ops/login",
      "/admin",
      "/pos/login",
      "/kds",
      "/device",
    ];
    for (const href of routes) {
      const card = screen.getByTestId(`landing-card-${href}`);
      expect(card.getAttribute("href")).toBe(href);
    }
    // The guest QR card carries a full table-session URL, not a bare route.
    const guest = screen.getByText("Guest QR Self-Order").closest("a");
    expect(guest?.getAttribute("href")).toContain("/qr/t/");
  });

  it("shows the demo POS PINs so a tester can sign in without setup", () => {
    render(<Home />);
    expect(screen.getByText("PIN 1234")).toBeTruthy();
    expect(screen.getByText("PIN 9999")).toBeTruthy();
  });
});
