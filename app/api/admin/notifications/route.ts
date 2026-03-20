import { NextResponse } from "next/server";
import {
  getSessionUserFromCookies,
  requireAdmin,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { createPortalNotification } from "@/lib/notifications";
import { rejectIfCrossOrigin } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_AUDIENCES = new Set(["all", "students", "admins", "single"]);

export async function POST(request: Request) {
  const originError = rejectIfCrossOrigin(request);
  if (originError) return originError;

  const user = await getSessionUserFromCookies();
  if (!user) return unauthorizedResponse();

  const adminError = requireAdmin(user);
  if (adminError) return adminError;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, message: "요청 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const title = String(body.title || "").trim();
  const message = String(body.body || "").trim();
  const audience = String(body.audience || "all").trim().toLowerCase();
  const isImportant = body.isImportant === true;
  const targetStudentId = String(body.targetStudentId || "").trim();

  if (!title || !message) {
    return NextResponse.json(
      { ok: false, message: "공지 제목과 내용을 모두 입력해 주세요." },
      { status: 400 }
    );
  }

  if (!ALLOWED_AUDIENCES.has(audience)) {
    return NextResponse.json(
      { ok: false, message: "공지 대상이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  if (audience === "single") {
    if (!targetStudentId) {
      return NextResponse.json(
        { ok: false, message: "알림을 보낼 학생을 선택해 주세요." },
        { status: 400 }
      );
    }

    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id")
      .eq("id", targetStudentId)
      .eq("role", "student")
      .maybeSingle();

    if (studentError || !student) {
      return NextResponse.json(
        { ok: false, message: "대상 학생을 찾을 수 없습니다." },
        { status: 404 }
      );
    }
  }

  const { error } = await createPortalNotification(supabase, {
    type: "announcement",
    audience: audience as "all" | "students" | "admins" | "single",
    targetUserId: audience === "single" ? targetStudentId : null,
    title: title.slice(0, 120),
    body: message.slice(0, 4000),
    isImportant,
    relatedPath: "/",
    createdBy: user.id,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, message: `공지 등록 실패: ${error.message}` },
      { status: 500 }
    );
  }

  await supabase.from("admin_action_logs").insert({
    admin_id: user.id,
    action_type: "portal_announcement_create",
    reason: `공지 등록: ${title.slice(0, 60)}`,
    before_data: null,
      after_data: {
        title: title.slice(0, 120),
        body: message.slice(0, 4000),
        audience,
        targetStudentId: audience === "single" ? targetStudentId : null,
        isImportant,
      },
    created_at: new Date().toISOString(),
  });

  return NextResponse.json({
    ok: true,
    message: "공지를 등록했습니다.",
  });
}
