"use client";

// P12 Close Shift - Blind Count (SPEC CAP-10's success signal; EXPERIENCE.md
// "Closing the shift" key flow). This is the one screen this story's
// server-side-blindness requirement (AD-14) is really about, so the
// enforcement is structural, not a render-order trick:
//
// 1. `useCurrentShift` below fetches `ShiftView` via `getCurrentShift()`.
//    `ShiftView` (api.ts) declares no countedMinor/expectedMinor/
//    overShortMinor field at all - there is no variable anywhere in this
//    component that could hold an expected amount before the count is
//    submitted, because the type it's read from doesn't carry one (even
//    though the real backend's wire payload carries those three keys as
//    null - see api.ts's file header).
// 2. The counted amount lives only in `BlindCountKeypad`'s local digit
//    string, never sent anywhere until `handleSubmit` fires.
// 3. `handleSubmit` calls `closeShift(shiftId, countedMinor)` - the *first
//    and only* network call this screen ever makes that could return a
//    populated expected amount. Its response is `ClosedShift`, stored in
//    `result` state that starts `null` and is set exactly once, inside this
//    call's `.then`.
// 4. Render is a switch on `result`: `result === null` renders
//    BlindCountKeypad (no expected field to show even if it wanted to);
//    `result !== null` renders CloseShiftResult (the immutable reveal).
//
// close-shift-screen.test.tsx asserts this end to end: it inspects every
// mocked fetch response that lands *before* "Submit count" is clicked and
// fails if any of them contains a *populated* expected/overShort value, then
// confirms the reveal only appears after the close call's response arrives.
import { useEffect, useState } from "react";
import { closeShift, getCurrentShift, PosApiError, type ClosedShift, type ShiftView } from "../../../api";
import { LoadErrorPanel, Skeleton } from "../data-states";
import { BlindCountKeypad } from "./blind-count-keypad";
import { CloseShiftResult } from "./close-shift-result";

// The real backend's ShiftView carries no tenant-currency field to read -
// same convention as CAP-4's menu management (menu-management.tsx's
// CURRENCY constant).
const CURRENCY = "INR";

function useCurrentShift(outletId: string) {
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
  };
}

export function CloseShiftScreen({ outletId }: Readonly<{ outletId: string }>) {
  const { loading, failed, shift, retry } = useCurrentShift(outletId);
  const [digits, setDigits] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ClosedShift | null>(null);

  async function handleSubmit(countedMinor: number) {
    if (!shift) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await closeShift(shift.id, countedMinor));
    } catch (submitError) {
      setError(submitError instanceof PosApiError ? submitError.message : "Could not close the shift.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-md space-y-4" data-testid="close-shift-loading">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (failed) {
    return <LoadErrorPanel testId="close-shift-load-error" message="The shift status couldn't be loaded." onRetry={retry} />;
  }

  if (!shift) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p data-testid="close-shift-no-shift" className="text-sm text-muted-foreground">
          There&apos;s no open shift to close.
        </p>
      </div>
    );
  }

  return result ? (
    <CloseShiftResult result={result} currency={CURRENCY} />
  ) : (
    <BlindCountKeypad
      digits={digits}
      onDigitsChange={setDigits}
      busy={busy}
      error={error}
      currency={CURRENCY}
      onSubmit={(countedMinor) => void handleSubmit(countedMinor)}
    />
  );
}
