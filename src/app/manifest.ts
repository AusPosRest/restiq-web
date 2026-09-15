import type { MetadataRoute } from "next";
import { BRAND_BG } from "./brand-icon";

// Web app manifest (issue #222): what makes Chrome on Android offer "Install
// app", and what iOS 16.4+ reads for standalone display. No service worker on
// purpose - installing no longer needs one, and POS data must never come from
// a stale offline cache.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RESTIQ",
    short_name: "RESTIQ",
    description: "Point of sale for restaurants, burger shops and snack bars",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: BRAND_BG,
    theme_color: BRAND_BG,
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
