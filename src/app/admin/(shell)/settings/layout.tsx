import { SettingsTabs } from "./settings-tabs";

// T10 Settings shell: header + Branding/Capabilities tabs, shared by both
// sub-routes so the tab strip persists across navigation between them.
export default function AdminSettingsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex flex-1 flex-col" data-testid="admin-settings">
      <h1 className="font-headline text-2xl font-semibold">Settings</h1>
      <div className="mt-4">
        <SettingsTabs />
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
