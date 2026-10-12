import { afterEach, describe, expect, it } from "vitest";
import { tenantHostHeaders } from "./tenant-host-headers";

const request = (headers: Record<string, string>) => new Request("http://web.internal/admin/api/outlets", { headers });

describe("tenantHostHeaders", () => {
  afterEach(() => {
    delete process.env.PROXY_SHARED_SECRET;
  });

  it("forwards the visitor's address with the shared secret", () => {
    process.env.PROXY_SHARED_SECRET = "s".repeat(40);
    expect(tenantHostHeaders(request({ host: "web.internal", "x-forwarded-host": "bayleaf.idelta.com.au" }))).toEqual({
      "x-restiq-tenant-host": "bayleaf.idelta.com.au",
      "x-restiq-proxy-secret": "s".repeat(40),
    });
  });

  it("sends nothing without the secret (local development), so the API does no address check", () => {
    expect(tenantHostHeaders(request({ host: "localhost:3100" }))).toEqual({});
  });
});
