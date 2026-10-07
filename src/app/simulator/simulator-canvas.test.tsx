import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SimulatorCanvas } from "./simulator-canvas";

const STORAGE_KEY = "restiq:simulator:v1";

// Pointer-drag (pan/move/resize) is deliberately NOT exercised here: jsdom
// has no setPointerCapture implementation, same reason floor-plan-
// canvas.test.tsx only drives its drag logic through arrow keys rather than
// firing pointerDown directly on the draggable element - that logic is pure
// and already covered by simulator-state.test.ts's moveFrame/resizeFrame/
// zoomAt/panCamera tests.

describe("SimulatorCanvas", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    cleanup();
  });

  it("shows the empty-canvas hint until a device is added", async () => {
    render(<SimulatorCanvas />);
    expect(await screen.findByText("Add a device to begin")).toBeTruthy();
  });

  it("adds a preset device as an iframe with the preset's path", async () => {
    render(<SimulatorCanvas />);
    await screen.findByText("Add a device to begin");

    await userEvent.click(screen.getByTestId("simulator-add-menu"));
    await userEvent.click(screen.getByTestId("simulator-add-kds"));

    const iframe = await screen.findByTitle("KDS");
    expect(iframe.tagName).toBe("IFRAME");
    expect(iframe.getAttribute("src")).toBe("/kds");
    expect(screen.queryByText("Add a device to begin")).toBeNull();
  });

  it("removes a frame", async () => {
    render(<SimulatorCanvas />);
    await screen.findByText("Add a device to begin");
    await userEvent.click(screen.getByTestId("simulator-add-menu"));
    await userEvent.click(screen.getByTestId("simulator-add-kds"));
    await screen.findByTitle("KDS");

    const removeButton = screen.getByRole("button", { name: "Remove KDS" });
    await userEvent.click(removeButton);

    expect(screen.queryByTitle("KDS")).toBeNull();
    expect(await screen.findByText("Add a device to begin")).toBeTruthy();
  });

  it("changes the displayed zoom percent on zoom in/out and resets to 100% on click", async () => {
    render(<SimulatorCanvas />);
    await screen.findByText("Add a device to begin");

    const percent = screen.getByTestId("simulator-zoom-reset");
    expect(percent.textContent).toBe("100%");

    await userEvent.click(screen.getByTestId("simulator-zoom-in"));
    expect(percent.textContent).not.toBe("100%");

    await userEvent.click(percent);
    expect(percent.textContent).toBe("100%");

    await userEvent.click(screen.getByTestId("simulator-zoom-out"));
    expect(percent.textContent).not.toBe("100%");
  });

  it("rejects a cross-origin custom URL inline, and accepts a same-origin path", async () => {
    render(<SimulatorCanvas />);
    await screen.findByText("Add a device to begin");
    await userEvent.click(screen.getByTestId("simulator-add-menu"));

    await userEvent.type(screen.getByTestId("simulator-custom-url"), "https://evil.example");
    await userEvent.click(screen.getByTestId("simulator-custom-url-add"));
    expect(screen.getByTestId("simulator-custom-url-error")).toBeTruthy();
    expect(screen.queryByTitle("Custom")).toBeNull();

    await userEvent.clear(screen.getByTestId("simulator-custom-url"));
    await userEvent.type(screen.getByTestId("simulator-custom-url"), "/pos/login");
    await userEvent.click(screen.getByTestId("simulator-custom-url-add"));

    const iframe = await screen.findByTitle("Custom");
    expect(iframe.getAttribute("src")).toBe("/pos/login");
  });

  it("restores a layout saved in localStorage on mount", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        frames: [{ id: "f1", label: "POS till", path: "/pos/login", x: 10, y: 20, width: 1024, height: 768 }],
        camera: { x: 0, y: 0, scale: 1 },
      }),
    );
    render(<SimulatorCanvas />);

    const iframe = await screen.findByTitle("POS till");
    expect(iframe.getAttribute("src")).toBe("/pos/login");
  });

  it("clears every frame", async () => {
    render(<SimulatorCanvas />);
    await screen.findByText("Add a device to begin");
    await userEvent.click(screen.getByTestId("simulator-add-menu"));
    await userEvent.click(screen.getByTestId("simulator-add-kds"));
    await screen.findByTitle("KDS");

    await userEvent.click(screen.getByTestId("simulator-clear"));

    expect(screen.queryByTitle("KDS")).toBeNull();
    expect(await screen.findByText("Add a device to begin")).toBeTruthy();
  });
});
