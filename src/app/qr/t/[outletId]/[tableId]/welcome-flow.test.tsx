import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WelcomeFlow } from "./welcome-flow";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function typeJoinPin(digits: string) {
  for (const digit of digits) {
    await userEvent.click(screen.getByTestId(`qr-join-pin-digit-${digit}`));
  }
}

describe("WelcomeFlow", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });
  afterEach(cleanup);

  it("renders the start form with labeled, accessible fields when no session is open", () => {
    render(<WelcomeFlow outletId="o1" tableId="t1" outletName="Spice Route" tableLabel="12" sessionOpen={false} />);

    expect(screen.getByRole("heading", { name: "Spice Route" })).toBeTruthy();
    const nameInput = screen.getByLabelText("Your name") as HTMLInputElement;
    const phoneInput = screen.getByLabelText("Phone number") as HTMLInputElement;
    expect(nameInput).toBeTruthy();
    expect(phoneInput).toBeTruthy();
    expect(screen.getByTestId("qr-start-submit")).toBeTruthy();
    expect(screen.queryByTestId("qr-join-form")).toBeNull();
  });

  it("start flow lands on the PIN screen with the shareable PIN, no ceremony", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { pin: "4729" }));
    vi.stubGlobal("fetch", fetchMock);
    render(<WelcomeFlow outletId="o1" tableId="t1" outletName="Spice Route" tableLabel="12" sessionOpen={false} />);

    await userEvent.type(screen.getByLabelText("Your name"), "Rahul");
    await userEvent.type(screen.getByLabelText("Phone number"), "9876543210");
    await userEvent.click(screen.getByTestId("qr-start-submit"));

    const pin = await screen.findByTestId("qr-session-pin");
    expect(pin.textContent).toBe("4729");
    expect(screen.getByTestId("qr-session-started")).toBeTruthy();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/qr/auth/start");
    expect(JSON.parse(init.body as string)).toEqual({ outletId: "o1", tableId: "t1", name: "Rahul", phone: "9876543210" });
  });

  it("disables the start submit until name and a 10-digit phone are entered", async () => {
    render(<WelcomeFlow outletId="o1" tableId="t1" outletName="Spice Route" tableLabel="12" sessionOpen={false} />);
    const submit = screen.getByTestId("qr-start-submit") as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    await userEvent.type(screen.getByLabelText("Your name"), "Rahul");
    expect(submit.disabled).toBe(true);

    await userEvent.type(screen.getByLabelText("Phone number"), "987");
    expect(submit.disabled).toBe(true);

    await userEvent.type(screen.getByLabelText("Phone number"), "6543210");
    expect(submit.disabled).toBe(false);
  });

  it("renders the join keypad when a session is already open", () => {
    render(<WelcomeFlow outletId="o1" tableId="t1" outletName="Spice Route" tableLabel="12" sessionOpen={true} />);
    expect(screen.getByTestId("qr-join-form")).toBeTruthy();
    expect(screen.queryByTestId("qr-start-form")).toBeNull();
    for (const digit of "0123456789") {
      expect(screen.getByTestId(`qr-join-pin-digit-${digit}`)).toBeTruthy();
    }
  });

  it("join flow succeeds with the right PIN", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { session: { outletId: "o1", tableId: "t1" } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<WelcomeFlow outletId="o1" tableId="t1" outletName="Spice Route" tableLabel="12" sessionOpen={true} />);

    await userEvent.type(screen.getByLabelText("Your name"), "Priya");
    await typeJoinPin("4729");

    await waitFor(() => expect(screen.getByTestId("qr-joined")).toBeTruthy());
    expect(screen.getByText("You're in, Priya")).toBeTruthy();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/qr/auth/join");
    expect(JSON.parse(init.body as string)).toEqual({ outletId: "o1", tableId: "t1", pin: "4729", name: "Priya" });
  });

  it("join flow shows a plain inline error on the wrong PIN and clears the dots", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(401, { error: { code: "invalid_pin", message: "That PIN didn't match - ask your table for the 4-digit code" } }),
      ),
    );
    render(<WelcomeFlow outletId="o1" tableId="t1" outletName="Spice Route" tableLabel="12" sessionOpen={true} />);

    await userEvent.type(screen.getByLabelText("Your name"), "Priya");
    await typeJoinPin("0000");

    const error = await screen.findByTestId("qr-join-error");
    expect(error.textContent).toBe("That PIN didn't match - ask your table for the 4-digit code");
    expect(error.getAttribute("role")).toBe("alert");
    expect(screen.getByTestId("qr-join-pin-dot-0").className).not.toContain("bg-primary");
    expect(screen.queryByTestId("qr-joined")).toBeNull();
  });

  it("requires a name before accepting PIN digits when joining", async () => {
    render(<WelcomeFlow outletId="o1" tableId="t1" outletName="Spice Route" tableLabel="12" sessionOpen={true} />);
    await userEvent.click(screen.getByTestId("qr-join-pin-digit-4"));

    const error = await screen.findByTestId("qr-join-name-error");
    expect(error.textContent).toBe("Your name is required to join");
    expect(screen.getByTestId("qr-join-pin-dot-0").className).not.toContain("bg-primary");
  });

  it("a11y: the status region is aria-live so screen readers hear convergence", () => {
    render(<WelcomeFlow outletId="o1" tableId="t1" outletName="Spice Route" tableLabel="12" sessionOpen={false} />);
    const region = screen.getByRole("region", { name: "Table session status" });
    expect(region.getAttribute("aria-live")).toBe("polite");
  });
});
