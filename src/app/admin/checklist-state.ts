// Pure Go-Live Checklist logic (CAP-2), kept free of React so it's testable
// on its own. Deep-links point at the routes stories 2, 5, 6 and 7 will build;
// until then they 404, which is expected for this story.

export type ChecklistStepKey = "outlet_details" | "menu_import" | "floor_plan" | "devices" | "staff";

export interface ChecklistStepView {
  step: ChecklistStepKey;
  completed: boolean;
  completedAt: string | null;
}

export interface ChecklistState {
  steps: ChecklistStepView[];
  canGoLive: boolean;
  tenantStatus: string;
}

export interface StepMeta {
  label: string;
  description: string;
  /** "complete" steps have no dedicated screen yet - the owner marks them done directly. */
  action: "complete" | "link";
  href?: string;
}

export const STEP_META: Record<ChecklistStepKey, StepMeta> = {
  outlet_details: {
    label: "Outlet details",
    description: "Confirm your outlet's address, hours and contact info.",
    action: "complete",
  },
  menu_import: {
    label: "Import your menu",
    description: "Upload a photo, PDF or spreadsheet - we will do the rest.",
    action: "link",
    href: "/admin/menu/import",
  },
  floor_plan: {
    label: "Set up floor plan and tables",
    description: "Lay out your floors and tables.",
    action: "link",
    href: "/admin/floor-plan",
  },
  devices: {
    label: "Connect a POS device and printer",
    description: "Enrol your first device.",
    action: "link",
    href: "/admin/devices",
  },
  staff: {
    label: "Invite your staff",
    description: "Add your team and assign roles.",
    action: "link",
    href: "/admin/staff",
  },
};

export function countComplete(steps: readonly ChecklistStepView[]): number {
  return steps.filter((step) => step.completed).length;
}

export function stepLabel(key: string): string {
  return (STEP_META as Record<string, StepMeta>)[key]?.label ?? key;
}

export function firstIncompleteStep(steps: readonly ChecklistStepView[]): string | null {
  return steps.find((step) => !step.completed)?.step ?? null;
}

/** Null once Go Live is unlocked; otherwise the guidance to show next to the disabled button. */
export function goLiveMessage(canGoLive: boolean, steps: readonly ChecklistStepView[]): string | null {
  if (canGoLive) return null;
  const next = firstIncompleteStep(steps);
  return next ? `Complete "${stepLabel(next)}" to go live.` : "Complete the remaining steps to go live.";
}
