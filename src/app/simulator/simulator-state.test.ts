import { beforeEach, describe, expect, it } from "vitest";
import {
  addFrame,
  clearFrames,
  createDefaultLayout,
  fitAll,
  loadLayout,
  moveFrame,
  panCamera,
  removeFrame,
  resizeFrame,
  saveLayout,
  validateCustomPath,
  zoomAt,
  type SimulatorLayout,
} from "./simulator-state";

const PRESET = { label: "KDS", path: "/kds", width: 1280, height: 720 };
const VIEWPORT = { width: 1000, height: 800 };

describe("addFrame", () => {
  it("places the first frame at the centre of the current view", () => {
    const layout = addFrame(createDefaultLayout(), PRESET, VIEWPORT);
    const frame = layout.frames[0];
    expect(frame.x).toBe(1000 / 2 - 1280 / 2);
    expect(frame.y).toBe(800 / 2 - 720 / 2);
    expect(frame.label).toBe("KDS");
    expect(frame.path).toBe("/kds");
    expect(frame.id).toBeTruthy();
  });

  it("places each subsequent frame to the right of the existing ones, no overlap", () => {
    let layout = createDefaultLayout();
    layout = addFrame(layout, PRESET, VIEWPORT);
    layout = addFrame(layout, PRESET, VIEWPORT);
    const [first, second] = layout.frames;
    expect(second.x).toBe(first.x + first.width + 40);
    expect(second.y).toBe(first.y);
  });

  it("accounts for an existing camera pan/zoom when centring", () => {
    const panned: SimulatorLayout = { frames: [], camera: { x: 100, y: 50, scale: 2 } };
    const layout = addFrame(panned, PRESET, VIEWPORT);
    const frame = layout.frames[0];
    const centerWorldX = (500 - 100) / 2;
    const centerWorldY = (400 - 50) / 2;
    expect(frame.x).toBe(centerWorldX - 1280 / 2);
    expect(frame.y).toBe(centerWorldY - 720 / 2);
  });
});

describe("removeFrame", () => {
  it("removes only the matching frame", () => {
    let layout = addFrame(createDefaultLayout(), PRESET, VIEWPORT);
    layout = addFrame(layout, PRESET, VIEWPORT);
    const keepId = layout.frames[1].id;
    layout = removeFrame(layout, layout.frames[0].id);
    expect(layout.frames).toHaveLength(1);
    expect(layout.frames[0].id).toBe(keepId);
  });
});

describe("moveFrame", () => {
  it("updates the frame's position", () => {
    let layout = addFrame(createDefaultLayout(), PRESET, VIEWPORT);
    const id = layout.frames[0].id;
    layout = moveFrame(layout, id, 10, 20);
    expect(layout.frames[0]).toMatchObject({ x: 10, y: 20 });
  });
});

describe("resizeFrame", () => {
  it("resizes within requested bounds", () => {
    let layout = addFrame(createDefaultLayout(), PRESET, VIEWPORT);
    const id = layout.frames[0].id;
    layout = resizeFrame(layout, id, 500, 400);
    expect(layout.frames[0]).toMatchObject({ width: 500, height: 400 });
  });

  it("clamps below the minimum 240x320", () => {
    let layout = addFrame(createDefaultLayout(), PRESET, VIEWPORT);
    const id = layout.frames[0].id;
    layout = resizeFrame(layout, id, 10, 10);
    expect(layout.frames[0]).toMatchObject({ width: 240, height: 320 });
  });
});

describe("clearFrames", () => {
  it("empties the frame list but leaves the camera untouched", () => {
    let layout = addFrame(createDefaultLayout(), PRESET, VIEWPORT);
    layout = { ...layout, camera: { x: 5, y: 5, scale: 1.5 } };
    layout = clearFrames(layout);
    expect(layout.frames).toEqual([]);
    expect(layout.camera).toEqual({ x: 5, y: 5, scale: 1.5 });
  });
});

describe("panCamera", () => {
  it("shifts x/y by the given delta, leaving scale untouched", () => {
    expect(panCamera({ x: 0, y: 0, scale: 1.5 }, 10, -20)).toEqual({ x: 10, y: -20, scale: 1.5 });
  });
});

describe("zoomAt", () => {
  it("clamps scale to the 0.1-2 range", () => {
    expect(zoomAt({ x: 0, y: 0, scale: 1 }, 0, 0, 10).scale).toBe(2);
    expect(zoomAt({ x: 0, y: 0, scale: 1 }, 0, 0, 0.0001).scale).toBe(0.1);
  });

  it("keeps the world point under the cursor fixed on screen", () => {
    const camera = { x: 20, y: 10, scale: 1 };
    const cursor = { x: 300, y: 200 };
    const worldBefore = { x: (cursor.x - camera.x) / camera.scale, y: (cursor.y - camera.y) / camera.scale };
    const next = zoomAt(camera, cursor.x, cursor.y, 1.5);
    const worldAfter = { x: (cursor.x - next.x) / next.scale, y: (cursor.y - next.y) / next.scale };
    expect(worldAfter.x).toBeCloseTo(worldBefore.x);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y);
  });
});

describe("fitAll", () => {
  it("returns the default camera for an empty layout", () => {
    expect(fitAll([], VIEWPORT)).toEqual({ x: 0, y: 0, scale: 1 });
  });

  it("centres and scales so the bounding box fits with padding", () => {
    const frames = [
      { id: "a", label: "A", path: "/a", x: 0, y: 0, width: 200, height: 200 },
      { id: "b", label: "B", path: "/b", x: 800, y: 0, width: 200, height: 200 },
    ];
    const camera = fitAll(frames, { width: 1000, height: 500 }, 0);
    // bounds: 0..1000 wide, 0..200 tall; width-limited scale = 1000/1000 = 1
    expect(camera.scale).toBe(1);
    // bounds centre (500,100) should land on the viewport centre (500,250)
    expect(camera.x).toBeCloseTo(500 - 500 * camera.scale);
    expect(camera.y).toBeCloseTo(250 - 100 * camera.scale);
  });
});

describe("validateCustomPath", () => {
  it("accepts a same-origin path", () => {
    expect(validateCustomPath("/pos/login")).toEqual({ ok: true, path: "/pos/login" });
  });

  it.each(["https://x", "//evil.com", "javascript:x", "", "   ", "/\\evil.com"])("rejects %s", (input) => {
    expect(validateCustomPath(input).ok).toBe(false);
  });
});

describe("localStorage persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips a layout through save/load", () => {
    const layout = addFrame(createDefaultLayout(), PRESET, VIEWPORT);
    saveLayout(layout);
    expect(loadLayout()).toEqual(layout);
  });

  it("falls back to the default layout when storage is empty", () => {
    expect(loadLayout()).toEqual(createDefaultLayout());
  });

  it("falls back to the default layout for corrupt JSON", () => {
    window.localStorage.setItem("restiq:simulator:v1", "{not json");
    expect(loadLayout()).toEqual(createDefaultLayout());
  });

  it("falls back to the default layout for a shape that doesn't match (old/foreign data)", () => {
    window.localStorage.setItem("restiq:simulator:v1", JSON.stringify({ frames: [{ id: "x" }], camera: { x: 0 } }));
    expect(loadLayout()).toEqual(createDefaultLayout());
  });
});
