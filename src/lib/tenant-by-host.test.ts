import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchTenantByHost, hostOf } from "./tenant-by-host";

const TENANT = { tenantId: "t-1", slug: "bayleaf", displayName: "Bay Leaf Kitchens", status: "active", country: "IN", currency: "INR", branding: {} };

describe("tenant by host", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = "http://api.test";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("asks the API's public lookup with the address and returns the tenant", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(TENANT), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchTenantByHost("bayleaf.idelta.com.au")).toEqual(TENANT);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://api.test/public/v1/tenant?host=bayleaf.idelta.com.au");
  });

  it("is null for no address, no match, an error status or an unreachable API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchTenantByHost(null)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 404 }));
    expect(await fetchTenantByHost("nobody.idelta.com.au")).toBeNull();
    fetchMock.mockRejectedValueOnce(new TypeError("down"));
    expect(await fetchTenantByHost("bayleaf.idelta.com.au")).toBeNull();
  });

  it("reads the address a proxy forwarded before the plain host", () => {
    expect(hostOf(new Headers({ host: "web.internal", "x-forwarded-host": "bayleaf.idelta.com.au, other" }))).toBe("bayleaf.idelta.com.au");
    expect(hostOf(new Headers({ host: "localhost:3100" }))).toBe("localhost:3100");
    expect(hostOf(new Headers())).toBeNull();
  });
});
