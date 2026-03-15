import { NextResponse } from "next/server";
import {
  getSessionUserFromCookies,
  requireAdmin,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { rejectIfCrossOrigin } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";

type CoinAdjustRpcResult = {
  ok: boolean;
  message: string;
  coin_before: number | null;
  coin_after: number | null;
};

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

  const studentId = String(body.studentId || "").trim();
  const delta = Number(body.delta);
  const reason = String(body.reason || "").trim();

  if (!studentId || !Number.isFinite(delta)) {
    return NextResponse.json(
      { ok: false, message: "학생/증감 수량을 확인해 주세요." },
      { status: 400 }
    );
  }

  const safeDelta = Math.round(delta);
  if (safeDelta === 0) {
    return NextResponse.json(
      { ok: false, message: "조정 수량은 0이 될 수 없습니다." },
      { status: 400 }
    );
  }

  if (!reason) {
    return NextResponse.json(
      { ok: false, message: "사유를 입력해 주세요." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("shop_admin_adjust_coin", {
    p_admin_id: user.id,
    p_student_id: studentId,
    p_delta: safeDelta,
    p_reason: reason,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, message: `코인 조정 실패: ${error.message}` },
      { status: 500 }
    );
  }

  const row = (Array.isArray(data) ? data[0] : data) as CoinAdjustRpcResult | undefined;
  if (!row || !row.ok) {
    return NextResponse.json(
      { ok: false, message: row?.message || "코인 조정에 실패했습니다." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: row.message,
    coinBefore: row.coin_before,
    coinAfter: row.coin_after,
  });
}

