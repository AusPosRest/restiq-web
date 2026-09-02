// Wizard behavior against a mocked API: step navigation + validation, draft
// auto-save/resume, and the atomic-failure error panel that keeps the draft.
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingWizard } from "./wizard";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

type FetchCall = { path: string; method: string; body: unknown };

let fetchCalls: FetchCall[] = [];
let draftResponse: { status: number; body: unknown } = { status: 404, body: { error: { code: "not_found" } } };
let submitResponse: { status: number; body: unknown } = { status: 201, body: null };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body ?? {}), { status, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  fetchCalls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      const method = init?.method ?? "GET";
      fetchCalls.push({ path, method, body: init?.body ? JSON.parse(init.body as string) : undefined });
      if (path === "/ops/api/tenants/draft" && method === "GET") return jsonResponse(draftResponse.status, draftResponse.body);
      if (path === "/ops/api/tenants/draft" && method === "DELETE") return new Response(null, { status: 204 });
      if (path.startsWith("/ops/api/tenants/draft/steps/") && method === "PUT") {
        return jsonResponse(200, { updatedAt: new Date().toISOString() });
      }
      if (path === "/ops/api/tenants" && method === "POST") return jsonResponse(submitResponse.status, submitResponse.body);
      throw new Error(`Unexpected fetch: ${method} ${path}`);
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  draftResponse = { status: 404, body: { error: { code: "not_found" } } };
});

async function renderFresh() {
  render(<OnboardingWizard />);
  await screen.findByTestId("onb-company-name");
}

async function fillStep1(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByTestId("onb-company-name"), "Spice Route Hospitality");
  await user.type(screen.getByTestId("onb-registered-address"), "12 MG Road, Bengaluru");
  await user.type(screen.getByTestId("onb-contact-name"), "Arjun Mehta");
  await user.type(screen.getByTestId("onb-contact-email"), "arjun@spiceroute.example");
  await user.type(screen.getByTestId("onb-contact-phone"), "+91 98765 43210");
}

describe("OnboardingWizard", () => {
  it("renders step 1 fresh when no draft exists", async () => {
    await renderFresh();
    expect(screen.getByRole("heading", { name: "Business Details" })).toBeDefined();
    expect(screen.getByTestId("onb-step-1").getAttribute("aria-current")).toBe("step");
  });

  it("blocks Next on an invalid step and shows field errors", async () => {
    const user = userEvent.setup();
    await renderFresh();
    await user.click(screen.getByTestId("onb-next"));
    expect(screen.getByTestId("onb-company-name-error").textContent).toContain("required");
    expect(screen.getByRole("heading", { name: "Business Details" })).toBeDefined();
  });

  it("validates a field on blur", async () => {
    const user = userEvent.setup();
    await renderFresh();
    await user.type(screen.getByTestId("onb-contact-email"), "not-an-email");
    await user.tab();
    await screen.findByTestId("onb-contact-email-error");
  });

  it("advances on a valid step and auto-saves the draft step", async () => {
    const user = userEvent.setup();
    await renderFresh();
    await fillStep1(user);
    await user.click(screen.getByTestId("onb-next"));
    await screen.findByRole("heading", { name: "Tax & Compliance" });
    await waitFor(() => {
      const save = fetchCalls.find((call) => call.path === "/ops/api/tenants/draft/steps/1" && call.method === "PUT");
      expect(save).toBeDefined();
      expect((save?.body as { companyName: string }).companyName).toBe("Spice Route Hospitality");
    });
  });

  it("lets the step indicator navigate backwards but never forwards", async () => {
    const user = userEvent.setup();
    await renderFresh();
    await fillStep1(user);
    await user.click(screen.getByTestId("onb-next"));
    await screen.findByRole("heading", { name: "Tax & Compliance" });

    // Future steps are not buttons at all.
    expect(screen.getByTestId("onb-step-3").tagName).toBe("SPAN");
    // Completed steps are clickable and go back.
    expect(screen.getByTestId("onb-step-1").tagName).toBe("BUTTON");
    await user.click(screen.getByTestId("onb-step-1"));
    await screen.findByRole("heading", { name: "Business Details" });
    expect(screen.getByDisplayValue("Spice Route Hospitality")).toBeDefined();
  });

  it("offers resume when a draft exists and loads its data", async () => {
    draftResponse = {
      status: 200,
      body: {
        draft: {
          steps: { "1": { companyName: "Drafted Co", registeredAddress: "x", contactName: "y", contactEmail: "d@e.example", contactPhone: "1" } },
          updatedAt: new Date().toISOString(),
        },
      },
    };
    const user = userEvent.setup();
    render(<OnboardingWizard />);
    await screen.findByTestId("onb-resume-prompt");
    await user.click(screen.getByTestId("onb-resume"));
    // Step 1 validates, so resume lands on step 2.
    await screen.findByRole("heading", { name: "Tax & Compliance" });
    await user.click(screen.getByTestId("onb-step-1"));
    expect(await screen.findByDisplayValue("Drafted Co")).toBeDefined();
  });

  it("starts over by deleting the draft", async () => {
    draftResponse = {
      status: 200,
      body: { draft: { steps: { "1": { companyName: "Drafted Co" } }, updatedAt: new Date().toISOString() } },
    };
    const user = userEvent.setup();
    render(<OnboardingWizard />);
    await screen.findByTestId("onb-resume-prompt");
    await user.click(screen.getByTestId("onb-start-over"));
    await screen.findByTestId("onb-company-name");
    expect(fetchCalls.some((call) => call.path === "/ops/api/tenants/draft" && call.method === "DELETE")).toBe(true);
    expect((screen.getByTestId("onb-company-name") as HTMLInputElement).value).toBe("");
  });

  it("shows the atomic-failure panel on submit failure and keeps the draft", async () => {
    draftResponse = {
      status: 200,
      body: {
        draft: {
          steps: {
            "1": { companyName: "Spice Route", registeredAddress: "a", contactName: "b", contactEmail: "c@d.example", contactPhone: "1" },
            "2": { country: "IN", registrationNumber: "29ABCDE1234F1Z5", legalEntityName: "L", taxProfile: "India GST - CGST/SGST split" },
            "3": { brandName: "SR", outlets: [{ name: "O1", address: "A", type: "dine_in", timezone: "Asia/Kolkata" }] },
            "4": { plan: "standard", billingPeriod: "monthly" },
            "5": { email: "owner@d.example", firstName: "F", lastName: "L" },
          },
          updatedAt: new Date().toISOString(),
        },
      },
    };
    submitResponse = { status: 409, body: { error: { code: "conflict", message: "A tenant with this tax registration number already exists" } } };

    const user = userEvent.setup();
    render(<OnboardingWizard />);
    await screen.findByTestId("onb-resume-prompt");
    await user.click(screen.getByTestId("onb-resume"));
    await screen.findByTestId("onb-submit");
    await user.click(screen.getByTestId("onb-submit"));

    const panel = await screen.findByTestId("onb-error-panel");
    expect(panel.textContent).toContain("nothing was created");
    expect(panel.textContent).toContain("draft is kept");
    // The wizard never deletes the draft on failure.
    expect(fetchCalls.some((call) => call.method === "DELETE")).toBe(false);
  });

  it("shows the success screen with the pending invite after submit", async () => {
    draftResponse = {
      status: 200,
      body: {
        draft: {
          steps: {
            "1": { companyName: "Spice Route", registeredAddress: "a", contactName: "b", contactEmail: "c@d.example", contactPhone: "1" },
            "2": { country: "IN", registrationNumber: "29ABCDE1234F1Z5", legalEntityName: "L", taxProfile: "India GST - CGST/SGST split" },
            "3": { brandName: "SR", outlets: [{ name: "O1", address: "A", type: "dine_in", timezone: "Asia/Kolkata" }] },
            "4": { plan: "enterprise", billingPeriod: "monthly" },
            "5": { email: "owner@d.example", firstName: "F", lastName: "L" },
          },
          updatedAt: new Date().toISOString(),
        },
      },
    };
    submitResponse = {
      status: 201,
      body: {
        tenant: { id: "t-1", name: "Spice Route", status: "provisioning" },
        invite: { email: "owner@d.example", expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), inviteToken: "a".repeat(64) },
      },
    };

    const user = userEvent.setup();
    render(<OnboardingWizard />);
    await screen.findByTestId("onb-resume-prompt");
    await user.click(screen.getByTestId("onb-resume"));
    await screen.findByTestId("onb-submit");
    await user.click(screen.getByTestId("onb-submit"));

    await screen.findByTestId("onb-success");
    expect(screen.getByTestId("onb-success-invite-email").textContent).toBe("owner@d.example");
    // Issue #85: the accept link must be visible and carry the raw token.
    expect(screen.getByTestId("invite-link-url").textContent).toContain(`/admin/invite/${"a".repeat(64)}`);
    expect(screen.getByTestId("onb-success-tenants-link").getAttribute("href")).toBe("/ops/tenants");
  });
});
