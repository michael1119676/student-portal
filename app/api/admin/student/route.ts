import { NextResponse } from "next/server";
import { getSessionUserFromCookies, unauthorizedResponse } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const user = await getSessionUserFromCookies();
  if (!user || user.role !== "admin") return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId");

  if (!studentId) {
    return NextResponse.json(
      { ok: false, message: "학생 정보가 필요합니다." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data: student, error } = await supabase
    .from("students")
    .select(
      `
      korean_subject,
      math_subject,
      science_1,
      science_2,
      target_university,
      study_year,
      study_place
    `
    )
    .eq("id", studentId)
    .eq("role", "student")
    .maybeSingle();

  if (error || !student) {
    return NextResponse.json(
      { ok: false, message: "학생 정보를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, profile: student });
}
