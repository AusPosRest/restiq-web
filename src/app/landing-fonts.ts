import { Archivo, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";

// Landing page faces (issue #262), in their own module so tests can mock
// next/font. Archivo's width axis gives the headlines a kitchen-signage
// stretch; Plex Mono is the thermal-ticket voice; Hanken is the brand body.
export const display = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-display" });
export const body = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-body" });
export const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono" });
