"use client";

// Device topology (issue #210 / restiq-backend#134): every POS-realm tab that
// knows which enrolled device it is (POS, printer, card terminal) reports in
// every 30 s, so the owner's Devices topology can show it online. Failures
// (the PIN pad before sign-in, a dropped connection) are ignored - the next
// beat simply tries again.
import { useEffect } from "react";
import { sendDeviceHeartbeat, tabDeviceId } from "./api";

export const HEARTBEAT_MS = 30_000;

export function DeviceHeartbeat() {
  useEffect(() => {
    function beat() {
      const deviceId = tabDeviceId();
      if (deviceId) sendDeviceHeartbeat(deviceId).catch(() => undefined);
    }
    beat();
    const id = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, []);

  return null;
}
