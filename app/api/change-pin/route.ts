import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { getSessionUserFromCookies, unauthorizedResponse } from "@/lib/api-auth";
import { rejectIfCrossOrigin } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const originError = rejectIfCrossOrigin(request);
  if (originError) return originError;

  const user = await getSessionUserFromCookies();
  if (!user) return unauthorizedResponse();

  if (user.role === "admin") {
    return NextResponse.json(
      { ok: false, message: "관리자 비밀번호는 사이트에서 변경할 수 없습니다." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const newPin = String(body?.newPin || "").trim();

  if (!/^\d{4}$/.test(newPin)) {
    return NextResponse.json(
      { ok: false, message: "비밀번호는 숫자 4자리여야 합니다." },
      { status: 400 }
    );
  }

  const pinHash = await bcrypt.hash(newPin, 10);

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("students")
    .update({
      pin_hash: pinHash,
      must_change_pin: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    console.error("[change-pin] failed to update pin:", error.message);
    return NextResponse.json(
      { ok: false, message: "비밀번호 변경에 실패했습니다." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
