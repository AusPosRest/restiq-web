import { describe, expect, it } from "vitest";
import { needsSignature } from "./agreement-banner";

const current = { id: "v2", version: 2, title: "Platform agreement", body: "", publishedAt: "2026-10-08T00:00:00.000Z" };
const signatureFor = (agreementVersionId: string) => ({
  agreementVersionId,
  version: 1,
  title: "Platform agreement",
  signerName: "Ravi Kumar",
  signerEmail: "owner@binflow.test",
  signedAt: "2026-10-08T00:00:00.000Z",
  evidenceSha256: "x",
});

describe("needsSignature (walkthrough fix)", () => {
  it("asks until the current version is signed", () => {
    expect(needsSignature({ current, signature: null, history: [] })).toBe(true);
    expect(needsSignature({ current, signature: signatureFor("v1"), history: [] })).toBe(true);
    expect(needsSignature({ current, signature: signatureFor("v2"), history: [] })).toBe(false);
  });

  it("asks nothing when no agreement is published or it hasn't loaded", () => {
    expect(needsSignature({ current: null, signature: null, history: [] })).toBe(false);
    expect(needsSignature(null)).toBe(false);
  });
});
