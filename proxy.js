import {NextResponse} from "next/server";
import {updateSession} from "./lib/supabase/proxy";

export async function proxy(request) {
  const response = await updateSession(request);
  if (request.nextUrl.pathname.startsWith("/login") || request.nextUrl.pathname.startsWith("/auth")) {
    return response;
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
