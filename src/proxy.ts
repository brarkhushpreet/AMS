import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiAuthPrefix, authRoutes, publicRoutes } from "@/routes";

export default auth((request) => {
  const path = request.nextUrl.pathname;
  const isLoggedIn = Boolean(request.auth);
  const isAuthApi = path.startsWith(apiAuthPrefix);
  const isPublic = publicRoutes.includes(path);
  const isAuthRoute = authRoutes.includes(path);

  if (isAuthApi || isPublic) return NextResponse.next();

  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!isLoggedIn && !isAuthRoute) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("callbackUrl", `${path}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
