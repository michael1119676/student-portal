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
  if (!user || user.role !== "admin") return unauthorizedResponse();

  const body = await request.json();
  const studentId = String(body?.studentId || "").trim();

  if (!studentId) {
    return NextResponse.json(
      { ok: false, message: "학생 정보가 필요합니다." },
      { status: 400 }
    );
  }

  const payload = {
    korean_subject: body.koreanSubject ?? null,
    math_subject: body.mathSubject ?? null,
    science_1: body.science1 ?? null,
    science_2: body.science2 ?? null,
    target_university: body.targetUniversity ?? "seoul",
    study_year: normalizeStudyYear(body.studyYear),
    study_place: normalizeStudyPlace(body.studyPlace),
    class_name: String(body.className || "").trim() || null,
    updated_at: new Date().toISOString(),
  };

  const supabase = createAdminClient();
  const { data: previousStudent } = await supabase
    .from("students")
    .select("id, name, phone, class_name")
    .eq("id", studentId)
    .eq("role", "student")
    .eq("is_deleted", false)
    .maybeSingle();

  const { data: updatedStudent, error } = await supabase
    .from("students")
    .update(payload)
    .eq("id", studentId)
    .eq("role", "student")
    .eq("is_deleted", false)
    .select("id, name, phone, class_name")
    .maybeSingle();

  if (error || !updatedStudent) {
    console.error(
      "[admin/student-profile] failed to update profile:",
      error?.message || "unknown"
    );
    return NextResponse.json(
      { ok: false, message: "학생 정보 저장에 실패했습니다." },
      { status: 500 }
    );
  }

  await supabase.from("admin_action_logs").insert({
    admin_id: user.id,
    action_type: "student_profile_update",
    target_student_id: studentId,
    reason: "관리자 학생 정보 수정",
    before_data: previousStudent
      ? {
          className: previousStudent.class_name,
        }
      : null,
    after_data: {
      className: updatedStudent.class_name,
      studyYear: payload.study_year,
      studyPlace: payload.study_place,
      targetUniversity: payload.target_university,
    },
  });

  return NextResponse.json({
    ok: true,
    student: {
      id: updatedStudent.id,
      name: updatedStudent.name,
      phone: updatedStudent.phone,
      role: "student",
      className: updatedStudent.class_name,
    },
  });
}
