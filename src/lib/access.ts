import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const sessionCookie = "vibecollab_session";

function configuredToken() {
  return process.env.VIBECOLLAB_ADMIN_TOKEN?.trim() || null;
}

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function tokensEqual(left: string, right: string) {
  const a = Buffer.from(digest(left), "hex");
  const b = Buffer.from(digest(right), "hex");
  return timingSafeEqual(a, b);
}

export function sessionValue() {
  const token = configuredToken();
  return token ? digest(`vibecollab:${token}`) : null;
}

export function localAccessAllowed() {
  return process.env.NODE_ENV !== "production" && !configuredToken();
}

export async function hasPageAccess() {
  if (localAccessAllowed()) return true;
  const expected = sessionValue();
  const actual = (await cookies()).get(sessionCookie)?.value;
  return Boolean(expected && actual && tokensEqual(expected, actual));
}

export async function requirePageAccess(callbackUrl: string) {
  if (!(await hasPageAccess())) redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
}

export async function hasApiAccess(request: Request) {
  if (localAccessAllowed()) return true;
  const token = configuredToken();
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/iu, "") ?? "";
  if (token && bearer && tokensEqual(token, bearer)) return true;
  const expected = sessionValue();
  const cookieHeader = request.headers.get("cookie") ?? "";
  const actual = cookieHeader
    .split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === sessionCookie)?.[1];
  return Boolean(expected && actual && tokensEqual(expected, decodeURIComponent(actual)));
}

export function validateLoginToken(candidate: string) {
  const token = configuredToken();
  return Boolean(token && tokensEqual(token, candidate));
}
