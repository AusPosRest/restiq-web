// restiq-web#346 (PE-30): /demo and /simulator are for local testing and demo stacks only. A production
// build answers 404 for them unless the deployment opts in with DEMO_PAGES=on (the demo stack does).
export function demoPagesEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.DEMO_PAGES === "on";
}
