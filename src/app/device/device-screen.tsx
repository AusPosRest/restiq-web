"use client";

// The /device screen's whole state machine (issue #99): no stored identity ->
// enrolment form; a stored device -> its card. Mirrors pin-pad.tsx's
// fetch/error-shape conventions exactly (this route handler passes the
// backend's own {code, message} error body straight through, unwrapped,
// while this route's own synthesized errors - validation/misconfigured/
// upstream_unreachable - nest under `error`; read either shape).
//
// The read of localStorage is deferred to an effect (not the initial
// useState) so the server-rendered HTML and the client's first hydration
// pass agree on the same "loading" shell - same reason kds-entry.tsx gates
// its own localStorage read behind an always-null first render.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearStoredDevice,
  continueTargetFor,
  formatCodeInput,
  getOrCreateFingerprint,
  humanizeStatus,
  humanizeType,
  isCodeComplete,
  readStoredDevice,
  writeStoredDevice,
  type DeviceView,
} from "./device-state";

interface ErrorBody {
  code?: string;
  message?: string;
  error?: { code?: string; message?: string };
}

// Honest, specific copy per restiq-backend error code (src/ops/devices/
// devices.service.ts#enrollWithActor) - no generic "something went wrong"
// when the reason is known.
const ERROR_COPY: Record<string, string> = {
  code_invalid: "That code isn't valid. Check it and try again.",
  code_expired: "This code has expired. Ask for a fresh one.",
  code_already_used: "This code has already been used - each code works once. Generate a new one in the console.",
};

function errorMessage(body: ErrorBody, fallback: string): string {
  const code = body.error?.code ?? body.code;
  if (code && ERROR_COPY[code]) return ERROR_COPY[code];
  return body.error?.message ?? body.message ?? fallback;
}

type ScreenState =
  | { step: "loading" }
  | { step: "enrol"; code: string; label: string; error: string | null }
  | { step: "enrolled"; device: DeviceView };

const INITIAL_ENROL_STATE: ScreenState = { step: "enrol", code: "", label: "", error: null };

async function submitEnrol(code: string, label: string): Promise<{ device: DeviceView } | { errorBody: ErrorBody }> {
  const trimmedLabel = label.trim();
  const res = await fetch("/device/api/enroll", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      code,
      hardwareKeyFingerprint: getOrCreateFingerprint(),
      ...(trimmedLabel ? { label: trimmedLabel } : {}),
    }),
  });
  const body = (await res.json().catch(() => ({}))) as ErrorBody & { device?: DeviceView };
  if (res.ok && body.device) return { device: body.device };
  return { errorBody: body };
}

export function DeviceScreen() {
  const router = useRouter();
  const [state, setState] = useState<ScreenState>({ step: "loading" });
  const [pending, setPending] = useState(false);

  useEffect(() => {
    // Deferred, not called synchronously in the effect body
    // (react-hooks/set-state-in-effect) - same convention live-clock.tsx
    // documents, one tick is imperceptible here.
    const timeout = setTimeout(() => {
      const stored = readStoredDevice();
      setState(stored ? { step: "enrolled", device: stored } : INITIAL_ENROL_STATE);
    }, 0);
    return () => clearTimeout(timeout);
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (state.step !== "enrol" || pending || !isCodeComplete(state.code)) return;
    setPending(true);
    const result = await submitEnrol(state.code, state.label);
    setPending(false);
    if ("device" in result) {
      writeStoredDevice(result.device);
      setState({ step: "enrolled", device: result.device });
      return;
    }
    setState({ ...state, error: errorMessage(result.errorBody, "Enrolment failed. Check your connection and try again.") });
  }

  function handleUnenrol() {
    clearStoredDevice();
    setState(INITIAL_ENROL_STATE);
  }

  function handleContinue(device: DeviceView) {
    const target = continueTargetFor(device.type);
    if (target.kind === "redirect") router.push(target.path);
  }

  if (state.step === "loading") return null;

  return (
    <main className="flex min-h-screen flex-1">
      <section className="hidden flex-1 flex-col justify-between p-12 lg:flex" aria-hidden="true">
        <p className="font-headline text-5xl font-bold tracking-tight text-primary">RESTIQ</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Turn this browser tab into a POS, KDS, kiosk, or customer-display terminal by redeeming a one-time enrolment code
          from the console.
        </p>
        <p className="text-xs text-muted-foreground">App Version v2.4.1</p>
      </section>

      <section className="flex flex-1 flex-col justify-center bg-card px-6 py-12 sm:px-16 lg:max-w-[36rem]">
        <div className="mx-auto w-full max-w-sm">
          {state.step === "enrol" ? (
            <EnrolForm state={state} pending={pending} onChange={setState} onSubmit={handleSubmit} />
          ) : (
            <DeviceCard device={state.device} onContinue={handleContinue} onUnenrol={handleUnenrol} />
          )}
        </div>
      </section>
    </main>
  );
}

function EnrolForm({
  state,
  pending,
  onChange,
  onSubmit,
}: Readonly<{
  state: Extract<ScreenState, { step: "enrol" }>;
  pending: boolean;
  onChange: (state: ScreenState) => void;
  onSubmit: (event: React.FormEvent) => void;
}>) {
  return (
    <form data-testid="device-enrol-form" onSubmit={onSubmit}>
      <h1 className="font-headline text-xl font-semibold text-foreground">Enrol this device</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter the one-time code shown in the console to turn this browser into a RESTIQ terminal.
      </p>

      <label htmlFor="device-code" className="mt-6 block text-sm font-medium text-foreground">
        Enrolment code
      </label>
      <input
        id="device-code"
        data-testid="device-code-input"
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCapitalize="characters"
        placeholder="ABC-123"
        maxLength={7}
        value={state.code}
        disabled={pending}
        onChange={(event) => onChange({ ...state, code: formatCodeInput(event.target.value), error: null })}
        className="mt-1 w-full rounded-lg border border-border bg-input px-4 py-3 text-center font-mono text-lg tracking-widest text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      />

      <label htmlFor="device-label" className="mt-4 block text-sm font-medium text-foreground">
        Device label <span className="font-normal text-muted-foreground">(optional)</span>
      </label>
      <input
        id="device-label"
        data-testid="device-label-input"
        type="text"
        maxLength={100}
        placeholder="e.g. Front Counter 1"
        value={state.label}
        disabled={pending}
        onChange={(event) => onChange({ ...state, label: event.target.value })}
        className="mt-1 w-full rounded-lg border border-border bg-input px-4 py-3 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      />

      {state.error ? (
        <p role="alert" data-testid="device-enrol-error" className="mt-4 text-sm text-error-soft">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        data-testid="device-enrol-submit"
        disabled={pending || !isCodeComplete(state.code)}
        className="mt-6 w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        {pending ? "Enrolling…" : "Enrol"}
      </button>
    </form>
  );
}

function DeviceCard({
  device,
  onContinue,
  onUnenrol,
}: Readonly<{
  device: DeviceView;
  onContinue: (device: DeviceView) => void;
  onUnenrol: () => void;
}>) {
  const target = continueTargetFor(device.type);

  return (
    <div data-testid="device-card">
      <h1 className="font-headline text-xl font-semibold text-foreground">This browser is enrolled</h1>

      <div className="mt-6 rounded-lg border border-border bg-background p-5">
        <p data-testid="device-card-label" className="text-lg font-semibold text-foreground">
          {device.label}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Type</dt>
          <dd data-testid="device-card-type" className="text-right text-foreground">
            {humanizeType(device.type)}
          </dd>
          <dt className="text-muted-foreground">Outlet</dt>
          <dd data-testid="device-card-outlet" className="text-right text-foreground">
            {device.outletId ?? "Not yet assigned"}
          </dd>
          <dt className="text-muted-foreground">Enrolled</dt>
          <dd data-testid="device-card-enrolled-at" className="text-right text-foreground">
            {new Date(device.enrolledAt).toLocaleString()}
          </dd>
          <dt className="text-muted-foreground">Status</dt>
          <dd data-testid="device-card-status" className="text-right text-foreground">
            {humanizeStatus(device.status)}
          </dd>
        </dl>
      </div>

      {target.kind === "redirect" ? (
        <button
          type="button"
          data-testid="device-continue"
          onClick={() => onContinue(device)}
          className="mt-6 w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Continue
        </button>
      ) : (
        <p data-testid="device-continue-unsupported" className="mt-6 text-sm text-muted-foreground">
          This device type has no web surface yet.
        </p>
      )}

      <button
        type="button"
        data-testid="device-unenrol"
        onClick={onUnenrol}
        className="mt-4 w-full rounded-lg border border-border bg-transparent px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Un-enrol this browser
      </button>
      <p data-testid="device-unenrol-note" className="mt-2 text-xs text-muted-foreground">
        This only clears this browser&apos;s stored identity - it doesn&apos;t revoke the device. Revoking access is an
        ops/admin job.
      </p>
    </div>
  );
}
