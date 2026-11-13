import { redirect } from "next/navigation";

// /admin/settings has no content of its own - Outlet is the default tab.
export default function AdminSettingsIndexPage() {
  redirect("/admin/settings/outlet");
}
