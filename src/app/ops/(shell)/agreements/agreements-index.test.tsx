// Agreements console (issue #192): versions list newest first with the
// current marker, publish is pessimistic through the reason dialog and
// carries title/body/reason, and a row expands to load the full text.
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgreementVersionSummary } from "../api";
import { ToastProvider } from "../toast";
import { AgreementsIndex } from "./agreements-index";

const V1: AgreementVersionSummary = {
  id: "0192aaaa-0000-7000-8000-000000000001",
  version: 1,
  title: "Platform Services Agreement",
  publishedBy: "ops@restiq.example",
  publishedAt: "2026-09-01T10:00:00.000Z",
  signatureCount: 3,
};
const V2: AgreementVersionSummary = { ...V1, id: "0192aaaa-0000-7000-8000-000000000002", version: 2, title: "Platform Services Agreement (2026)", signatureCount: 0 };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch(versions: AgreementVersionSummary[]) {
  let list = versions;
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url.endsWith("/ops/api/agreements") && method === "GET") return Promise.resolve(jsonResponse({ versions: list }));
    if (url.endsWith("/ops/api/agreements") && method === "POST") {
      const body = JSON.parse(String(init?.body)) as { title: string; body: string; reason: string };
      const created = { ...V1, id: "0192aaaa-0000-7000-8000-000000000003", version: (list[0]?.version ?? 0) + 1, title: body.title, signatureCount: 0 };
      list = [created, ...list];
      return Promise.resolve(jsonResponse({ version: { ...created, body: body.body, bodySha256: "x" } }, 201));
    }
    const match = url.match(/\/ops\/api\/agreements\/([^/]+)$/);
    if (match) {
      const version = list.find((v) => v.id === match[1]);
      return Promise.resolve(jsonResponse({ version: { ...version, body: `Full text of v${version?.version}`, bodySha256: "x" } }));
    }
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "unhandled" } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderIndex() {
  return render(
    <ToastProvider>
      <AgreementsIndex />
    </ToastProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AgreementsIndex", () => {
  it("lists versions newest first, marks the current one, and expands a row to load its text", async () => {
    stubFetch([V2, V1]);
    renderIndex();
    expect(screen.getByTestId("agreements-loading")).toBeTruthy();

    await screen.findByTestId("agreement-row-2");
    const rows = screen.getAllByTestId(/^agreement-row-/);
    expect(rows.map((row) => row.getAttribute("data-testid"))).toEqual(["agreement-row-2", "agreement-row-1"]);
    expect(screen.getByTestId("agreement-expand-2").textContent).toContain("current");
    expect(screen.getByTestId("agreement-expand-1").textContent).not.toContain("current");
    expect(screen.getByTestId("agreement-signatures-1").textContent).toBe("3");
    expect(screen.getByTestId("agreement-publish").textContent).toBe("Publish version 3");

    await userEvent.click(screen.getByTestId("agreement-expand-1"));
    expect((await screen.findByTestId("agreement-body-text")).textContent).toBe("Full text of v1");
  });

  it("shows the empty state and offers version 1 when nothing is published", async () => {
    stubFetch([]);
    renderIndex();
    await screen.findByTestId("agreements-empty");
    expect(screen.getByTestId("agreement-publish").textContent).toBe("Publish version 1");
  });

  it("publishes through the reason dialog with title, body and reason, then refreshes the list", async () => {
    const fetchMock = stubFetch([V1]);
    renderIndex();
    await screen.findByTestId("agreement-row-1");

    const publish = screen.getByTestId("agreement-publish") as HTMLButtonElement;
    expect(publish.disabled).toBe(true);
    await userEvent.type(screen.getByTestId("agreement-title"), "Updated terms");
    expect(publish.disabled).toBe(true);
    await userEvent.type(screen.getByTestId("agreement-body"), "Clause 1.\nClause 2.");
    expect(publish.disabled).toBe(false);

    await userEvent.click(publish);
    await userEvent.type(screen.getByTestId("confirm-reason"), "Annual legal refresh");
    await userEvent.click(screen.getByTestId("confirm-submit"));

    await waitFor(() => expect(screen.queryByTestId("confirm-dialog")).toBeNull());
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ title: "Updated terms", body: "Clause 1.\nClause 2.", reason: "Annual legal refresh" });
    await screen.findByTestId("agreement-row-2");
    expect(screen.getByTestId("toast-success").textContent).toContain("Agreement v2 published.");
    expect((screen.getByTestId("agreement-title") as HTMLInputElement).value).toBe("");
  });

  it("keeps the form and shows the backend's message when publishing fails", async () => {
    stubFetch([V1]);
    vi.mocked(fetch).mockImplementationOnce(() => Promise.resolve(jsonResponse({ versions: [V1] })));
    renderIndex();
    await screen.findByTestId("agreement-row-1");
    vi.mocked(fetch).mockImplementationOnce(() => Promise.resolve(jsonResponse({ error: { code: "validation_failed", message: "body too long" } }, 400)));

    await userEvent.type(screen.getByTestId("agreement-title"), "T");
    await userEvent.type(screen.getByTestId("agreement-body"), "B");
    await userEvent.click(screen.getByTestId("agreement-publish"));
    await userEvent.type(screen.getByTestId("confirm-reason"), "why");
    await userEvent.click(screen.getByTestId("confirm-submit"));

    expect((await screen.findByTestId("toast-error")).textContent).toContain("body too long");
    expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
    expect((screen.getByTestId("agreement-title") as HTMLInputElement).value).toBe("T");
  });
});
