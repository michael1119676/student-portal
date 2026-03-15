import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, SessionUser, verifySessionToken } from "@/lib/session";

export async function getSessionUserFromCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const user = verifySessionToken(token);
  return user;
}

export function unauthorizedResponse() {
  return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
}

export function requireAdmin(user: SessionUser | null) {
  if (!user || user.role !== "admin") {
    return unauthorizedResponse();
  }
  return null;
}

