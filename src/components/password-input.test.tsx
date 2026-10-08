import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { PasswordInput } from "./password-input";

afterEach(cleanup);

describe("PasswordInput", () => {
  it("toggles between hidden and visible password", async () => {
    render(<PasswordInput id="pw" data-testid="pw" toggleTestId="pw-toggle" name="password" />);
    const input = screen.getByTestId("pw");
    const toggle = screen.getByTestId("pw-toggle");

    expect(input.getAttribute("type")).toBe("password");
    expect(toggle.getAttribute("aria-label")).toBe("Show password");

    await userEvent.click(toggle);
    expect(input.getAttribute("type")).toBe("text");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(toggle.getAttribute("aria-label")).toBe("Hide password");

    await userEvent.click(toggle);
    expect(input.getAttribute("type")).toBe("password");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(toggle.getAttribute("aria-label")).toBe("Show password");
  });
});
