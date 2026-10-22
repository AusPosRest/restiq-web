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

  it("trusts Cloudflare's cf-connecting-ip over browser-writable headers (#397)", () => {
    process.env.PROXY_SHARED_SECRET = "s3cret";
    // Behind Cloudflare a browser can send its own x-real-ip / x-forwarded-for; only cf-connecting-ip is set by the edge.
    expect(clientIpHeaders(req({ "cf-connecting-ip": "203.0.113.7", "x-real-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2, 203.0.113.7" }))).toEqual({ "x-restiq-client-ip": "203.0.113.7", "x-restiq-proxy-secret": "s3cret" });
  });

  it("sends nothing without a secret or an address", () => {
    expect(clientIpHeaders(req({ "x-real-ip": "203.0.113.9" }))).toEqual({});
    process.env.PROXY_SHARED_SECRET = "s3cret";
    expect(clientIpHeaders(req({}))).toEqual({});
  });
});
