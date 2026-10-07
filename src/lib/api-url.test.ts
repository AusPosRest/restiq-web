import { afterEach, describe, expect, it } from "vitest";
import { apiUrl } from "./api-url";

describe("apiUrl", () => {
  afterEach(() => {
    delete process.env.RESTIQ_API_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  it("prefers RESTIQ_API_URL over NEXT_PUBLIC_API_URL", () => {
    process.env.RESTIQ_API_URL = "http://127.0.0.1:8080";
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.test";
    expect(apiUrl()).toBe("http://127.0.0.1:8080");
  });

  it("falls back to NEXT_PUBLIC_API_URL when RESTIQ_API_URL is unset", () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.test";
    expect(apiUrl()).toBe("https://api.example.test");
  });

  it("reads the environment at call time, not at import time", () => {
    expect(apiUrl()).toBeUndefined();
    process.env.RESTIQ_API_URL = "http://127.0.0.1:9090";
    expect(apiUrl()).toBe("http://127.0.0.1:9090");
  });
});
