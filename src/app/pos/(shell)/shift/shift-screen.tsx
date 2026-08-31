"use client";

// P11 Shift & Cash Management (SPEC CAP-10). Nested under the real
// src/app/pos/(shell)/ route group (reconciled with issue #38's real shell -
// see src/lib/pos-session.ts's file header) so it renders inside the
// persistent shift bar rather than a second, standalone header. Five-state
// pattern per EXPERIENCE.md: skeleton while loading, inline retry on
// failure, the open-shift form when there is no shift, the dashboard once
// one is open.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCurrentShift, logCashMovement, openShift, PosApiError, type CashMovementType, type ShiftView } from "../../api";
import { CashMovementLog } from "./cash-movement-log";
import { LoadErrorPanel, Skeleton } from "./data-states";
import { LogMovementDialog } from "./log-movement-dialog";
import { OpenShiftForm } from "./open-shift-form";
import { formatMinor } from "./shift-state";

// The real backend's ShiftView carries no tenant-currency field to read -
// same convention as CAP-4's menu management (menu-management.tsx's
// CURRENCY constant).
const CURRENCY = "INR";

function useShift(outletId: string) {
  const [attempt, setAttempt] = useState(0);
  const [landed, setLanded] = useState<{ attempt: number; shift: ShiftView | null; failed: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCurrentShift(outletId)
      .then((shift) => {
        if (!cancelled) setLanded({ attempt, shift, failed: false });
      })
      .catch(() => {
        if (!cancelled) setLanded({ attempt, shift: null, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, outletId]);

  const current = landed && landed.attempt === attempt ? landed : null;
  return {
    loading: current === null,
    failed: current?.failed ?? false,
    shift: current?.shift ?? null,
    retry: () => setAttempt((n) => n + 1),
    setShift: (shift: ShiftView) => setLanded({ attempt, shift, failed: false }),
  };
}

export function ShiftScreen({ outletId }: Readonly<{ outletId: string }>) {
  const { loading, failed, shift, retry, setShift } = useShift(outletId);
  const [openBusy, setOpenBusy] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [movementOpen, setMovementOpen] = useState(false);
  const [movementBusy, setMovementBusy] = useState(false);
  const [movementError, setMovementError] = useState<string | null>(null);

  async function handleOpenShift(floatMinor: number) {
    setOpenBusy(true);
    setOpenError(null);
    try {
      setShift(await openShift(outletId, floatMinor));
    } catch (error) {
      setOpenError(error instanceof PosApiError ? error.message : "Could not open the shift.");
    } finally {
      setOpenBusy(false);
    }
  }

  async function handleLogMovement(type: CashMovementType, amountMinor: number, reason: string) {
    if (!shift) return;
    setMovementBusy(true);
    setMovementError(null);
    try {
      setShift(await logCashMovement(shift.id, type, amountMinor, reason));
      setMovementOpen(false);
    } catch (error) {
      setMovementError(error instanceof PosApiError ? error.message : "Could not log the movement.");
    } finally {
      setMovementBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="font-headline text-lg font-semibold">Shift &amp; cash management</h1>
        {shift && (
          <Link href="/pos/shift/close" data-testid="close-shift-link">
            <Button variant="secondary">Close shift</Button>
          </Link>
        )}
      </header>

      {loading && (
        <div data-testid="shift-loading" className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40" />
        </div>
      )}

      {!loading && failed && <LoadErrorPanel testId="shift-load-error" message="The shift status couldn't be loaded." onRetry={retry} />}

      {!loading && !failed && !shift && <OpenShiftForm busy={openBusy} error={openError} onOpen={(minor) => void handleOpenShift(minor)} />}

      {!loading && !failed && shift && (
        <div data-testid="shift-dashboard" className="flex flex-1 flex-col gap-6">
          <div className="flex flex-wrap items-center gap-6 rounded-lg border border-border/40 bg-card px-5 py-4">
            <div>
              <p className="text-xs text-muted-foreground">Opened</p>
              <p className="font-semibold">{new Date(shift.openedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Starting float</p>
              <p className="tabular-nums font-semibold" data-testid="shift-opening-float">
                {formatMinor(shift.floatMinor, CURRENCY)}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="font-headline text-lg font-semibold">Cash movements</h2>
            <Button data-testid="log-movement-open" onClick={() => setMovementOpen(true)}>
              Log cash movement
            </Button>
          </div>

          <CashMovementLog movements={shift.cashMovements} currency={CURRENCY} />
        </div>
      )}

      <LogMovementDialog
        open={movementOpen}
        busy={movementBusy}
        error={movementError}
        onCancel={() => {
          setMovementOpen(false);
          setMovementError(null);
        }}
        onSubmit={(type, amountMinor, reason) => void handleLogMovement(type, amountMinor, reason)}
      />
    </div>
  );
}
