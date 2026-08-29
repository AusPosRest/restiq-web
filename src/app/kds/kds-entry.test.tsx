// Station picker persistence (EXPERIENCE.md: "the choice persists per
// browser - a wall display picks once").
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KdsOutletProvider } from "./kds-outlet-context";
import { KdsEntry } from "./kds-entry";

const replace = vi.fn();
let search = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(search),
}));

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

function renderEntry() {
  return render(
    <KdsOutletProvider outlet={{ id: "o1", name: "Spice Route" }}>
      <KdsEntry />
    </KdsOutletProvider>,
  );
}

describe("KdsEntry", () => {
  beforeEach(() => {
    replace.mockReset();
    search = "";
    window.localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the picker and saves the choice to localStorage on first entry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse([{ id: "s1", name: "Tandoor", ageingThresholdMinutes: 10 }])),
    );
    renderEntry();

    const option = await screen.findByTestId("kds-station-option-s1");
    await userEvent.click(option);

    expect(window.localStorage.getItem("kds:station:o1")).toBe("s1");
    expect(replace).toHaveBeenCalledWith("/kds/station/s1");
  });

  it("redirects straight to the saved station without showing the picker", async () => {
    window.localStorage.setItem("kds:station:o1", "s1");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse([{ id: "s1", name: "Tandoor", ageingThresholdMinutes: 10 }])),
    );
    renderEntry();

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/kds/station/s1"));
    expect(screen.queryByTestId("kds-entry-picker")).toBeNull();
  });

  it("forces the picker again when ?reselect=1 is set (the header's Change station control)", async () => {
    window.localStorage.setItem("kds:station:o1", "s1");
    search = "reselect=1";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse([{ id: "s1", name: "Tandoor", ageingThresholdMinutes: 10 }])),
    );
    renderEntry();

    expect(await screen.findByTestId("kds-entry-picker")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("offers the synthetic unrouted option when the outlet has zero stations", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));
    renderEntry();

    expect(await screen.findByTestId("kds-station-option-unrouted")).toBeTruthy();
  });
});
