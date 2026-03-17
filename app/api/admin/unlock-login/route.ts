import { NextResponse } from "next/server";
import { getSessionUserFromCookies, unauthorizedResponse } from "@/lib/api-auth";
import {
  buildAccountGuardKey,
  unlockLoginGuardByAdmin,
} from "@/lib/login-guard";
import { getClientIp, rejectIfCrossOrigin } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
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

  const studentId = String(body?.studentId || "").trim();
  if (!studentId) {
    return NextResponse.json(
      { ok: false, message: "학생 정보가 필요합니다." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data: student, error } = await supabase
    .from("students")
    .select("id, name, phone, role")
    .eq("id", studentId)
    .eq("role", "student")
    .maybeSingle();

  if (error || !student) {
    return NextResponse.json(
      { ok: false, message: "학생 정보를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  try {
    const accountKey = buildAccountGuardKey(student.name, student.phone);
    const { unlockedRows } = await unlockLoginGuardByAdmin(supabase, {
      studentId: student.id,
      accountKey,
      adminId: user.id,
      adminIp: getClientIp(request),
    });

    return NextResponse.json({
      ok: true,
      unlockedRows,
      message: "로그인 잠금/IP 제한을 해제했습니다.",
    });
  } catch (unlockError) {
    console.error("[admin/unlock-login] failed to unlock login guard:", unlockError);
    return NextResponse.json(
      { ok: false, message: "로그인 잠금 해제에 실패했습니다." },
      { status: 500 }
    );
  }
}
