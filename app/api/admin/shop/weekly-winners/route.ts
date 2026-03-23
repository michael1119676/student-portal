import { NextResponse } from "next/server";
import {
  getSessionUserFromCookies,
  requireAdmin,
  unauthorizedResponse,
} from "@/lib/api-auth";
import {
  buildShopDeliveryDateText,
  buildShopDeliveryScheduleText,
  getNSeasonWeekRange,
  getShopProductDeliveryKind,
  getShopProductPrice,
  isShopDeliveryToggleAllowed,
} from "@/lib/shop";
import { createAdminClient } from "@/lib/supabase/admin";

function normalizeClassName(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  if (normalized === "녹화강의반" || normalized === "영상반") return "영상반";
  return normalized || null;
}

export async function GET(request: Request) {
  const user = await getSessionUserFromCookies();
  if (!user) return unauthorizedResponse();

  const adminError = requireAdmin(user);
  if (adminError) return adminError;

  const url = new URL(request.url);
  const weekRaw = Number(url.searchParams.get("week") || 1);
  const mode = String(url.searchParams.get("mode") || "all").trim().toLowerCase();
  const { week, startUtc, endUtcExclusive } = getNSeasonWeekRange(weekRaw);

  const supabase = createAdminClient();
  let { data, error } = await supabase
    .from("draw_logs")
    .select(
      "id, created_at, box_code, product_name, student_id, student_name_snapshot, student_phone_snapshot, delivery_completed, delivery_completed_at, coin_before, coin_after"
    )
    .gte("created_at", startUtc.toISOString())
    .lt("created_at", endUtcExclusive.toISOString())
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error?.message.includes("delivery_completed")) {
    const fallback = await supabase
      .from("draw_logs")
      .select(
        "id, created_at, box_code, product_name, student_id, student_name_snapshot, student_phone_snapshot, delivery_completed_at, coin_before, coin_after"
      )
      .gte("created_at", startUtc.toISOString())
      .lt("created_at", endUtcExclusive.toISOString())
      .order("created_at", { ascending: false })
      .limit(5000);
    data = fallback.data as typeof data;
    error = fallback.error;
  }

  if (error) {
    return NextResponse.json(
      { ok: false, message: "주차별 당첨 로그를 불러오지 못했습니다." },
      { status: 500 }
    );
  }

  const studentIds = [...new Set((data ?? []).map((row) => row.student_id).filter(Boolean))];
  const { data: students } = await supabase
    .from("students")
    .select("id, class_name")
    .in("id", studentIds.length > 0 ? studentIds : ["00000000-0000-0000-0000-000000000000"]);

  const classNameByStudentId = new Map(
    (students ?? []).map((student) => [student.id, normalizeClassName(student.class_name)])
  );

  return NextResponse.json({
    ok: true,
    week,
    mode: mode === "manual" ? "manual" : "all",
    range: {
      startUtc: startUtc.toISOString(),
      endUtcExclusive: endUtcExclusive.toISOString(),
    },
    winners: (data ?? [])
      .map((row) => {
        const deliveryKind = getShopProductDeliveryKind(row.product_name);
        const deliveryCompleted = deliveryKind === "instant" ? true : !!row.delivery_completed;
        const canToggleDelivery = isShopDeliveryToggleAllowed(row.product_name);
        return {
          id: row.id,
          createdAt: row.created_at,
          deliveryCompletedAt:
            "delivery_completed_at" in row
              ? (row as { delivery_completed_at?: string | null }).delivery_completed_at ?? null
              : null,
          boxCode: row.box_code,
          productName: row.product_name,
          productPrice: getShopProductPrice(row.product_name),
          deliveryKind,
          deliveryCompleted,
          deliveryDateText: buildShopDeliveryDateText({
            createdAt: row.created_at,
            completedAt:
              "delivery_completed_at" in row
                ? (row as { delivery_completed_at?: string | null }).delivery_completed_at ?? null
                : null,
            productName: row.product_name,
            deliveryCompleted,
          }),
          deliveryScheduleText: buildShopDeliveryScheduleText({
            createdAt: row.created_at,
            productName: row.product_name,
            deliveryCompleted,
          }),
          canToggleDelivery,
          studentId: row.student_id,
          studentName: row.student_name_snapshot,
          studentPhone: row.student_phone_snapshot,
          className: classNameByStudentId.get(row.student_id) ?? null,
          coinBefore: "coin_before" in row ? Number((row as { coin_before?: number }).coin_before ?? 0) : 0,
          coinAfter: "coin_after" in row ? Number((row as { coin_after?: number }).coin_after ?? 0) : 0,
          delta:
            ("coin_after" in row ? Number((row as { coin_after?: number }).coin_after ?? 0) : 0) -
            ("coin_before" in row ? Number((row as { coin_before?: number }).coin_before ?? 0) : 0),
        };
      })
      .filter((row) => (mode === "manual" ? row.canToggleDelivery : true)),
  });
}
