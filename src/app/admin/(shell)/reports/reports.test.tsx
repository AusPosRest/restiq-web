import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../toast";
import { Reports } from "./reports";
import type { ExportDestinationView, ReportDefinition } from "./reports-state";

const PENDING_REPORT: ReportDefinition = {
  key: "sales-summary",
  name: "Sales Summary",
  category: "sales",
  hasData: false,
  message: "Available once POS Core Loop is live",
  exportFormats: [],
};

const MENU_CATALOGUE_REPORT: ReportDefinition = {
  key: "menu-catalogue",
  name: "Menu Catalogue",
  category: "menu",
  hasData: true,
  message: "Current categories, items, and prices from your live menu",
  exportFormats: ["csv"],
};

const REPORTS: ReportDefinition[] = [PENDING_REPORT, MENU_CATALOGUE_REPORT];

const DESTINATIONS: ExportDestinationView[] = [
  { key: "tally", name: "Tally", status: "not_connected" },
  { key: "xero", name: "Xero", status: "not_connected" },
  { key: "myob", name: "MYOB", status: "not_connected" },
  { key: "zoho", name: "Zoho Books", status: "not_connected" },
  { key: "quickbooks", name: "QuickBooks", status: "not_connected" },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    status: 200,
    headers: { "content-type": "text/csv", "content-disposition": `attachment; filename="${filename}"` },
  });
}

function stubFetch() {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/reports/menu-catalogue/export")) {
      expect(url).toContain("format=csv");
      return Promise.resolve(csvResponse("category,item\nMains,Butter Chicken", "menu-catalogue.csv"));
    }
    if (url.includes("/reports/export-destinations")) return Promise.resolve(jsonResponse(DESTINATIONS));
    if (url.endsWith("/reports")) return Promise.resolve(jsonResponse(REPORTS));
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "unexpected path" } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderReports() {
  return render(
    <ToastProvider>
      <Reports />
    </ToastProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Reports", () => {
  it("shows a loading skeleton, then a retryable error panel on failure", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({ error: { code: "error", message: "nope" } }, 500)));
    vi.stubGlobal("fetch", fetchMock);
    renderReports();
    expect(screen.getByTestId("reports-loading")).toBeTruthy();

    await screen.findByTestId("reports-load-error");
    await userEvent.click(screen.getByTestId("reports-load-error-retry"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("groups report cards by category and shows the backend's honest message for reports with no data source yet", async () => {
    stubFetch();
    renderReports();

    await screen.findByTestId("reports-category-sales");
    expect(screen.getByTestId("report-card-sales-summary-message").textContent).toBe("Available once POS Core Loop is live");
    expect(screen.getByTestId("report-card-sales-summary-pending")).toBeTruthy();
    expect(screen.queryByTestId("report-card-sales-summary-export")).toBeNull();
  });

  it("shows a working Export CSV action for a real report", async () => {
    stubFetch();
    renderReports();

    await screen.findByTestId("reports-category-menu");
    expect(screen.getByTestId("report-card-menu-catalogue-export").textContent).toContain("Export CSV");
    expect(screen.queryByTestId("report-card-menu-catalogue-pending")).toBeNull();
  });

  it("clicking Export CSV fetches the real csv=format export and triggers a browser download", async () => {
    const fetchMock = stubFetch();
    const createObjectURL = vi.fn(() => "blob:mock-url");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    renderReports();
    await screen.findByTestId("report-card-menu-catalogue-export");

    await userEvent.click(screen.getByTestId("report-card-menu-catalogue-export"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/reports/menu-catalogue/export?format=csv"));
    });
    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    expect(await screen.findByTestId("toast-success")).toBeTruthy();
    expect(screen.getByTestId("toast-success").textContent).toContain("menu-catalogue.csv");
  });

  it("shows an error toast when an export fails", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/reports/menu-catalogue/export")) return Promise.resolve(jsonResponse({ error: { code: "error", message: "Export failed" } }, 500));
      if (url.endsWith("/reports")) return Promise.resolve(jsonResponse(REPORTS));
      return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "unexpected path" } }, 404));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderReports();
    await screen.findByTestId("report-card-menu-catalogue-export");
    await userEvent.click(screen.getByTestId("report-card-menu-catalogue-export"));

    expect(await screen.findByTestId("toast-error")).toBeTruthy();
    expect(screen.getByTestId("toast-error").textContent).toContain("Export failed");
  });

  it("opens the accounting destinations picker showing every destination as not connected", async () => {
    stubFetch();
    renderReports();
    await screen.findByTestId("reports-open-destinations");

    await userEvent.click(screen.getByTestId("reports-open-destinations"));

    const dialog = await screen.findByTestId("export-destinations-dialog");
    expect(dialog).toBeTruthy();
    for (const destination of DESTINATIONS) {
      const status = await screen.findByTestId(`export-destination-${destination.key}-status`);
      expect(status.textContent).toBe("Not connected");
    }
  });
});
