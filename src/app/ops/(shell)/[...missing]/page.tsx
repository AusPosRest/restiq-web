import { notFound } from "next/navigation";

// Catch-all so unknown /ops paths render the shell's not-found boundary
// instead of falling through to the app's bare 404.
export default function OpsCatchAllPage() {
  notFound();
}
