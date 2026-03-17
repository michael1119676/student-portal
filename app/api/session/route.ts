import { NextResponse } from "next/server";
import { getSessionContextFromCookies } from "@/lib/api-auth";

export async function GET() {
  const { user, profile } = await getSessionContextFromCookies();

  if (!user) {
    return NextResponse.json({ ok: false, user: null }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    user,
    profile,
  });
}
