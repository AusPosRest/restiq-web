// Demo staff PIN logins shown on the landing page. PINs are bcrypt-hashed
// server-side and can never be fetched back from the API once issued, so
// this manifest - not the backend - is the source of truth for what a
// tester can type into /pos/login.
//
// ponytail: the orchestrator appends Bay Leaf Kitchens' remaining roles
// (cashier/waiter/manager) here once their PINs are issued on that tenant -
// keep the shape simple, this file is hand-edited rather than generated.
export interface DemoStaffLogin {
  tenant: string;
  name: string;
  role: string;
  pin: string;
  email?: string;
}

export const DEMO_STAFF: DemoStaffLogin[] = [
  { tenant: "Spice Route Hospitality", name: "Priya Nair", role: "Cashier", pin: "1234" },
  { tenant: "Spice Route Hospitality", name: "Arjun Das", role: "Waiter", pin: "5678" },
  { tenant: "Spice Route Hospitality", name: "Ravi Kumar", role: "Manager", pin: "9999" },
  { tenant: "Bay Leaf Kitchens", name: "Kiran Shetty", role: "Kitchen", pin: "9419" },
];
