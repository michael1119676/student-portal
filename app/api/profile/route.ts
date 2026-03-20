import { NextResponse } from "next/server";
import { getSessionUserFromCookies, unauthorizedResponse } from "@/lib/api-auth";
import {
  normalizeStudyPlace,
  normalizeStudyYear,
} from "@/lib/student-profile-options";
import { rejectIfCrossOrigin } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const originError = rejectIfCrossOrigin(request);
  if (originError) return originError;

  const user = await getSessionUserFromCookies();
  if (!user) return unauthorizedResponse();

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
    study_year: normalizeStudyYear(body.studyYear),
    study_place: normalizeStudyPlace(body.studyPlace),
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
