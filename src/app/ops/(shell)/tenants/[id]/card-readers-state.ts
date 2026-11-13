// Payments tab > Card readers (restiq-web#429): the Register reader form -> POST body.
// The address is asked for only after the API says the outlet has no Stripe location yet.

export const SIMULATED_CODE = "simulated-wpe";

export interface RegisterForm {
  outletId: string;
  label: string;
  registrationCode: string;
  simulated: boolean;
  needsAddress: boolean;
  line1: string;
  city: string;
  state: string;
  postcode: string;
}

export interface RegisterBody {
  outletId: string;
  label: string;
  registrationCode: string;
  address?: { line1: string; city: string; state: string; postcode: string };
}

export function emptyRegisterForm(outletId: string): RegisterForm {
  return { outletId, label: "", registrationCode: "", simulated: false, needsAddress: false, line1: "", city: "", state: "", postcode: "" };
}

export function validateRegisterForm(form: RegisterForm): RegisterBody | { error: string } {
  const label = form.label.trim();
  const registrationCode = form.simulated ? SIMULATED_CODE : form.registrationCode.trim();
  if (!form.outletId) return { error: "Choose the outlet the reader is for." };
  if (!label) return { error: "Give the reader a name staff will recognise, e.g. Counter 1." };
  if (!registrationCode) return { error: "Enter the pairing code shown on the reader." };
  const body: RegisterBody = { outletId: form.outletId, label, registrationCode };
  if (!form.needsAddress) return body;
  const address = { line1: form.line1.trim(), city: form.city.trim(), state: form.state.trim(), postcode: form.postcode.trim() };
  if (Object.values(address).some((v) => !v)) return { error: "Fill in the outlet's street, city, state and postcode." };
  return { ...body, address };
}
