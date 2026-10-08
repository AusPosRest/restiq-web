import { describe, expect, it } from "vitest";
import { linkify } from "./inbox-state";

describe("linkify", () => {
  it("turns http(s) links into link parts and keeps the rest as text", () => {
    expect(linkify("Open this link:\nhttp://localhost:3104/admin/invite/abc\n\nThanks")).toEqual([
      { kind: "text", value: "Open this link:\n" },
      { kind: "link", value: "http://localhost:3104/admin/invite/abc" },
      { kind: "text", value: "\n\nThanks" },
    ]);
  });

  it("leaves text without links alone", () => {
    expect(linkify("No links here")).toEqual([{ kind: "text", value: "No links here" }]);
  });
});
