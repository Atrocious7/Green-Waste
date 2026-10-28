import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// Protect routes based on role. Public routes: /, /auth, /api/public

const PUBLIC_PATHS = ["/", "/auth/login", "/auth/register", "/api/auth", "/api/public", "/favicon.ico", "/_next"];

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // get token (JWT)
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  const role = token.user?.role || token.role || null;

  if (pathname.startsWith("/admin") && role !== "admin") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (pathname.startsWith("/business") && role !== "business") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (pathname.startsWith("/dashboard") && role !== "citizen") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/business/:path*", "/dashboard/:path*", "/auth/:path*"],
};
