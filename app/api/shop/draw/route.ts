import { NextResponse } from "next/server";
import {
  getSessionUserFromCookies,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { rejectIfCrossOrigin } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";

type DrawRpcResult = {
  ok: boolean;
  message: string;
  draw_log_id: number | null;
  box_code: string | null;
  product_name: string | null;
  coin_before: number | null;
  coin_after: number | null;
  remaining_quantity: number | null;
  is_rare: boolean;
};

export async function POST(request: Request) {
  const originError = rejectIfCrossOrigin(request);
  if (originError) return originError;

  const user = await getSessionUserFromCookies();
  if (!user) return unauthorizedResponse();

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, message: "요청 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const boxCode = String(body.boxCode || "")
    .trim()
    .toLowerCase();

  if (!["roulette", "bronze", "silver", "gold", "diamond"].includes(boxCode)) {
    return NextResponse.json(
      { ok: false, message: "상자 종류가 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("shop_draw_box", {
    p_student_id: user.id,
    p_box_code: boxCode,
    p_actor_role: user.role,
    p_actor_id: user.id,
  });

  if (error) {
    const detailMessage = [error.message, (error as { details?: string }).details, (error as { hint?: string }).hint]
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .join(" | ");
    const fallback = error.message.includes("shop_draw_box")
      ? "상점 트랜잭션 함수가 없습니다. sql/create_shop_system.sql을 실행해 주세요."
      : `상자 열기에 실패했습니다: ${detailMessage || error.message}`;
    return NextResponse.json({ ok: false, message: fallback }, { status: 500 });
  }

  const row = (Array.isArray(data) ? data[0] : data) as DrawRpcResult | undefined;
  if (!row) {
    return NextResponse.json(
      { ok: false, message: "상자 열기 결과를 확인하지 못했습니다." },
      { status: 500 }
    );
  }

  if (!row.ok) {
    return NextResponse.json(
      { ok: false, message: row.message || "상자 열기에 실패했습니다." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: row.message,
    result: {
      drawLogId: row.draw_log_id,
      boxCode: row.box_code,
      productName: row.product_name,
      coinBefore: row.coin_before,
      coinAfter: row.coin_after,
      remainingQuantity: row.remaining_quantity,
      isRare: row.is_rare,
    },
  });
}
