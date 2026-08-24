"use client";

// Owner console toasts (EXPERIENCE.md): top-right, aria-live polite. Success
// auto-dismisses; failures persist until dismissed and can carry a retry
// affordance. Same pattern as /ops's toast.tsx, restyled to the admin realm's
// status vocabulary (status-active/status-error, not healthy/critical).
import { RotateCcw, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const SUCCESS_DISMISS_MS = 5000;

export interface ToastInput {
  kind: "success" | "error";
  message: string;
  onRetry?: () => void;
}

interface ToastEntry extends ToastInput {
  id: number;
}

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

export function useToast(): (toast: ToastInput) => void {
  const push = useContext(ToastContext);
  if (!push) throw new Error("useToast must be used inside ToastProvider");
  return push;
}

export function ToastProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (toast: ToastInput) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { ...toast, id }]);
      if (toast.kind === "success") setTimeout(() => dismiss(id), SUCCESS_DISMISS_MS);
    },
    [dismiss],
  );

  const region = useMemo(
    () => (
      <div aria-live="polite" className="fixed right-4 top-4 z-50 flex w-80 flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            data-testid={`toast-${toast.kind}`}
            className={`flex items-start gap-3 rounded-lg border bg-popover p-3 text-sm shadow-lg ${
              toast.kind === "error" ? "border-status-error/60" : "border-status-active/60"
            }`}
          >
            <span
              aria-hidden="true"
              className={`mt-1 size-2 shrink-0 rounded-full ${toast.kind === "error" ? "bg-status-error" : "bg-status-active"}`}
            />
            <p className="flex-1">{toast.message}</p>
            {toast.onRetry && (
              <button
                type="button"
                data-testid="toast-retry"
                onClick={() => {
                  dismiss(toast.id);
                  toast.onRetry?.();
                }}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-primary hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <RotateCcw className="size-3" aria-hidden="true" /> Retry
              </button>
            )}
            <button
              type="button"
              aria-label="Dismiss notification"
              data-testid="toast-dismiss"
              onClick={() => dismiss(toast.id)}
              className="rounded-md p-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    ),
    [toasts, dismiss],
  );

  return (
    <ToastContext.Provider value={push}>
      {children}
      {region}
    </ToastContext.Provider>
  );
}
