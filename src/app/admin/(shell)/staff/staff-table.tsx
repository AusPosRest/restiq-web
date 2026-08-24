"use client";

// Staff list (T7): name/email, a per-row role dropdown constrained to the
// tenant's seeded roles, and PIN issue/revoke. Role change and PIN revoke are
// both security-relevant (SPEC constraints; EXPERIENCE.md: pessimistic with a
// confirm step) - this component only requests those actions; the confirm
// dialog and the actual mutation live in staff.tsx so one dialog instance is
// shared across every row (mirrors menu-table.tsx's price-change-dialog use).
import { KeyRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { staffFullName, type PinStatus, type RoleView, type StaffView } from "./staff-state";

const PIN_STATUS_LABELS: Record<PinStatus, string> = { active: "Active", none: "No PIN", revoked: "Revoked" };
const PIN_STATUS_STYLES: Record<PinStatus, string> = {
  active: "border-status-active/50 bg-status-active/10 text-status-active",
  none: "border-border/60 bg-card/50 text-muted-foreground",
  revoked: "border-status-error/50 bg-status-error/10 text-status-error",
};

const SELECT_CLASSES =
  "h-9 rounded-lg border border-border bg-input px-2.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

export interface StaffTableProps {
  staff: readonly StaffView[];
  roles: readonly RoleView[];
  busyStaffId: string | null;
  onRoleSelected: (staffId: string, roleId: string) => void;
  onIssuePin: (staffId: string) => void;
  onRevokeRequested: (staffId: string) => void;
}

export function StaffTable({ staff, roles, busyStaffId, onRoleSelected, onIssuePin, onRevokeRequested }: Readonly<StaffTableProps>) {
  if (staff.length === 0) {
    return (
      <div data-testid="staff-empty" className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/60 bg-card/50 px-8 py-16 text-center">
        <Users className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="font-headline text-lg font-medium">No staff yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">Add your first team member to give them access to the till.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border/40 bg-card">
      <table className="w-full text-sm" data-testid="staff-table">
        <thead>
          <tr className="h-12 border-b border-border/40">
            <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
            <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</th>
            <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">System Role</th>
            <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">POS PIN</th>
            <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {staff.map((member) => {
            const busy = busyStaffId === member.id;
            return (
              <tr key={member.id} data-testid={`staff-row-${member.id}`} className="h-14 border-b border-border/20 last:border-b-0">
                <td className="px-4 font-medium">{staffFullName(member)}</td>
                <td className="px-4 text-muted-foreground">{member.email}</td>
                <td className="px-4">
                  <label className="sr-only" htmlFor={`staff-role-${member.id}`}>
                    {staffFullName(member)}&apos;s role
                  </label>
                  <select
                    id={`staff-role-${member.id}`}
                    data-testid={`staff-role-select-${member.id}`}
                    value={member.roleId}
                    disabled={busy}
                    onChange={(event) => onRoleSelected(member.id, event.target.value)}
                    className={SELECT_CLASSES}
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4">
                  <span
                    data-testid={`staff-pin-status-${member.id}`}
                    className={`font-label inline-flex items-center rounded-[6px] border px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${PIN_STATUS_STYLES[member.pinStatus]}`}
                  >
                    {PIN_STATUS_LABELS[member.pinStatus]}
                  </span>
                </td>
                <td className="px-4">
                  {member.pinStatus === "active" ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      data-testid={`staff-revoke-pin-${member.id}`}
                      disabled={busy}
                      onClick={() => onRevokeRequested(member.id)}
                    >
                      Revoke access
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" data-testid={`staff-issue-pin-${member.id}`} disabled={busy} onClick={() => onIssuePin(member.id)}>
                      <KeyRound aria-hidden="true" /> Issue PIN
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
