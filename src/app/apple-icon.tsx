import { brandIcon } from "./brand-icon";

// iOS "Add to Home Screen" icon (issue #222): Safari ignores the manifest icons
// and reads <link rel="apple-touch-icon">, which Next emits for this file.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return brandIcon(size.width);
}
