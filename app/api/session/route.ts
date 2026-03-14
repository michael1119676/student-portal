import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const user = verifySessionToken(token);

  if (!user) {
    return NextResponse.json({ ok: false, user: null }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: student, error } = await supabase
    .from("students")
    .select(`
      korean_subject,
      math_subject,
      science_1,
      science_2,
      target_university
    `)
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({
      ok: true,
      user,
      profile: null,
    });
  }

  return NextResponse.json({
    ok: true,
    user,
    profile: student,
  });
}