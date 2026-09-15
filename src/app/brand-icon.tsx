import { ImageResponse } from "next/og";

// The home-screen icon (issue #222), drawn at request time so the repo carries
// no PNGs. Amber "R" on the landing page's dark ground. The letter sits well
// inside the middle 80% so Android's maskable crop never clips it.
export const BRAND_BG = "#131315";
const BRAND_AMBER = "#f59e0b";

export function brandIcon(px: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND_BG,
          color: BRAND_AMBER,
          fontSize: px * 0.5,
          fontWeight: 700,
        }}
      >
        R
      </div>
    ),
    { width: px, height: px },
  );
}
