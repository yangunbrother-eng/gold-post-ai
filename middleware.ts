import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, safeNextPath } from "@/lib/auth";

const PUBLIC_PATHS = new Set(["/login", "/api/login"]);

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const token = process.env.SITE_LOGIN_TOKEN || "";
  if (!token && process.env.NODE_ENV !== "production") return NextResponse.next();
  const authenticated = !!token && request.cookies.get(AUTH_COOKIE)?.value === token;
  if (authenticated) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  const login = new URL("/login", request.url);
  login.searchParams.set("next", safeNextPath(`${pathname}${search}`));
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
