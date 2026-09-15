import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AgreementDocument, agreementBlocks } from "./agreement-document";

afterEach(cleanup);

describe("AgreementDocument", () => {
  it("splits the same markup the signed PDF uses", () => {
    expect(agreementBlocks("# 1. Scope\n1.1 First.\n1.2 Second.\n\n## Notes\n\n\nPlain")).toEqual([
      { kind: "h1", text: "1. Scope" },
      { kind: "p", text: "1.1 First.\n1.2 Second." },
      { kind: "h2", text: "Notes" },
      { kind: "p", text: "Plain" },
    ]);
  });

  it("renders markup-looking text as text, never as HTML", () => {
    render(<AgreementDocument body={"<script>alert(1)</script>\n\n# <b>Heading</b>"} testId="doc" />);
    const doc = screen.getByTestId("doc");
    expect(doc.querySelector("script, b")).toBeNull();
    expect(doc.textContent).toContain("<script>alert(1)</script>");
    expect(doc.querySelector("h3")?.textContent).toBe("<b>Heading</b>");
  });
});
