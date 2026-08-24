import { afterEach, describe, expect, it, vi } from "vitest";
import {
  categoryLabel,
  categorySlug,
  downloadReportExport,
  filenameFromContentDisposition,
  groupReportsByCategory,
  type ReportDefinition,
} from "./reports-state";

const SALES_REPORT: ReportDefinition = {
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

const STAFF_ROSTER_REPORT: ReportDefinition = {
  key: "staff-roster",
  name: "Staff Roster",
  category: "labour",
  hasData: true,
  message: "Current staff and their assigned roles",
  exportFormats: ["csv"],
};

describe("groupReportsByCategory", () => {
  it("groups reports under their category, in REPORT_CATEGORY_ORDER", () => {
    const groups = groupReportsByCategory([STAFF_ROSTER_REPORT, SALES_REPORT, MENU_CATALOGUE_REPORT]);

    expect(groups.map((g) => g.category)).toEqual(["sales", "menu", "labour"]);
    expect(groups[0]!.reports).toEqual([SALES_REPORT]);
    expect(groups[1]!.reports).toEqual([MENU_CATALOGUE_REPORT]);
    expect(groups[2]!.reports).toEqual([STAFF_ROSTER_REPORT]);
  });

  it("drops categories with no reports rather than rendering an empty section", () => {
    const groups = groupReportsByCategory([SALES_REPORT]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.category).toBe("sales");
  });

  it("returns no groups for an empty report list", () => {
    expect(groupReportsByCategory([])).toEqual([]);
  });
});

describe("categoryLabel", () => {
  it("maps every wire category code to its display label", () => {
    expect(categoryLabel("sales")).toBe("Sales Performance");
    expect(categoryLabel("financial")).toBe("Financial & Compliance");
    expect(categoryLabel("menu")).toBe("Menu Engineering");
    expect(categoryLabel("operations")).toBe("Operations");
    expect(categoryLabel("inventory")).toBe("Inventory");
    expect(categoryLabel("labour")).toBe("Labour");
  });
});

describe("categorySlug", () => {
  it("is a stable, already-kebab-safe id for use in a data-testid", () => {
    expect(categorySlug("sales")).toBe("sales");
    expect(categorySlug("financial")).toBe("financial");
  });
});

describe("filenameFromContentDisposition", () => {
  it("extracts a quoted filename", () => {
    expect(filenameFromContentDisposition('attachment; filename="menu-catalogue.csv"')).toBe("menu-catalogue.csv");
  });

  it("extracts an unquoted filename", () => {
    expect(filenameFromContentDisposition("attachment; filename=staff-roster.csv")).toBe("staff-roster.csv");
  });

  it("returns null when there is no header", () => {
    expect(filenameFromContentDisposition(null)).toBeNull();
  });
});

describe("downloadReportExport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("creates an object URL for the blob, clicks a download anchor, then revokes the URL", () => {
    const createObjectURL = vi.fn(() => "blob:mock-url");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const blob = new Blob(["id,name\n1,Item"], { type: "text/csv" });

    downloadReportExport({ filename: "menu-catalogue.csv", blob });

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });
});
