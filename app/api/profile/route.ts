import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { rejectIfCrossOrigin } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

export async function POST(request: Request) {
  const originError = rejectIfCrossOrigin(request);
  if (originError) return originError;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const user = verifySessionToken(token);

  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  if (user.role === "admin") {
    return NextResponse.json(
      { ok: false, message: "관리자 정보는 사이트에서 변경할 수 없습니다." },
      { status: 403 }
    );
  }

  const body = await request.json();

  const payload = {
    korean_subject: body.koreanSubject ?? null,
    math_subject: body.mathSubject ?? null,
    science_1: body.science1 ?? null,
    science_2: body.science2 ?? null,
    target_university: body.targetUniversity ?? "seoul",
    updated_at: new Date().toISOString(),
  };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("students")
    .update(payload)
    .eq("id", user.id);

  if (error) {
    console.error("[profile] failed to update profile:", error.message);
    return NextResponse.json(
      { ok: false, message: "프로필 저장에 실패했습니다." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
