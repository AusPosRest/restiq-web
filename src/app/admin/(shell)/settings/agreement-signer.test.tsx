// Settings ▸ Agreement (issue #192): the owner reads the current version and
// signs it with a typed name + consent; Sign stays disabled until both are
// present; a 201 replaces the form with the signed record; an already-signed
// version shows the record straight away; earlier signatures stay listed.
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OwnerAgreementView } from "../../api";
import { ToastProvider } from "../toast";
import { AgreementSigner } from "./agreement-signer";

const CURRENT = { id: "0192aaaa-0000-7000-8000-000000000002", version: 2, title: "Platform Services Agreement (2026)", body: "1. Scope\nYou agree...", publishedAt: "2026-09-01T10:00:00.000Z" };
const V1_SIGNATURE = {
  agreementVersionId: "0192aaaa-0000-7000-8000-000000000001",
  version: 1,
  title: "Platform Services Agreement",
  signerName: "Asha Rao",
  signerEmail: "asha@bombaybistro.example",
  signedAt: "2026-08-02T09:30:00.000Z",
  evidenceSha256: "1111111111111111111111111111111111111111111111111111111111111111",
};
const V2_SIGNATURE = { ...V1_SIGNATURE, agreementVersionId: CURRENT.id, version: 2, title: CURRENT.title, signedAt: "2026-09-09T12:00:00.000Z", evidenceSha256: "2222222222222222222222222222222222222222222222222222222222222222" };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch(view: OwnerAgreementView, signStatus = 201) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/admin/api/agreement") && (init?.method ?? "GET") === "GET") return Promise.resolve(jsonResponse(view));
    if (url.endsWith(`/admin/api/agreement/${CURRENT.id}/sign`) && init?.method === "POST") {
      if (signStatus !== 201) return Promise.resolve(jsonResponse({ error: { code: "stale_version", message: "Only the current agreement (v3) can be signed" } }, signStatus));
      const body = JSON.parse(String(init.body)) as { signerName: string };
      return Promise.resolve(jsonResponse({ signature: { ...V2_SIGNATURE, signerName: body.signerName } }, 201));
    }
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AgreementSigner", () => {
  it("shows the current agreement and signs it with a typed name and consent", async () => {
    const fetchMock = stubFetch({ current: CURRENT, signature: null, history: [V1_SIGNATURE] });
    renderSigner();
    expect(screen.getByTestId("agreement-loading")).toBeTruthy();

    await screen.findByTestId("agreement-view");
    expect(screen.getByTestId("agreement-title").textContent).toBe(CURRENT.title);
    expect(screen.getByTestId("agreement-version").textContent).toContain("Version 2");
    expect(screen.getByTestId("agreement-body").textContent).toBe(CURRENT.body);
    expect(screen.getByTestId("agreement-history-1").textContent).toContain("Asha Rao");
    expect(screen.queryByTestId("agreement-signed")).toBeNull();

    const sign = screen.getByTestId("agreement-sign") as HTMLButtonElement;
    expect(sign.disabled).toBe(true);
    await userEvent.type(screen.getByTestId("agreement-signer-name"), "  Asha Rao ");
    expect(sign.disabled).toBe(true);
    await userEvent.click(screen.getByTestId("agreement-accept"));
    expect(sign.disabled).toBe(false);

    await userEvent.click(sign);
    await screen.findByTestId("agreement-signed");
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ signerName: "Asha Rao", accepted: true });
    expect(screen.getByTestId("agreement-signed").textContent).toContain("Signed by Asha Rao");
    expect(screen.getByTestId("agreement-signed").textContent).toContain(V2_SIGNATURE.evidenceSha256);
    expect(screen.queryByTestId("agreement-sign-form")).toBeNull();
    expect(screen.getByTestId("toast-success").textContent).toContain("Agreement v2 signed.");
  });

  it("shows the signed record instead of the form when the current version is already signed", async () => {
    stubFetch({ current: CURRENT, signature: V2_SIGNATURE, history: [V2_SIGNATURE, V1_SIGNATURE] });
    renderSigner();
    await screen.findByTestId("agreement-signed");
    expect(screen.queryByTestId("agreement-sign-form")).toBeNull();
    // The current signature is shown in the signed panel, not repeated under "Previously signed".
    expect(screen.getByTestId("agreement-history-1")).toBeTruthy();
    expect(screen.queryByTestId("agreement-history-2")).toBeNull();
  });

  it("reloads on a 409 (the version moved on) and keeps the form on other failures", async () => {
    const fetchMock = stubFetch({ current: CURRENT, signature: null, history: [] }, 409);
    renderSigner();
    await screen.findByTestId("agreement-sign-form");
    await userEvent.type(screen.getByTestId("agreement-signer-name"), "Asha Rao");
    await userEvent.click(screen.getByTestId("agreement-accept"));
    await userEvent.click(screen.getByTestId("agreement-sign"));

    expect((await screen.findByTestId("toast-error")).textContent).toContain("Only the current agreement (v3) can be signed");
    await waitFor(() => expect(fetchMock.mock.calls.filter(([, init]) => (init?.method ?? "GET") === "GET").length).toBe(2));
    expect(screen.queryByTestId("agreement-history")).toBeNull();
  });

  it("shows the empty state when nothing is published, and the error panel when the load fails", async () => {
    stubFetch({ current: null, signature: null, history: [] });
    renderSigner();
    await screen.findByTestId("agreement-empty");
    cleanup();

    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse({ error: { code: "boom", message: "boom" } }, 500))));
    renderSigner();
    await screen.findByTestId("agreement-load-error");
  });
});
