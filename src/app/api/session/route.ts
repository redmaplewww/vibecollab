import { NextResponse } from "next/server";
import { sessionCookie, sessionValue, validateLoginToken } from "@/lib/access";

export async function POST(request: Request) {
  const form = await request.formData();
  const token = String(form.get("token") ?? "");
  const callback = String(form.get("callbackUrl") ?? "/");
  const destination = callback.startsWith("/") && !callback.startsWith("//") ? callback : "/";
  if (!validateLoginToken(token))
    return NextResponse.redirect(
      new URL(`/login?error=1&callbackUrl=${encodeURIComponent(destination)}`, request.url),
      303,
    );
  const value = sessionValue();
  if (!value) return NextResponse.redirect(new URL("/login?error=1", request.url), 303);
  const response = NextResponse.redirect(new URL(destination, request.url), 303);
  response.cookies.set(sessionCookie, value, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
