import bcrypt from "bcrypt";
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

  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

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
