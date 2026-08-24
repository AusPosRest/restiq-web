import { redirect } from "next/navigation";

// /admin/settings has no content of its own - Branding is the default tab.
export default function AdminSettingsIndexPage() {
  redirect("/admin/settings/branding");
}
