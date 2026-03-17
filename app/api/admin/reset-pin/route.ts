import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { getSessionUserFromCookies, unauthorizedResponse } from "@/lib/api-auth";
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

  const pinHash = await bcrypt.hash("1111", 10);

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("students")
    .update({
      pin_hash: pinHash,
      must_change_pin: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", studentId)
    .eq("role", "student");

  if (error) {
    console.error("[admin/reset-pin] failed to reset pin:", error.message);
    return NextResponse.json(
      { ok: false, message: "비밀번호 초기화에 실패했습니다." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
