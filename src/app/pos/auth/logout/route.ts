import { NextResponse } from "next/server";
import { POS_SESSION_COOKIE, POS_STAFF_COOKIE } from "@/lib/pos-session";

// restiq-backend's real feature/44-pos-auth-clock contract has no
// /pos/v1/auth/logout (pos JWTs are stateless, nothing server-side to
// invalidate - src/pos/auth/auth.controller.ts only has login and
// select-outlet), so unlike ops/admin's best-effort backend call, this is
// purely local: clear both cookies this realm ever sets.
export async function POST(): Promise<NextResponse> {
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(POS_SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  response.cookies.set(POS_STAFF_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
