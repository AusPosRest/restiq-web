import { brandIcon } from "./brand-icon";

// Android / Chrome need a 192 and a 512 icon to offer "Install app" (issue #222).
// Served at /icon/192 and /icon/512; manifest.ts points at them.
export function generateImageMetadata() {
  return [192, 512].map((px) => ({ id: String(px), size: { width: px, height: px }, contentType: "image/png" }));
}

export default async function Icon({ id }: Readonly<{ id: Promise<string | number> }>) {
  return brandIcon(Number(await id));
}
