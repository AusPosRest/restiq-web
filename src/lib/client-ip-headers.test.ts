import { afterEach, describe, expect, it } from "vitest";
import { clientIpHeaders } from "./client-ip-headers";

const req = (headers: Record<string, string>) => new Request("http://x/login", { headers });

describe("clientIpHeaders (#290)", () => {
  afterEach(() => {
    delete process.env.PROXY_SHARED_SECRET;
  });

  it("forwards the edge-set client address with the shared secret", () => {
    process.env.PROXY_SHARED_SECRET = "s3cret";
    expect(clientIpHeaders(req({ "x-real-ip": "203.0.113.9" }))).toEqual({ "x-restiq-client-ip": "203.0.113.9", "x-restiq-proxy-secret": "s3cret" });
    expect(clientIpHeaders(req({ "x-forwarded-for": "198.51.100.4, 10.0.0.1" }))).toEqual({ "x-restiq-client-ip": "198.51.100.4", "x-restiq-proxy-secret": "s3cret" });
  });

  it("sends nothing without a secret or an address", () => {
    expect(clientIpHeaders(req({ "x-real-ip": "203.0.113.9" }))).toEqual({});
    process.env.PROXY_SHARED_SECRET = "s3cret";
    expect(clientIpHeaders(req({}))).toEqual({});
  });
});
