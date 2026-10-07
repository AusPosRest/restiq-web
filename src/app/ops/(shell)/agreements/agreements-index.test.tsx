// Agreements console (issue #192): versions list newest first with the
// current marker, publish is pessimistic through the reason dialog and
// is a multipart upload of title, reason and a PDF (previewed before publishing), and
// a row expands to show the published PDF.
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
  hasFile: true,
  fileName: "psa.pdf",
  sizeBytes: 2048,
  fileSha256: "c".repeat(64),
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
      const form = init?.body as FormData;
      const created = { ...V1, id: "0192aaaa-0000-7000-8000-000000000003", version: (list[0]?.version ?? 0) + 1, title: String(form.get("title")), signatureCount: 0 };
      list = [created, ...list];
      return Promise.resolve(jsonResponse({ version: created }, 201));
    }
    const match = url.match(/\/ops\/api\/agreements\/([^/]+)$/);
    if (match) {
      const version = list.find((v) => v.id === match[1]);
      return Promise.resolve(jsonResponse({ version }));
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
  it("lists versions newest first, marks the current one, and expands a row to show its PDF", async () => {
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
    expect((await screen.findByTestId("agreement-viewer")).getAttribute("src")).toBe(`/ops/api/agreements/${V1.id}/file`);
    expect(screen.getByTestId("agreement-open").getAttribute("href")).toBe(`/ops/api/agreements/${V1.id}/file`);
  });

  it("shows the empty state and offers version 1 when nothing is published", async () => {
    stubFetch([]);
    renderIndex();
    await screen.findByTestId("agreements-empty");
    expect(screen.getByTestId("agreement-publish").textContent).toBe("Publish version 1");
  });

  it("publishes through the reason dialog with title, reason and the PDF, previewed first, then refreshes the list", async () => {
    const fetchMock = stubFetch([V1]);
    renderIndex();
    await screen.findByTestId("agreement-row-1");

    const publish = screen.getByTestId("agreement-publish") as HTMLButtonElement;
    expect(publish.disabled).toBe(true);
    await userEvent.type(screen.getByTestId("agreement-title"), "Updated terms");
    expect(publish.disabled).toBe(true);
    const pdf = new File(["%PDF-1.4 test"], "terms.pdf", { type: "application/pdf" });
    await userEvent.upload(screen.getByTestId("agreement-file"), pdf);
    expect(publish.disabled).toBe(false);
    expect(screen.getByTestId("agreement-preview").getAttribute("src")).toMatch(/^blob:/);

    await userEvent.click(publish);
    await userEvent.type(screen.getByTestId("confirm-reason"), "Annual legal refresh");
    await userEvent.click(screen.getByTestId("confirm-submit"));

    await waitFor(() => expect(screen.queryByTestId("confirm-dialog")).toBeNull());
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    const sent = post?.[1]?.body as FormData;
    expect(sent.get("title")).toBe("Updated terms");
    expect(sent.get("reason")).toBe("Annual legal refresh");
    expect((sent.get("file") as File).name).toBe("terms.pdf");
    // multipart: the browser sets the content-type with its boundary, so none is set here.
    expect((post?.[1]?.headers ?? {}) as Record<string, string>).not.toHaveProperty("content-type");
    await screen.findByTestId("agreement-row-2");
    expect(screen.getByTestId("toast-success").textContent).toContain("Agreement v2 published.");
    expect((screen.getByTestId("agreement-title") as HTMLInputElement).value).toBe("");
    // The file picker forgets terms.pdf too, so version 3 can't reuse it by accident.
    expect((screen.getByTestId("agreement-file") as HTMLInputElement).files?.length ?? 0).toBe(0);
  });

  it("keeps the form and shows the backend's message when publishing fails", async () => {
    stubFetch([V1]);
    vi.mocked(fetch).mockImplementationOnce(() => Promise.resolve(jsonResponse({ versions: [V1] })));
    renderIndex();
    await screen.findByTestId("agreement-row-1");
    vi.mocked(fetch).mockImplementationOnce(() => Promise.resolve(jsonResponse({ error: { code: "validation_failed", message: "The agreement must be a PDF file" } }, 400)));

    await userEvent.type(screen.getByTestId("agreement-title"), "T");
    await userEvent.upload(screen.getByTestId("agreement-file"), new File(["%PDF-1.4"], "t.pdf", { type: "application/pdf" }));
    await userEvent.click(screen.getByTestId("agreement-publish"));
    await userEvent.type(screen.getByTestId("confirm-reason"), "why");
    await userEvent.click(screen.getByTestId("confirm-submit"));

    expect((await screen.findByTestId("toast-error")).textContent).toContain("The agreement must be a PDF file");
    expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
    expect((screen.getByTestId("agreement-title") as HTMLInputElement).value).toBe("T");
  });

  it("refuses a file that is not a PDF or is over 5 MB before anything is uploaded", async () => {
    stubFetch([V1]);
    renderIndex();
    await screen.findByTestId("agreement-row-1");
    await userEvent.type(screen.getByTestId("agreement-title"), "T");

    const publish = screen.getByTestId("agreement-publish") as HTMLButtonElement;
    await userEvent.upload(screen.getByTestId("agreement-file"), new File(["hello"], "notes.txt", { type: "text/plain" }), { applyAccept: false });
    expect(screen.getByTestId("agreement-file-error").textContent).toContain("PDF");
    expect(publish.disabled).toBe(true);
    expect(screen.queryByTestId("agreement-preview")).toBeNull();

    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.pdf", { type: "application/pdf" });
    await userEvent.upload(screen.getByTestId("agreement-file"), big);
    expect(screen.getByTestId("agreement-file-error").textContent).toContain("5 MB");
    expect(publish.disabled).toBe(true);
  });

  it("says a version published as text before PDFs has no file to show", async () => {
    stubFetch([{ ...V1, hasFile: false, fileName: null, sizeBytes: null }]);
    renderIndex();
    await userEvent.click(await screen.findByTestId("agreement-expand-1"));
    expect(await screen.findByTestId("agreement-no-file")).toBeTruthy();
  });
});
