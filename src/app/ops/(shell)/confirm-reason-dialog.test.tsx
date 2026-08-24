// The reusable confirm-modal-with-required-reason: no reason, no confirm.
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmReasonDialog } from "./confirm-reason-dialog";

describe("ConfirmReasonDialog", () => {
  afterEach(cleanup);

  it("renders nothing when closed", () => {
    render(
      <ConfirmReasonDialog open={false} title="T" description="D" verb="Do it" onCancel={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(screen.queryByTestId("confirm-dialog")).toBeNull();
  });

  it("disables confirm until a non-blank reason is typed and passes it through", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmReasonDialog
        open
        title="Enable Reservations"
        description="The feature becomes available immediately."
        verb="Enable"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    const submit = screen.getByTestId("confirm-submit") as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    await userEvent.type(screen.getByTestId("confirm-reason"), "   ");
    expect(submit.disabled).toBe(true);

    await userEvent.type(screen.getByTestId("confirm-reason"), "Tenant asked for it");
    expect(submit.disabled).toBe(false);

    await userEvent.click(submit);
    expect(onConfirm).toHaveBeenCalledWith("Tenant asked for it");
  });

  it("cancel closes without confirming and the reason does not leak into the next open", async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const { rerender } = render(
      <ConfirmReasonDialog open title="T" description="D" verb="Go" onCancel={onCancel} onConfirm={onConfirm} />,
    );
    await userEvent.type(screen.getByTestId("confirm-reason"), "draft reason");
    await userEvent.click(screen.getByTestId("confirm-cancel"));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();

    rerender(<ConfirmReasonDialog open={false} title="T" description="D" verb="Go" onCancel={onCancel} onConfirm={onConfirm} />);
    rerender(<ConfirmReasonDialog open title="T" description="D" verb="Go" onCancel={onCancel} onConfirm={onConfirm} />);
    expect((screen.getByTestId("confirm-reason") as HTMLTextAreaElement).value).toBe("");
  });

  it("uses the critical style for destructive actions", () => {
    render(<ConfirmReasonDialog open destructive title="T" description="D" verb="Revoke" onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect((screen.getByTestId("confirm-submit") as HTMLButtonElement).className).toContain("bg-status-critical");
  });
});
