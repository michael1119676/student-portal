import { NextResponse } from "next/server";
import {
  getSessionUserFromCookies,
  requireAdmin,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { rejectIfCrossOrigin } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";

type DeliveryStatusRpcResult = {
  ok: boolean;
  message: string;
  delivery_completed: boolean | null;
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

  const drawLogId = Number(body.drawLogId);
  const deliveryCompleted = body.deliveryCompleted === true;

  if (!Number.isFinite(drawLogId) || drawLogId <= 0) {
    return NextResponse.json(
      { ok: false, message: "당첨 로그 정보가 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("shop_admin_set_delivery_status", {
    p_admin_id: user.id,
    p_draw_log_id: Math.round(drawLogId),
    p_delivery_completed: deliveryCompleted,
  });

  if (error) {
    const fallback = error.message.includes("shop_admin_set_delivery_status")
      ? "지급 상태 함수가 없습니다. sql/add_shop_delivery_status_and_roulette.sql을 실행해 주세요."
      : `지급 상태 수정 실패: ${error.message}`;
    return NextResponse.json({ ok: false, message: fallback }, { status: 500 });
  }

  const row = (Array.isArray(data) ? data[0] : data) as DeliveryStatusRpcResult | undefined;
  if (!row || !row.ok) {
    return NextResponse.json(
      { ok: false, message: row?.message || "지급 상태 수정에 실패했습니다." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: row.message,
    deliveryCompleted: !!row.delivery_completed,
  });
}
