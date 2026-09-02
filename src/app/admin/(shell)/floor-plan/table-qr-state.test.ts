import { describe, expect, it } from "vitest";
import { guestOrderUrl } from "./table-qr-state";

describe("guestOrderUrl", () => {
  it("builds the exact guest self-order route the QR must point at", () => {
    expect(guestOrderUrl("https://app.example.com", "outlet-1", "t1")).toBe("https://app.example.com/qr/t/outlet-1/t1");
  });
});
