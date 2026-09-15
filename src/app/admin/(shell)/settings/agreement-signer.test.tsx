// Settings ▸ Agreement (issues #192, #238): the owner reads the current
// version as a formatted document and starts DocuSign signing with their full
// name and title (both required); a signing in progress resumes with them
// fixed; after signing it waits for Restiq's countersignature; a completed
// signature links the sealed PDF; DocuSign's return ?event= is announced once.
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgreementSignatureView, OwnerAgreementView } from "../../api";
import { ToastProvider } from "../toast";
import { AgreementSigner } from "./agreement-signer";

const CURRENT = {
  id: "0192aaaa-0000-7000-8000-000000000002",
  version: 2,
  title: "Restiq Platform Services Agreement",
  body: "# 1. Parties\nBetween Restiq and Bombay Bistro Pty Ltd.\n\n# 2. Services\nWe provide the platform.",
  publishedAt: "2026-09-01T10:00:00.000Z",
};
const V1_SIGNATURE: AgreementSignatureView = {
  agreementVersionId: "0192aaaa-0000-7000-8000-000000000001",
  version: 1,
  title: "Platform Services Agreement",
  signerName: "Asha Rao",
  signerEmail: "asha@bombaybistro.example",
  signerTitle: null,
  signedAt: "2026-08-02T09:30:00.000Z",
  evidenceSha256: "1111111111111111111111111111111111111111111111111111111111111111",
  hasPdf: false,
};
const V2_SIGNATURE: AgreementSignatureView = {
  ...V1_SIGNATURE,
  agreementVersionId: CURRENT.id,
  version: 2,
  title: CURRENT.title,
  signerTitle: "Director",
  signedAt: "2026-09-09T12:00:00.000Z",
  evidenceSha256: "2222222222222222222222222222222222222222222222222222222222222222",
  hasPdf: true,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function view(overrides: Partial<OwnerAgreementView> = {}): OwnerAgreementView {
  return { current: CURRENT, signature: null, signing: null, history: [], ...overrides };
}

function stubFetch(agreement: OwnerAgreementView, signing: { status: number; body: unknown } = { status: 201, body: { url: "https://demo.docusign.net/signing/abc" } }) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/admin/api/agreement") && (init?.method ?? "GET") === "GET") return Promise.resolve(jsonResponse(agreement));
    if (url.endsWith(`/admin/api/agreement/${CURRENT.id}/signing`) && init?.method === "POST") return Promise.resolve(jsonResponse(signing.body, signing.status));
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "unhandled" } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderSigner() {
  return render(
    <ToastProvider>
      <AgreementSigner />
    </ToastProvider>,
  );
}

function signingPosts(fetchMock: ReturnType<typeof stubFetch>) {
  return fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("AgreementSigner", () => {
  it("shows the agreement as a document and opens DocuSign once name and title are given", async () => {
    const fetchMock = stubFetch(view({ history: [V1_SIGNATURE] }));
    renderSigner();
    expect(screen.getByTestId("agreement-loading")).toBeTruthy();

    await screen.findByTestId("agreement-view");
    expect(screen.getByTestId("agreement-title").textContent).toBe(CURRENT.title);
    expect(screen.getByTestId("agreement-version").textContent).toContain("Version 2");
    const body = screen.getByTestId("agreement-body");
    expect([...body.querySelectorAll("h3")].map((h) => h.textContent)).toEqual(["1. Parties", "2. Services"]);
    expect(body.textContent).toContain("Between Restiq and Bombay Bistro Pty Ltd.");
    expect(screen.getByTestId("agreement-history-1").textContent).toContain("Asha Rao");
    // A typed-name signature from before DocuSign has no sealed PDF to offer.
    expect(screen.queryByTestId("agreement-history-pdf-1")).toBeNull();

    const sign = screen.getByTestId("agreement-sign") as HTMLButtonElement;
    expect(sign.textContent).toBe("Review and sign");
    expect(sign.disabled).toBe(true);
    await userEvent.type(screen.getByTestId("agreement-signer-name"), "  Asha Rao ");
    expect(sign.disabled).toBe(true);
    await userEvent.type(screen.getByTestId("agreement-signer-title"), " Director");
    expect(sign.disabled).toBe(false);

    await userEvent.click(sign);
    await waitFor(() => expect(signingPosts(fetchMock)).toHaveLength(1));
    expect(JSON.parse(String(signingPosts(fetchMock)[0][1]?.body))).toEqual({ signerName: "Asha Rao", signerTitle: "Director" });
    // The page is on its way to DocuSign: the button stays busy.
    expect(sign.textContent).toBe("Opening DocuSign...");
    expect(sign.disabled).toBe(true);
  });

  it("resumes a signing in progress with the name and title already on the document", async () => {
    stubFetch(view({ signing: { status: "awaiting_owner", signerName: "Asha Rao", signerTitle: "Director", ownerSignedAt: null } }));
    renderSigner();
    await screen.findByTestId("agreement-sign-form");
    expect((screen.getByTestId("agreement-signer-name") as HTMLInputElement).value).toBe("Asha Rao");
    expect((screen.getByTestId("agreement-signer-name") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId("agreement-signer-title") as HTMLInputElement).value).toBe("Director");
    expect(screen.getByTestId("agreement-resume-note")).toBeTruthy();
    expect(screen.getByTestId("agreement-sign").textContent).toBe("Continue signing");
  });

  it("waits for Restiq's countersignature after the owner signs", async () => {
    stubFetch(view({ signing: { status: "awaiting_countersign", signerName: "Asha Rao", signerTitle: "Director", ownerSignedAt: "2026-09-15T10:00:00.000Z" } }));
    renderSigner();
    const waiting = await screen.findByTestId("agreement-awaiting-countersign");
    expect(waiting.textContent).toContain("as Asha Rao, Director");
    expect(waiting.textContent).toContain("Waiting for Restiq to countersign");
    expect(screen.queryByTestId("agreement-sign-form")).toBeNull();
  });

  it("shows the completed signature with the sealed PDF, and only earlier versions under Previously signed", async () => {
    stubFetch(view({ signature: V2_SIGNATURE, history: [V2_SIGNATURE, { ...V1_SIGNATURE, hasPdf: true }] }));
    renderSigner();
    const signed = await screen.findByTestId("agreement-signed");
    expect(signed.textContent).toContain("Signed by Asha Rao, Director");
    expect(signed.textContent).toContain(V2_SIGNATURE.evidenceSha256);
    expect(screen.getByTestId("agreement-pdf").getAttribute("href")).toBe(`/admin/api/agreement/${CURRENT.id}/pdf`);
    expect(screen.queryByTestId("agreement-sign-form")).toBeNull();
    expect(screen.getByTestId("agreement-history-pdf-1").getAttribute("href")).toBe(`/admin/api/agreement/${V1_SIGNATURE.agreementVersionId}/pdf`);
    expect(screen.queryByTestId("agreement-history-2")).toBeNull();
  });

  it("reloads on a 409 (the server's view moved on) and shows the setup message on a 503", async () => {
    const conflict = stubFetch(view(), { status: 409, body: { error: { code: "stale_version", message: "Only the current agreement (v3) can be signed" } } });
    renderSigner();
    await screen.findByTestId("agreement-sign-form");
    await userEvent.type(screen.getByTestId("agreement-signer-name"), "Asha Rao");
    await userEvent.type(screen.getByTestId("agreement-signer-title"), "Director");
    await userEvent.click(screen.getByTestId("agreement-sign"));
    expect((await screen.findByTestId("toast-error")).textContent).toContain("Only the current agreement (v3) can be signed");
    await waitFor(() => expect(conflict.mock.calls.filter(([, init]) => (init?.method ?? "GET") === "GET").length).toBe(2));
    cleanup();

    stubFetch(view(), { status: 503, body: { error: { code: "esign_unavailable", message: "Electronic signing is not set up yet. Contact Restiq support." } } });
    renderSigner();
    await screen.findByTestId("agreement-sign-form");
    await userEvent.type(screen.getByTestId("agreement-signer-name"), "Asha Rao");
    await userEvent.type(screen.getByTestId("agreement-signer-title"), "Director");
    await userEvent.click(screen.getByTestId("agreement-sign"));
    expect((await screen.findByTestId("toast-error")).textContent).toContain("Electronic signing is not set up yet");
    expect((screen.getByTestId("agreement-sign") as HTMLButtonElement).disabled).toBe(false);
  });

  it("announces DocuSign's return event once and removes it from the address", async () => {
    window.history.replaceState(null, "", "/admin/settings/agreement?event=signing_complete");
    stubFetch(view({ signing: { status: "awaiting_countersign", signerName: "Asha Rao", signerTitle: "Director", ownerSignedAt: "2026-09-15T10:00:00.000Z" } }));
    renderSigner();
    expect((await screen.findByTestId("toast-success")).textContent).toContain("you've signed");
    expect(window.location.search).toBe("");
    expect(window.location.pathname).toBe("/admin/settings/agreement");
  });

  it("shows the empty state when nothing is published, and the error panel when the load fails", async () => {
    stubFetch(view({ current: null }));
    renderSigner();
    await screen.findByTestId("agreement-empty");
    cleanup();

    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse({ error: { code: "boom", message: "boom" } }, 500))));
    renderSigner();
    await screen.findByTestId("agreement-load-error");
  });
});
