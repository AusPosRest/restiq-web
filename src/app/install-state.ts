// Which "install the app" hint to show (issue #222). Pure so it's testable
// without a browser.
//   prompt - Chrome/Edge fired beforeinstallprompt (Android, also desktop):
//            one tap on Install opens the browser's own install dialog.
//   ios    - iPhone/iPad: Safari has no install prompt, so show the
//            Share -> Add to Home Screen steps instead.
export type InstallMode = "prompt" | "ios" | null;

export interface InstallEnv {
  standalone: boolean;
  ios: boolean;
  promptReady: boolean;
  dismissed: boolean;
  path: string;
}

export function installMode(env: InstallEnv): InstallMode {
  // Already running as the installed app, or the owner said no. Guest QR
  // pages (/qr/...) are diners' phones, and / is the public marketing page
  // (issue #262) - never ask those visitors to install the POS.
  if (env.standalone || env.dismissed || env.path === "/" || env.path.startsWith("/qr")) return null;
  if (env.ios) return "ios";
  return env.promptReady ? "prompt" : null;
}

/** iPadOS 13+ reports itself as a Mac; the touch points give it away. */
export function isIos(userAgent: string, platform: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1);
}
