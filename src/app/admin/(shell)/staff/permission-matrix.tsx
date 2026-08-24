// Role permission matrix (T7): read-only reference - roles are seeded, not
// editable here (EXPERIENCE.md T7 pattern). Sourced from the static
// SYSTEM_ROLE_PERMISSIONS reference in staff-state.ts, not from `roles`
// prop's own fields, because GET /admin/v1/roles returns only {id, name,
// isSystem} with no permission metadata to render - see staff-state.ts's
// file header for why.
import { Check, X } from "lucide-react";
import { ROLE_PERMISSION_CATALOG, roleHasPermission, type RoleView } from "./staff-state";

export function PermissionMatrix({ roles }: Readonly<{ roles: readonly RoleView[] }>) {
  return (
    <div className="rounded-lg border border-border/40 bg-card">
      <div className="border-b border-border/40 px-5 py-4">
        <h2 className="font-headline text-base font-semibold">What each role can do</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">A reference only - roles are fixed and can&apos;t be edited here.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="permission-matrix">
          <thead>
            <tr className="h-11 border-b border-border/40">
              <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Permission</th>
              {roles.map((role) => (
                <th key={role.id} className="font-label px-4 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {role.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLE_PERMISSION_CATALOG.map((permission) => (
              <tr key={permission.key} data-testid={`permission-row-${permission.key}`} className="h-11 border-b border-border/20 last:border-b-0">
                <td className="px-4">{permission.label}</td>
                {roles.map((role) => {
                  const granted = roleHasPermission(role.name, permission.key);
                  return (
                    <td key={role.id} className="px-4 text-center" data-testid={`permission-cell-${permission.key}-${role.id}`}>
                      {granted ? (
                        <span className="inline-flex items-center gap-1 text-status-active">
                          <Check className="size-3.5" aria-hidden="true" />
                          <span className="sr-only">Can {permission.label.toLowerCase()}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-muted-foreground/50">
                          <X className="size-3.5" aria-hidden="true" />
                          <span className="sr-only">Cannot {permission.label.toLowerCase()}</span>
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
