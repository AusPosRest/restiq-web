import { afterEach, describe, expect, it, vi } from "vitest";
import { createStaff } from "./api";

afterEach(() => vi.unstubAllGlobals());

// CU-3: the API accepts staff with no email but rejects an empty string - a blank email is left out.
describe("createStaff", () => {
  it("leaves a blank email out of the request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "s-1" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    await createStaff({ firstName: "Raju", lastName: "K", email: "  ", roleId: "r-waiter" });
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ name: "Raju K", roleId: "r-waiter", outletIds: [] });
  });

  it("sends a typed email, trimmed", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "s-1" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    await createStaff({ firstName: "Priya", lastName: "Nair", email: " priya@example.com ", roleId: "r-cashier" });
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toMatchObject({ email: "priya@example.com" });
  });
});
