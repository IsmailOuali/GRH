import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Pages reachable without being logged in.
const PUBLIC_PREFIXES = ["/login", "/reset-password"];

const authProxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  if (!isLoggedIn) {
    // Unauthenticated users may only reach public pages.
    if (!isPublic) return NextResponse.redirect(new URL("/login", req.url));
    return;
  }

  // Already logged in: keep them out of the login page.
  if (pathname.startsWith("/login")) return NextResponse.redirect(new URL("/dashboard", req.url));

  // Force a one-time password change before anything else. /change-password is
  // exempt (that's where they fix it), and its own submit posts back to itself.
  const mustChange = req.auth?.user?.mustChangePassword;
  if (mustChange && !pathname.startsWith("/change-password")) {
    return NextResponse.redirect(new URL("/change-password", req.url));
  }
});

export function proxy(...args: Parameters<typeof authProxy>) {
  return authProxy(...args);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
