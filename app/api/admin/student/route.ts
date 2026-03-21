import { NextResponse } from "next/server";
import { getSessionUserFromCookies, unauthorizedResponse } from "@/lib/api-auth";
import { rejectIfCrossOrigin } from "@/lib/security";
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
      id,
      name,
      phone,
      class_name,
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
    .eq("is_deleted", false)
    .maybeSingle();

  if (error || !student) {
    return NextResponse.json(
      { ok: false, message: "학생 정보를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    profile: student,
    student: {
      id: student.id,
      name: student.name,
      phone: student.phone,
      className: student.class_name,
    },
  });
}

export async function DELETE(request: Request) {
  const originError = rejectIfCrossOrigin(request);
  if (originError) return originError;

  const user = await getSessionUserFromCookies();
  if (!user || user.role !== "admin") return unauthorizedResponse();

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    body =
      typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {};
  } catch {
    return NextResponse.json(
      { ok: false, message: "요청 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const studentId = String(body.studentId || "").trim();
  if (!studentId) {
    return NextResponse.json(
      { ok: false, message: "학생 정보가 필요합니다." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data: existing, error: fetchError } = await supabase
    .from("students")
    .select("id, name, phone, role, class_name, is_deleted")
    .eq("id", studentId)
    .maybeSingle();

  if (fetchError || !existing || existing.role !== "student" || existing.is_deleted) {
    return NextResponse.json(
      { ok: false, message: "삭제할 학생 정보를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const { error: deleteError } = await supabase
    .from("students")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", studentId)
    .eq("role", "student");

  if (deleteError) {
    console.error("[admin/student] failed to soft-delete student:", deleteError.message);
    return NextResponse.json(
      { ok: false, message: "학생 삭제에 실패했습니다." },
      { status: 500 }
    );
  }

  await supabase.from("admin_action_logs").insert({
    admin_id: user.id,
    action_type: "student_delete",
    target_student_id: existing.id,
    reason: "관리자 학생 계정 삭제 처리",
    before_data: {
      studentId: existing.id,
      name: existing.name,
      phone: existing.phone,
      className: existing.class_name,
    },
    after_data: {
      isDeleted: true,
    },
  });

  return NextResponse.json({
    ok: true,
    deletedStudentId: existing.id,
    message: `${existing.name} 학생 계정을 삭제 처리했습니다. 기존 성적/기록은 유지됩니다.`,
  });
}
