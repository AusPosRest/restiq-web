"use client";

// T7 Staff & Roles (CAP-7): tenant-wide, not per-outlet (Role has no outlet
// scoping in restiq-backend's schema - see staff-state.ts's file header), so
// unlike Devices/Floor Plan/Capabilities this view doesn't key off the
// shell's outlet switcher at all.
import { Plus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AdminApiError, createStaff, fetchRoles, fetchStaff, issueStaffPin, revokeStaffPin, updateStaffRole } from "../../api";
import { ConfirmReasonDialog } from "../confirm-reason-dialog";
import { LoadErrorPanel, Skeleton } from "../data-states";
import { useToast } from "../toast";
import { AddStaffDialog } from "./add-staff-dialog";
import { PermissionMatrix } from "./permission-matrix";
import { staffFullName, type AddStaffForm, type RoleView, type StaffView } from "./staff-state";
import { StaffTable, type IssuedPinView } from "./staff-table";

interface StaffData {
  roles: RoleView[];
  staff: StaffView[];
}

function useStaffData() {
  const [attempt, setAttempt] = useState(0);
  const [landed, setLanded] = useState<{ attempt: number; data: StaffData | null; failed: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchRoles(), fetchStaff()])
      .then(([roles, staff]) => {
        if (!cancelled) setLanded({ attempt, failed: false, data: { roles, staff } });
      })
      .catch(() => {
        if (!cancelled) setLanded({ attempt, failed: true, data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const current = landed && landed.attempt === attempt ? landed : null;
  return {
    loading: current === null,
    failed: current?.failed ?? false,
    data: current?.data ?? null,
    retry: () => setAttempt((n) => n + 1),
  };
}

function LoadingShell() {
  return (
    <div className="space-y-4" data-testid="staff-loading">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64" />
    </div>
  );
}

export function Staff() {
  const { loading, failed, data, retry } = useStaffData();

  if (loading) return <LoadingShell />;
  if (failed) return <LoadErrorPanel testId="staff-load-error" message="Staff and roles couldn't be loaded." onRetry={retry} />;
  if (!data) return null;

  return <StaffEditor initial={data} />;
}

interface RoleChangeTarget {
  staffId: string;
  roleId: string;
}

function StaffEditor({ initial }: Readonly<{ initial: StaffData }>) {
  const toast = useToast();
  const [staff, setStaff] = useState<StaffView[]>(initial.staff);
  const [addOpen, setAddOpen] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [roleChangeTarget, setRoleChangeTarget] = useState<RoleChangeTarget | null>(null);
  const [revokeTargetId, setRevokeTargetId] = useState<string | null>(null);
  const [busyStaffId, setBusyStaffId] = useState<string | null>(null);
  const [issuedPin, setIssuedPin] = useState<IssuedPinView | null>(null);

  const roles = initial.roles;

  async function handleAddStaff(form: AddStaffForm) {
    setAddBusy(true);
    setAddError(null);
    try {
      const created = await createStaff(form);
      setStaff((current) => [...current, created]);
      setAddOpen(false);
      toast({ kind: "success", message: `${staffFullName(created)} was added.` });
    } catch (error) {
      setAddError(error instanceof AdminApiError ? error.message : "Couldn't add this staff member.");
    } finally {
      setAddBusy(false);
    }
  }

  async function handleConfirmRoleChange(reason: string) {
    if (!roleChangeTarget) return;
    const { staffId, roleId } = roleChangeTarget;
    setBusyStaffId(staffId);
    try {
      const updated = await updateStaffRole(staffId, roleId, reason);
      setStaff((current) => current.map((member) => (member.id === staffId ? updated : member)));
      setRoleChangeTarget(null);
      toast({ kind: "success", message: `${staffFullName(updated)}'s role is now ${updated.roleName}.` });
    } catch (error) {
      toast({ kind: "error", message: error instanceof AdminApiError ? error.message : "Couldn't change that role." });
    } finally {
      setBusyStaffId(null);
    }
  }

  async function handleIssuePin(staffId: string) {
    const member = staff.find((m) => m.id === staffId);
    if (!member) return;
    setBusyStaffId(staffId);
    try {
      const issued = await issueStaffPin(staffId);
      setStaff((current) => current.map((m) => (m.id === staffId ? { ...m, pinStatus: "active" } : m)));
      setIssuedPin({ staffId, name: staffFullName(member), pin: issued.pin });
      toast({ kind: "success", message: `PIN issued for ${staffFullName(member)}.` });
    } catch (error) {
      toast({ kind: "error", message: error instanceof AdminApiError ? error.message : "Couldn't issue a PIN." });
    } finally {
      setBusyStaffId(null);
    }
  }

  async function handleConfirmRevoke(reason: string) {
    if (!revokeTargetId) return;
    const staffId = revokeTargetId;
    setBusyStaffId(staffId);
    try {
      const updated = await revokeStaffPin(staffId, reason);
      setStaff((current) => current.map((member) => (member.id === staffId ? updated : member)));
      setRevokeTargetId(null);
      setIssuedPin((current) => (current?.staffId === staffId ? null : current));
      toast({ kind: "success", message: `${staffFullName(updated)} can no longer sign in to the till.` });
    } catch (error) {
      toast({ kind: "error", message: error instanceof AdminApiError ? error.message : "Couldn't revoke that PIN." });
    } finally {
      setBusyStaffId(null);
    }
  }

  const roleChangeMember = roleChangeTarget ? staff.find((m) => m.id === roleChangeTarget.staffId) : undefined;
  const roleChangeRoleName = roleChangeTarget ? roles.find((r) => r.id === roleChangeTarget.roleId)?.name : undefined;
  const revokeMember = revokeTargetId ? staff.find((m) => m.id === revokeTargetId) : undefined;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-semibold">Staff and roles</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="size-4" aria-hidden="true" /> Manage who has access, and to what
          </p>
        </div>
        <Button data-testid="staff-add-open" onClick={() => setAddOpen(true)}>
          <Plus aria-hidden="true" /> Add staff
        </Button>
      </div>

      <StaffTable
        staff={staff}
        roles={roles}
        busyStaffId={busyStaffId}
        issuedPin={issuedPin}
        onRoleSelected={(staffId, roleId) => setRoleChangeTarget({ staffId, roleId })}
        onIssuePin={(staffId) => void handleIssuePin(staffId)}
        onRevokeRequested={(staffId) => setRevokeTargetId(staffId)}
        onDismissIssuedPin={() => setIssuedPin(null)}
      />

      <PermissionMatrix roles={roles} />

      <AddStaffDialog
        open={addOpen}
        roles={roles}
        busy={addBusy}
        error={addError}
        onCancel={() => {
          setAddOpen(false);
          setAddError(null);
        }}
        onSubmit={(form) => void handleAddStaff(form)}
      />

      <ConfirmReasonDialog
        open={roleChangeTarget !== null}
        title="Change this role?"
        description={
          roleChangeMember && roleChangeRoleName
            ? `${staffFullName(roleChangeMember)}'s access will change to what a ${roleChangeRoleName} can do.`
            : ""
        }
        verb="Change role"
        busy={busyStaffId === roleChangeTarget?.staffId}
        onCancel={() => setRoleChangeTarget(null)}
        onConfirm={(reason) => void handleConfirmRoleChange(reason)}
      />

      <ConfirmReasonDialog
        open={revokeTargetId !== null}
        title="Revoke till access?"
        description={revokeMember ? `This removes ${staffFullName(revokeMember)}'s access to the till. They won't be able to sign in with their PIN.` : ""}
        verb="Revoke access"
        busy={busyStaffId === revokeTargetId}
        onCancel={() => setRevokeTargetId(null)}
        onConfirm={(reason) => void handleConfirmRevoke(reason)}
      />
    </div>
  );
}
