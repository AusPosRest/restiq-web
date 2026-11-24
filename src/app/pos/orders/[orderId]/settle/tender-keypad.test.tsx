import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TenderKeypad } from "./tender-keypad";

afterEach(cleanup);

function keypad(currency: string, withTerminal = false) {
  render(
    <TenderKeypad
      currency={currency}
      remainingMinor={5000}
      tenders={[]}
      onAddTender={vi.fn()}
      onRemoveTender={vi.fn()}
      onSendToTerminal={withTerminal ? vi.fn() : undefined}
    />,
  );
}

describe("TenderKeypad payment methods", () => {
  it("offers Cash and External, never UPI, for an AUD till", () => {
    keypad("AUD");
    expect(screen.getByTestId("tender-method-cash")).toBeTruthy();
    expect(screen.getByTestId("tender-method-external")).toBeTruthy();
    expect(screen.queryByTestId("tender-method-upi_manual")).toBeNull();
  });

  it("adds Card terminal for AUD when the outlet can send to a terminal", () => {
    keypad("AUD", true);
    expect(screen.getByTestId("tender-method-card_terminal")).toBeTruthy();
    expect(screen.queryByTestId("tender-method-upi_manual")).toBeNull();
  });

  it("still offers UPI for an INR till", () => {
    keypad("INR");
    expect(screen.getByTestId("tender-method-upi_manual")).toBeTruthy();
  });
});
