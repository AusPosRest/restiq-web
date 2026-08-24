// Dashboard (O2) lands with the tenant-directory story; this placeholder is
// the post-login destination so the shell has a home.
export default function OpsDashboardPage() {
  return (
    <section>
      <h1 className="font-headline text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Fleet KPIs, sync-lag alerts and recent onboardings arrive with the next stories.
      </p>
    </section>
  );
}
