import { redirect } from "next/navigation";

// Landing destination after a successful PIN login. EXPERIENCE.md routes a
// successful login to the Table Map - built in CAP-2, so the story-1
// placeholder that used to live here is gone (issue #92). The QSR counter
// variant (/pos/counter) stays reachable from the table map's top bar.
export default function PosHomePage() {
  redirect("/pos/table-map");
}
