// SE-18: a signed-in kitchen display reports in to Devices like a till does.
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({ Hanken_Grotesk: () => ({ variable: "" }), Inter: () => ({ variable: "" }), Public_Sans: () => ({ variable: "" }) }));
const staff = JSON.stringify({ staff: { id: "s1", name: "Cook" }, outlet: { id: "o1", name: "Spice Route" } });
vi.mock("next/headers", () => ({ cookies: () => Promise.resolve({ get: () => ({ value: staff }) }) }));

import KdsLayout from "./layout";

describe("KdsLayout", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  it("sends the device heartbeat for the enrolled kitchen display", async () => {
    window.sessionStorage.setItem("pos:tab-device", "01a12b08-c9cb-7435-8eb2-5d121804b4ab");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    render(await KdsLayout({ children: <p>board</p> }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/pos/api/devices/01a12b08-c9cb-7435-8eb2-5d121804b4ab/heartbeat");
    expect(init.method).toBe("POST");
  });
});
