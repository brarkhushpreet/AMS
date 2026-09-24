import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import authConfig from "@/lib/auth.config";
import { demoBlocksRequest, demoEnabled, DEMO_READ_ONLY_MESSAGE, isDemoUser } from "@/lib/demo-policy";
import {
  apiAuthPrefix,
  authRoutes,
  publicRoutePrefixes,
  publicRoutes,
} from "@/routes";

const { auth } = NextAuth(authConfig);

export default auth((request) => {
  const path = request.nextUrl.pathname;
  const isLoggedIn = Boolean(request.auth);
  const isAuthApi = path === apiAuthPrefix || path.startsWith(`${apiAuthPrefix}/`);
  const isPublic =
    publicRoutes.includes(path) ||
    publicRoutePrefixes.some((prefix) => path.startsWith(prefix));
  const isAuthRoute = authRoutes.includes(path);

  if (isDemoUser(request.auth?.user?.id) && !isAuthApi) {
    if (!demoEnabled()) {
      if (path.startsWith("/api/")) return NextResponse.json({ error: "Demo access is disabled." }, { status: 403 });
      if (!isPublic && !isAuthRoute) return NextResponse.redirect(new URL("/auth/login", request.url));
      return NextResponse.next();
    }
    if (demoBlocksRequest(path, request.method)) {
      return NextResponse.json({ error: DEMO_READ_ONLY_MESSAGE }, { status: 403 });
    }
  }

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
  matcher: ["/api/:path*", "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
