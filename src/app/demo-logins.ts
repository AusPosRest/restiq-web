// Demo staff PIN logins shown on the landing page. PINs are bcrypt-hashed
// server-side and can never be fetched back from the API once issued, so
// this manifest - not the backend - is the source of truth for what a
// tester can type into /pos/login.
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
  // Bay Leaf Kitchens - one login per role, PINs issued 2026-09-02.
  { tenant: "Bay Leaf Kitchens", name: "Meera Iyer", role: "Cashier", pin: "0393", email: "meera.iyer@bayleaf.example" },
  { tenant: "Bay Leaf Kitchens", name: "Vamsikrishna ch", role: "Waiter", pin: "0480", email: "thindaam.ai@gmail.com" },
  { tenant: "Bay Leaf Kitchens", name: "Rohan Desai", role: "Manager", pin: "4947", email: "rohan@bayleaf.example" },
  { tenant: "Bay Leaf Kitchens", name: "Kiran Shetty", role: "Kitchen", pin: "6044", email: "kiran@bayleaf.example" },
  { tenant: "Bay Leaf Kitchens", name: "Anita Rao", role: "Owner", pin: "5340", email: "anita.pos@bayleaf.example" },
  { tenant: "Bay Leaf Kitchens", name: "Suresh Nair", role: "Accountant", pin: "1005", email: "suresh@bayleaf.example" },
];
