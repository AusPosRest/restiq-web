// The shared CAP-8 manager-authorisation gate: no PIN+reason, no approve.
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ManagerPinDialog, type ManagerApprovalResult } from "./manager-pin-dialog";

afterEach(() => cleanup());

function renderDialog(overrides: Partial<React.ComponentProps<typeof ManagerPinDialog>> = {}) {
  const onOpenChange = vi.fn();
  const onApprove = vi.fn<(pin: string, reasonCode: string) => Promise<ManagerApprovalResult>>(
    async () => ({ ok: true }),
  );

  const props: React.ComponentProps<typeof ManagerPinDialog> = {
    open: true,
    onOpenChange,
    actionTitle: "Void item",
    onApprove,
    ...overrides,
  };

  const utils = render(<ManagerPinDialog {...props} />);
  return { ...utils, onOpenChange, onApprove };
}

async function enterPin(user: ReturnType<typeof userEvent.setup>, pin: string) {
  for (const digit of pin) {
    await user.click(screen.getByTestId(`manager-pin-dialog-digit-${digit}`));
  }
}

describe("ManagerPinDialog", () => {
  it("renders nothing when closed", () => {
    renderDialog({ open: false });
    expect(screen.queryByTestId("manager-pin-dialog")).toBeNull();
  });

  it("shows a title naming the specific action being gated", () => {
    renderDialog({ actionTitle: "Refund" });
    expect(screen.getByTestId("manager-pin-dialog-title").textContent).toBe("Manager approval — Refund");
  });

  it("renders a distinct title per action type", () => {
    const { unmount } = renderDialog({ actionTitle: "No-sale drawer open" });
    expect(screen.getByTestId("manager-pin-dialog-title").textContent).toBe(
      "Manager approval — No-sale drawer open",
    );
    unmount();

    renderDialog({ actionTitle: "Price override" });
    expect(screen.getByTestId("manager-pin-dialog-title").textContent).toBe("Manager approval — Price override");
  });

  it("keeps Approve disabled until both PIN and reason are filled", async () => {
    const user = userEvent.setup();
    renderDialog();
    const confirm = screen.getByTestId("manager-pin-dialog-confirm") as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    await enterPin(user, "123");
    expect(confirm.disabled).toBe(true);
    await enterPin(user, "4");
    expect(confirm.disabled).toBe(true);

    await user.selectOptions(screen.getByTestId("manager-pin-dialog-reason-select"), "order-error");
    expect(confirm.disabled).toBe(false);
  });

  it("does not enable Approve with a reason but a short PIN", async () => {
    const user = userEvent.setup();
    renderDialog();
    await enterPin(user, "12");
    await user.selectOptions(screen.getByTestId("manager-pin-dialog-reason-select"), "order-error");
    expect((screen.getByTestId("manager-pin-dialog-confirm") as HTMLButtonElement).disabled).toBe(true);
  });

  it("passes exactly the entered PIN and reason code to onApprove", async () => {
    const user = userEvent.setup();
    const { onApprove } = renderDialog({
      reasonCodeOptions: [{ value: "kitchen-error", label: "Kitchen error" }],
    });

    await enterPin(user, "7391");
    await user.selectOptions(screen.getByTestId("manager-pin-dialog-reason-select"), "kitchen-error");
    await user.click(screen.getByTestId("manager-pin-dialog-confirm"));

    await waitFor(() => expect(onApprove).toHaveBeenCalledTimes(1));
    expect(onApprove).toHaveBeenCalledWith("7391", "kitchen-error");
  });

  it("closes the dialog via onOpenChange when approval succeeds", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog();

    await enterPin(user, "1234");
    await user.selectOptions(screen.getByTestId("manager-pin-dialog-reason-select"), "other");
    await user.click(screen.getByTestId("manager-pin-dialog-confirm"));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("surfaces a rejection's error inline without closing the dialog", async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn<(pin: string, reasonCode: string) => Promise<ManagerApprovalResult>>(async () => ({
      ok: false,
      error: "Incorrect PIN. Try again.",
    }));
    const { onOpenChange } = renderDialog({ onApprove });

    await enterPin(user, "0000");
    await user.selectOptions(screen.getByTestId("manager-pin-dialog-reason-select"), "other");
    await user.click(screen.getByTestId("manager-pin-dialog-confirm"));

    const errorEl = await screen.findByTestId("manager-pin-dialog-error");
    expect(errorEl.textContent).toBe("Incorrect PIN. Try again.");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByTestId("manager-pin-dialog")).toBeTruthy();
  });

  it("surfaces a thrown/rejected promise as an inline error too", async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn<(pin: string, reasonCode: string) => Promise<ManagerApprovalResult>>(async () => {
      throw new Error("Network error - could not reach the server.");
    });
    const { onOpenChange } = renderDialog({ onApprove });

    await enterPin(user, "1111");
    await user.selectOptions(screen.getByTestId("manager-pin-dialog-reason-select"), "other");
    await user.click(screen.getByTestId("manager-pin-dialog-confirm"));

    const errorEl = await screen.findByTestId("manager-pin-dialog-error");
    expect(errorEl.textContent).toBe("Network error - could not reach the server.");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("clears the entered PIN after a rejection so it isn't resubmitted blindly", async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn<(pin: string, reasonCode: string) => Promise<ManagerApprovalResult>>(async () => ({
      ok: false,
      error: "Incorrect PIN.",
    }));
    renderDialog({ onApprove });

    await enterPin(user, "9999");
    await user.selectOptions(screen.getByTestId("manager-pin-dialog-reason-select"), "other");
    await user.click(screen.getByTestId("manager-pin-dialog-confirm"));
    await screen.findByTestId("manager-pin-dialog-error");

    expect(screen.getByTestId("manager-pin-dialog-pin-dot-0").getAttribute("data-filled")).toBe("false");
  });

  it("supports backspace and clear on the PIN pad", async () => {
    const user = userEvent.setup();
    renderDialog();

    await enterPin(user, "123");
    await user.click(screen.getByTestId("manager-pin-dialog-backspace"));
    expect(screen.getByTestId("manager-pin-dialog-pin-dot-2").getAttribute("data-filled")).toBe("false");

    await user.click(screen.getByTestId("manager-pin-dialog-clear"));
    expect(screen.getByTestId("manager-pin-dialog-pin-dot-0").getAttribute("data-filled")).toBe("false");
  });

  it("caps PIN entry at 4 digits and ignores extra keypresses", async () => {
    const user = userEvent.setup();
    const { onApprove } = renderDialog();
    // Two extra digits beyond the 4-digit PIN length.
    await enterPin(user, "123456");
    expect(screen.getByTestId("manager-pin-dialog-pin-dot-3").getAttribute("data-filled")).toBe("true");

    await user.selectOptions(screen.getByTestId("manager-pin-dialog-reason-select"), "other");
    await user.click(screen.getByTestId("manager-pin-dialog-confirm"));

    await waitFor(() => expect(onApprove).toHaveBeenCalledWith("1234", "other"));
  });

  it("supports physical keyboard entry for the PIN", async () => {
    const user = userEvent.setup();
    renderDialog();

    const dialog = screen.getByTestId("manager-pin-dialog");
    dialog.focus();
    await user.keyboard("1234");

    expect(screen.getByTestId("manager-pin-dialog-pin-dot-3").getAttribute("data-filled")).toBe("true");
  });

  it("lets Cancel close the dialog without calling onApprove", async () => {
    const user = userEvent.setup();
    const { onOpenChange, onApprove } = renderDialog();

    await enterPin(user, "1234");
    await user.click(screen.getByTestId("manager-pin-dialog-cancel"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onApprove).not.toHaveBeenCalled();
  });

  it("falls back to the default reason codes when none are supplied", () => {
    renderDialog();
    const select = screen.getByTestId("manager-pin-dialog-reason-select") as HTMLSelectElement;
    const values = Array.from(select.options).map((option) => option.value);
    expect(values).toContain("customer-request");
    expect(values).toContain("other");
  });

  it("uses caller-supplied reason codes when provided", () => {
    renderDialog({
      reasonCodeOptions: [{ value: "till-recount", label: "Till recount" }],
    });
    const select = screen.getByTestId("manager-pin-dialog-reason-select") as HTMLSelectElement;
    const values = Array.from(select.options).map((option) => option.value);
    expect(values).toEqual(["", "till-recount"]);
  });
});
