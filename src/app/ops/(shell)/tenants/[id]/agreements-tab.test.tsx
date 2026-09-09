// O5 Agreements tab (issue #192): standing badge + signature history, read-only.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TenantAgreementsView } from "../../api";
import { AgreementsTab } from "./agreements-tab";

const TENANT_ID = "0192cccc-0000-7000-8000-000000000003";

function view(overrides: Partial<TenantAgreementsView> = {}): TenantAgreementsView {
  return {
    current: { id: "v2", version: 2, title: "Platform Services Agreement (2026)", publishedBy: "ops@restiq.example", publishedAt: "2026-09-01T10:00:00.000Z" },
    status: "pending",
    signatures: [
      {
        agreementVersionId: "v1",
        version: 1,
        title: "Platform Services Agreement",
        signerName: "Asha Rao",
        signerEmail: "asha@bombaybistro.example",
        signedAt: "2026-08-02T09:30:00.000Z",
        evidenceSha256: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      },
    ],
    ...overrides,
  };
}

function renderTab(body: TenantAgreementsView | { status: number }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        "status" in body && typeof body.status === "number"
          ? new Response(JSON.stringify({ error: { code: "boom", message: "boom" } }), { status: body.status })
          : new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }),
      ),
    ),
  );
  render(<AgreementsTab tenantId={TENANT_ID} />);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AgreementsTab", () => {
  it("shows pending against the current version with the earlier signature on record", async () => {
    renderTab(view());
    await screen.findByTestId("agreements-tab");
    expect(screen.getByTestId("agreement-status").textContent).toBe("pending");
    expect(screen.getByTestId("agreement-current").textContent).toContain("v2 · Platform Services Agreement (2026)");
    const row = screen.getByTestId("agreement-signature-1");
    expect(row.textContent).toContain("Asha Rao");
    expect(row.textContent).toContain("asha@bombaybistro.example");
    expect(row.textContent).toContain("abcdef012345…");
  });

  it("shows signed, and the no-agreement case with an empty signature list", async () => {
    renderTab(view({ status: "signed" }));
    await screen.findByTestId("agreements-tab");
    expect(screen.getByTestId("agreement-status").textContent).toBe("signed");
    cleanup();

    renderTab(view({ current: null, status: "no_agreement", signatures: [] }));
    await screen.findByTestId("agreements-tab");
    expect(screen.getByTestId("agreement-status").textContent).toBe("no agreement");
    expect(screen.getByTestId("agreement-current").textContent).toContain("No agreement has been published yet.");
    expect(screen.getByTestId("agreement-signatures-empty")).toBeTruthy();
  });

  it("shows the load-error panel with retry when the request fails", async () => {
    renderTab({ status: 500 });
    await screen.findByTestId("agreements-error");
    expect(screen.getByTestId("agreements-error-retry")).toBeTruthy();
  });
});
