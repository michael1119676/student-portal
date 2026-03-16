import { NextResponse } from "next/server";
import {
  getSessionUserFromCookies,
  resolveSessionUser,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { buildShopDeliveryScheduleText, getShopProductDeliveryKind } from "@/lib/shop";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const user = await getSessionUserFromCookies();
  if (!user) return unauthorizedResponse();

  const supabase = createAdminClient();
  const resolvedUser = await resolveSessionUser(supabase, user);
  const { data, error } = await supabase
    .from("coin_ledger")
    .select(
      "id, created_at, reason, delta, coin_before, coin_after, related_product_name, related_box_code, draw_log_id"
    )
    .eq("student_id", resolvedUser.id)
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    return NextResponse.json(
      { ok: false, message: "내 코인 기록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }

  const drawLogIds = [...new Set((data ?? []).map((row) => Number(row.draw_log_id ?? 0)).filter((id) => id > 0))];
  let deliveryCompletedByDrawLogId = new Map<number, boolean>();

  if (drawLogIds.length > 0) {
    const { data: drawLogs, error: drawLogError } = await supabase
      .from("draw_logs")
      .select("id, delivery_completed")
      .in("id", drawLogIds);

    if (drawLogError && !drawLogError.message.includes("delivery_completed")) {
      return NextResponse.json(
        { ok: false, message: "지급 상태 정보를 불러오지 못했습니다." },
        { status: 500 }
      );
    }

    deliveryCompletedByDrawLogId = new Map<number, boolean>(
      (drawLogs ?? []).map((row) => [Number(row.id), !!row.delivery_completed])
    );
  }

  return NextResponse.json({
    ok: true,
    logs: (data ?? []).map((row) => ({
      deliveryKind: row.related_product_name
        ? getShopProductDeliveryKind(row.related_product_name)
        : null,
      deliveryCompleted: row.related_product_name
        ? getShopProductDeliveryKind(row.related_product_name) === "instant"
          ? true
          : !!deliveryCompletedByDrawLogId.get(Number(row.draw_log_id ?? 0))
        : false,
      deliveryScheduleText: buildShopDeliveryScheduleText({
        createdAt: row.created_at,
        productName: row.related_product_name,
        deliveryCompleted: row.related_product_name
          ? getShopProductDeliveryKind(row.related_product_name) === "instant"
            ? true
            : !!deliveryCompletedByDrawLogId.get(Number(row.draw_log_id ?? 0))
          : false,
      }),
      id: row.id,
      createdAt: row.created_at,
      reason: row.reason,
      delta: row.delta,
      coinBefore: row.coin_before,
      coinAfter: row.coin_after,
      productName: row.related_product_name || "-",
      boxCode: row.related_box_code || null,
    })),
  });
}
