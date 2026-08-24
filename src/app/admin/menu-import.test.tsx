import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MenuImport } from "./menu-import";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function draftItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "1",
    name: "Paneer Tikka",
    shortName: "Paneer Tikka",
    category: "Starters",
    priceMinor: 32000,
    currency: "INR",
    confidence: { name: 1, shortName: 1, category: 1, price: 1, overall: 1 },
    ...overrides,
  };
}

const DRAFT = {
  importId: "imp-1",
  status: "draft",
  sourceType: "csv",
  fileName: "menu.csv",
  items: [
    draftItem({ id: "1" }),
    draftItem({ id: "2", name: "Chicken Seekh Kebab", confidence: { name: 1, shortName: 1, category: 1, price: 0.6, overall: 0.65 } }),
    draftItem({ id: "3", name: "", confidence: { name: 0.2, shortName: 0.5, category: 0.3, price: 0.2, overall: 0.2 } }),
  ],
};

function csvFile(name = "menu.csv"): File {
  return new File(["name,price\nPaneer,320"], name, { type: "text/csv" });
}

async function uploadAndReachReview() {
  render(<MenuImport />);
  const input = screen.getByTestId("menu-import-file-input");
  await userEvent.upload(input, csvFile());
  return screen.findByTestId("menu-import-table");
}

describe("MenuImport dropzone", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(cleanup);

  it("rejects an unsupported file type dropped onto the zone, without calling the API", async () => {
    // Drag-and-drop bypasses the file input's own "accept" filter, so this is
    // the path that exercises the app's own isAcceptedMenuFile validation.
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<MenuImport />);

    const dropzone = screen.getByTestId("menu-import-dropzone");
    fireEvent.drop(dropzone, { dataTransfer: { files: [new File(["hi"], "menu.txt", { type: "text/plain" })] } });

    expect(await screen.findByTestId("menu-import-upload-error")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a .xls file - the backend's resolveSourceType has no mapping for it", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<MenuImport />);

    fireEvent.drop(screen.getByTestId("menu-import-dropzone"), { dataTransfer: { files: [new File(["x"], "menu.xls")] } });

    expect(await screen.findByTestId("menu-import-upload-error")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts a supported file type and uploads it as multipart form data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(DRAFT, 201));
    vi.stubGlobal("fetch", fetchMock);

    await uploadAndReachReview();

    expect(fetchMock).toHaveBeenCalledWith("/admin/api/menu-import/upload", expect.objectContaining({ method: "POST" }));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("shows the upload's error message and returns to the dropzone on failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: { code: "error", message: "Could not read that file" } }, 422));
    vi.stubGlobal("fetch", fetchMock);
    render(<MenuImport />);

    await userEvent.upload(screen.getByTestId("menu-import-file-input"), csvFile());

    expect(await screen.findByTestId("menu-import-upload-error")).toHaveProperty("textContent", "Could not read that file");
    expect(screen.getByTestId("menu-import-dropzone")).toBeTruthy();
  });

  it("shows an empty state with a way to start over when the draft has no items", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ ...DRAFT, items: [] }, 201)));
    render(<MenuImport />);

    await userEvent.upload(screen.getByTestId("menu-import-file-input"), csvFile());

    await screen.findByTestId("menu-import-empty");
    await userEvent.click(screen.getByTestId("menu-import-start-over"));
    expect(screen.getByTestId("menu-import-dropzone")).toBeTruthy();
  });
});

describe("MenuImport review", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(cleanup);

  it("renders each row's overall confidence as a text chip", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(DRAFT, 201)));
    await uploadAndReachReview();

    expect(screen.getByTestId("menu-import-row-1-confidence").textContent).toBe("High confidence");
    expect(screen.getByTestId("menu-import-row-2-confidence").textContent).toBe("Medium confidence");
    expect(screen.getByTestId("menu-import-row-3-confidence").textContent).toBe("Low confidence");
  });

  it("flags a specific low-confidence field with its own hint, but not a high-confidence one", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(DRAFT, 201)));
    await uploadAndReachReview();

    expect(screen.getByTestId("menu-import-row-3-name-confidence").textContent).toContain("Low confidence");
    expect(screen.queryByTestId("menu-import-row-1-name-confidence")).toBeNull();
  });

  it("shows price in major units converted from priceMinor, with its currency", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(DRAFT, 201)));
    await uploadAndReachReview();

    expect((screen.getByTestId("menu-import-row-1-price") as HTMLInputElement).value).toBe("320.00");
  });

  it("keeps Commit menu disabled until every row is reviewed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(DRAFT, 201)));
    await uploadAndReachReview();

    const commit = screen.getByTestId("menu-import-commit") as HTMLButtonElement;
    expect(commit.disabled).toBe(true);

    await userEvent.click(screen.getByTestId("menu-import-row-1-reviewed"));
    await userEvent.click(screen.getByTestId("menu-import-row-2-reviewed"));
    expect(commit.disabled).toBe(true);

    await userEvent.click(screen.getByTestId("menu-import-row-3-reviewed"));
    expect(commit.disabled).toBe(false);
    expect(screen.getByTestId("menu-import-reviewed-count").textContent).toBe("3/3 reviewed");
  });

  it("updates local state immediately on an inline edit, before the PATCH resolves", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(DRAFT, 201));
    vi.stubGlobal("fetch", fetchMock);
    await uploadAndReachReview();

    let resolvePatch: (value: Response) => void = () => {};
    fetchMock.mockReturnValue(new Promise((resolve) => (resolvePatch = resolve)));

    const nameInput = screen.getByTestId("menu-import-row-3-name") as HTMLInputElement;
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Butter Naan");
    nameInput.blur();

    // local state reflects the edit synchronously - the PATCH is still pending
    expect(nameInput.value).toBe("Butter Naan");

    resolvePatch(jsonResponse({ ...DRAFT, items: DRAFT.items.map((item) => (item.id === "3" ? { ...item, name: "Butter Naan" } : item)) }));

    await waitFor(() => {
      const [patchUrl, patchInit] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
      expect(patchUrl).toBe("/admin/api/menu-import/imp-1");
      expect(patchInit.method).toBe("PATCH");
      expect(JSON.parse(patchInit.body as string)).toEqual({ items: [{ id: "3", name: "Butter Naan" }] });
    });
  });

  it("rolls back an edit and shows a toast if the save fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(DRAFT, 201))
      .mockResolvedValueOnce(jsonResponse({ error: { code: "error", message: "nope" } }, 500));
    vi.stubGlobal("fetch", fetchMock);
    await uploadAndReachReview();

    const nameInput = screen.getByTestId("menu-import-row-1-name") as HTMLInputElement;
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Changed Name");
    nameInput.blur();

    await screen.findByTestId("menu-import-toast");
    await waitFor(() => expect((screen.getByTestId("menu-import-row-1-name") as HTMLInputElement).value).toBe("Paneer Tikka"));
  });

  it("commits with the import id and shows the celebratory success state linking back to the checklist", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(DRAFT, 201))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            importId: "imp-1",
            committedAt: "2026-08-24T00:00:00.000Z",
            categories: [{ id: "c1", name: "Starters" }],
            items: [{ id: "i1", name: "Paneer Tikka", shortName: "Paneer Tikka", categoryId: "c1", price: { id: "p1", priceMinor: 32000, currency: "INR" } }],
          },
          201,
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    await uploadAndReachReview();

    await userEvent.click(screen.getByTestId("menu-import-row-1-reviewed"));
    await userEvent.click(screen.getByTestId("menu-import-row-2-reviewed"));
    await userEvent.click(screen.getByTestId("menu-import-row-3-reviewed"));
    await userEvent.click(screen.getByTestId("menu-import-commit"));

    await screen.findByTestId("menu-import-success");
    const [commitUrl, commitInit] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(commitUrl).toBe("/admin/api/menu-import/imp-1/commit");
    expect(commitInit.method).toBe("POST");

    const link = within(screen.getByTestId("menu-import-success")).getByTestId("menu-import-success-onboarding-link");
    expect(link).toHaveProperty("href", expect.stringContaining("/admin/onboarding"));
  });

  it("shows a commit error and stays in review if commit fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(DRAFT, 201))
      .mockResolvedValueOnce(jsonResponse({ error: { code: "conflict", message: "This import has duplicate item names within a category" } }, 409));
    vi.stubGlobal("fetch", fetchMock);
    await uploadAndReachReview();

    await userEvent.click(screen.getByTestId("menu-import-row-1-reviewed"));
    await userEvent.click(screen.getByTestId("menu-import-row-2-reviewed"));
    await userEvent.click(screen.getByTestId("menu-import-row-3-reviewed"));
    await userEvent.click(screen.getByTestId("menu-import-commit"));

    expect(await screen.findByTestId("menu-import-commit-error")).toHaveProperty(
      "textContent",
      "This import has duplicate item names within a category",
    );
    expect(screen.getByTestId("menu-import-table")).toBeTruthy();
  });
});
