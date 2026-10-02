import { NextRequest, NextResponse } from "next/server";

const sessionCookie = /^(?:__Secure-)?authjs\.session-token(?:\.\d+)?$/;

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return new Response(null, { status: 403 });
  }

  const response = NextResponse.redirect(new URL("/", request.url), 303);
  const names = new Set([
    "authjs.session-token",
    "__Secure-authjs.session-token",
    ...request.cookies.getAll().map(({ name }) => name).filter((name) => sessionCookie.test(name)),
  ]);

  for (const name of names) {
    response.cookies.set(name, "", {
      expires: new Date(0),
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
    });
  }

  return response;
}
