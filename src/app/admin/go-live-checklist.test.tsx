import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GoLiveChecklist } from "./go-live-checklist";
import type { ChecklistStepView } from "./checklist-state";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function checklistSteps(completed: Partial<Record<ChecklistStepView["step"], boolean>> = {}): ChecklistStepView[] {
  const keys: ChecklistStepView["step"][] = ["outlet_details", "menu_import", "floor_plan", "devices", "staff"];
  return keys.map((step) => ({ step, completed: completed[step] ?? false, completedAt: completed[step] ? "2026-08-24T00:00:00.000Z" : null }));
}

describe("GoLiveChecklist", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(cleanup);

  it("shows a loading state before the checklist arrives", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<GoLiveChecklist />);
    expect(screen.getByTestId("admin-checklist-loading")).toBeTruthy();
  });

  it("shows an error with retry when the checklist fails to load", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: { code: "error", message: "nope" } }, 500))
      .mockResolvedValueOnce(jsonResponse({ steps: checklistSteps(), canGoLive: false, tenantStatus: "provisioning" }));
    vi.stubGlobal("fetch", fetchMock);
    render(<GoLiveChecklist />);

    await screen.findByTestId("admin-checklist-error");
    await userEvent.click(screen.getByTestId("admin-checklist-retry"));

    expect(await screen.findByTestId("admin-checklist-progress")).toHaveProperty("textContent", "0/5");
  });

  it("renders progress and per-step status for a mixed checklist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          steps: checklistSteps({ outlet_details: true, menu_import: true }),
          canGoLive: false,
          tenantStatus: "provisioning",
        }),
      ),
    );
    render(<GoLiveChecklist />);

    expect(await screen.findByTestId("admin-checklist-progress")).toHaveProperty("textContent", "2/5");
    expect(screen.getByTestId("admin-checklist-step-outlet_details-status").textContent).toBe("Done");
    expect(screen.getByTestId("admin-checklist-step-floor_plan-status").textContent).toBe("Not started");
    expect(screen.queryByTestId("admin-checklist-step-outlet_details-action")).toBeNull();
    expect(screen.getByTestId("admin-checklist-step-floor_plan-action")).toHaveProperty(
      "href",
      expect.stringContaining("/admin/floor-plan"),
    );
  });

  it("disables Go Live with a reason naming the first incomplete required step", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ steps: checklistSteps({ outlet_details: true }), canGoLive: false, tenantStatus: "provisioning" }),
      ),
    );
    render(<GoLiveChecklist />);

    const button = await screen.findByTestId("admin-checklist-go-live");
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("admin-checklist-go-live-reason").textContent).toBe('Complete "Import your menu" to go live.');
  });

  it("marks outlet details complete from the PATCH response, no extra fetch needed", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ steps: checklistSteps(), canGoLive: false, tenantStatus: "provisioning" }))
      .mockResolvedValueOnce(
        jsonResponse({ steps: checklistSteps({ outlet_details: true }), canGoLive: false, tenantStatus: "provisioning" }),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<GoLiveChecklist />);

    await userEvent.click(await screen.findByTestId("admin-checklist-step-outlet_details-action"));

    await waitFor(() => expect(screen.getByTestId("admin-checklist-step-outlet_details-status").textContent).toBe("Done"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [patchUrl, patchInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(patchUrl).toBe("/admin/api/checklist/outlet_details");
    expect(patchInit.method).toBe("PATCH");
    expect(JSON.parse(patchInit.body as string)).toEqual({ completed: true });
  });

  it("enables Go Live and shows a celebratory success state once it succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          steps: checklistSteps({ outlet_details: true, menu_import: true, floor_plan: true, devices: true, staff: true }),
          canGoLive: true,
          tenantStatus: "provisioning",
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ tenant: { id: "t1", status: "active" } }, 201));
    vi.stubGlobal("fetch", fetchMock);
    render(<GoLiveChecklist />);

    const button = await screen.findByTestId("admin-checklist-go-live");
    expect((button as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(button);

    expect(await screen.findByTestId("admin-checklist-go-live-success")).toBeTruthy();
    const [goLiveUrl, goLiveInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(goLiveUrl).toBe("/admin/api/checklist/go-live");
    expect(goLiveInit.method).toBe("POST");
  });

  it("shows which steps blocked Go Live if the backend rejects a stale-looking request", async () => {
    // canGoLive: true is stale here (another tab un-did a step) - the button
    // renders enabled, but the backend is the source of truth and 409s.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          steps: checklistSteps({ outlet_details: true, menu_import: true, floor_plan: true, devices: true, staff: true }),
          canGoLive: true,
          tenantStatus: "provisioning",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: "checklist_incomplete", message: "nope", missingSteps: ["staff"] } }, 409),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<GoLiveChecklist />);

    await userEvent.click(await screen.findByTestId("admin-checklist-go-live"));

    const blocked = await screen.findByTestId("admin-checklist-go-live-blocked");
    expect(blocked.textContent).toContain("Invite your staff");
  });
});
