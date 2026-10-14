import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE_MAX_AGE,
  AUTH_COOKIE_NAME,
  newSessionPayload,
  signToken,
  verifyToken,
} from "@/lib/auth";

/*
  There is no password. The link opens straight into the demo, because a cold
  lead will not type a code they were given by someone they do not know yet.

  The signed cookie stays, but it is no longer a gate. It is how a visitor's
  voice budget survives a page reload and a serverless restart, so a first
  visitor is simply issued one rather than being asked for anything.
*/

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/robots.txt"
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (await verifyToken(token)) {
    return NextResponse.next();
  }

  // First visit, or a tampered cookie: issue a fresh session with a full budget.
  const res = NextResponse.next();
  res.cookies.set(AUTH_COOKIE_NAME, await signToken(newSessionPayload()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE,
  });
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
