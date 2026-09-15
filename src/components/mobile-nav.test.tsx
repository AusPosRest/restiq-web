import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MobileNav } from "./mobile-nav";

afterEach(cleanup);

describe("MobileNav (issue #228)", () => {
  it("opens the drawer with the nav it's given, in the console's theme, and closes when a link is tapped", async () => {
    render(
      <MobileNav title="RESTIQ" subtitle="Owner Console" themeClass="admin-theme">
        <a href="#menu" data-testid="nav-link">
          Menu
        </a>
      </MobileNav>,
    );
    expect(screen.queryByTestId("mobile-nav")).toBeNull();

    fireEvent.click(screen.getByTestId("mobile-nav-open"));
    const drawer = await screen.findByTestId("mobile-nav");
    expect(drawer.className).toContain("admin-theme");
    expect(drawer.textContent).toContain("Owner Console");

    fireEvent.click(screen.getByTestId("nav-link"));
    await waitFor(() => expect(screen.queryByTestId("mobile-nav")).toBeNull());
  });
});
