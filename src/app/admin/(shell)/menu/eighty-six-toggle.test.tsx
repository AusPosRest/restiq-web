import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../toast";
import { EightySixToggle } from "./eighty-six-toggle";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function Harness({ initial }: Readonly<{ initial: boolean }>) {
  const [available, setAvailable] = useState(initial);
  return (
    <ToastProvider>
      <EightySixToggle itemId="item-1" itemName="Paneer Tikka" available={available} onChanged={setAvailable} />
    </ToastProvider>
  );
}

describe("EightySixToggle", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(cleanup);

  it("flips to checked (86'd) immediately (optimistic), before the request resolves", async () => {
    let resolveRequest: (value: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(new Promise((resolve) => (resolveRequest = resolve))),
    );
    render(<Harness initial={true} />);

    const toggle = screen.getByTestId("item-86-toggle-item-1");
    expect(toggle).toHaveProperty("ariaChecked", "false");

    await userEvent.click(toggle);
    expect(toggle).toHaveProperty("ariaChecked", "true");

    resolveRequest(jsonResponse({ id: "item-1", available: false }));
    await waitFor(() => expect(toggle).toHaveProperty("ariaChecked", "true"));
  });

  it("sends a PATCH to the item's availability endpoint with the new state", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "item-1", available: false }));
    vi.stubGlobal("fetch", fetchMock);
    render(<Harness initial={true} />);

    await userEvent.click(screen.getByTestId("item-86-toggle-item-1"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/api/menu/items/item-1/availability", expect.objectContaining({ method: "PATCH" }));
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ available: false });
  });

  it("rolls back to the previous state and shows a retryable toast on failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: { code: "error", message: "nope" } }, 500));
    vi.stubGlobal("fetch", fetchMock);
    render(<Harness initial={true} />);

    const toggle = screen.getByTestId("item-86-toggle-item-1");
    await userEvent.click(toggle);

    await screen.findByTestId("toast-error");
    await waitFor(() => expect(toggle).toHaveProperty("ariaChecked", "false"));
    expect(screen.getByTestId("toast-error").textContent).toContain("Paneer Tikka");
  });

  it("retries the same toggle from the toast's retry action", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: { code: "error", message: "nope" } }, 500))
      .mockResolvedValueOnce(jsonResponse({ id: "item-1", available: false }));
    vi.stubGlobal("fetch", fetchMock);
    render(<Harness initial={true} />);

    await userEvent.click(screen.getByTestId("item-86-toggle-item-1"));
    await screen.findByTestId("toast-error");
    await userEvent.click(screen.getByTestId("toast-retry"));

    await waitFor(() => expect(screen.getByTestId("item-86-toggle-item-1")).toHaveProperty("ariaChecked", "true"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
