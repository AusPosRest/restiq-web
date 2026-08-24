import { describe, expect, it } from "vitest";
import { countComplete, firstIncompleteStep, goLiveMessage, stepLabel, type ChecklistStepView } from "./checklist-state";

function steps(completed: Partial<Record<ChecklistStepView["step"], boolean>>): ChecklistStepView[] {
  const keys: ChecklistStepView["step"][] = ["outlet_details", "menu_import", "floor_plan", "devices", "staff"];
  return keys.map((step) => ({ step, completed: completed[step] ?? false, completedAt: null }));
}

describe("countComplete", () => {
  it("counts zero when nothing is done", () => {
    expect(countComplete(steps({}))).toBe(0);
  });

  it("counts each completed step", () => {
    expect(countComplete(steps({ outlet_details: true, staff: true }))).toBe(2);
  });

  it("counts five when everything is done", () => {
    expect(
      countComplete(steps({ outlet_details: true, menu_import: true, floor_plan: true, devices: true, staff: true })),
    ).toBe(5);
  });
});

describe("firstIncompleteStep", () => {
  it("returns the first step in array order that isn't done", () => {
    expect(firstIncompleteStep(steps({ outlet_details: true }))).toBe("menu_import");
  });

  it("returns null once everything is done", () => {
    expect(
      firstIncompleteStep(steps({ outlet_details: true, menu_import: true, floor_plan: true, devices: true, staff: true })),
    ).toBeNull();
  });
});

describe("stepLabel", () => {
  it("resolves a known step key to its label", () => {
    expect(stepLabel("menu_import")).toBe("Import your menu");
  });

  it("falls back to the raw key for an unknown step", () => {
    expect(stepLabel("something_else")).toBe("something_else");
  });
});

describe("goLiveMessage", () => {
  it("is null once Go Live is unlocked", () => {
    expect(goLiveMessage(true, steps({ outlet_details: true, menu_import: true, floor_plan: true, devices: true, staff: true }))).toBeNull();
  });

  it("names the first incomplete required step", () => {
    expect(goLiveMessage(false, steps({ outlet_details: true }))).toBe('Complete "Import your menu" to go live.');
  });

  it("falls back to a generic message when somehow no step is named", () => {
    expect(
      goLiveMessage(false, steps({ outlet_details: true, menu_import: true, floor_plan: true, devices: true, staff: true })),
    ).toBe("Complete the remaining steps to go live.");
  });
});
