import { NextResponse } from "next/server";
import {
  getSessionUserFromCookies,
  requireAdmin,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { getNSeasonWeekRange } from "@/lib/shop";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const user = await getSessionUserFromCookies();
  if (!user) return unauthorizedResponse();

  const adminError = requireAdmin(user);
  if (adminError) return adminError;

  const url = new URL(request.url);
  const weekRaw = Number(url.searchParams.get("week") || 1);
  const { week, startUtc, endUtcExclusive } = getNSeasonWeekRange(weekRaw);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("draw_logs")
    .select(
      "id, created_at, box_code, product_name, student_id, student_name_snapshot, student_phone_snapshot"
    )
    .gte("created_at", startUtc.toISOString())
    .lt("created_at", endUtcExclusive.toISOString())
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) {
    return NextResponse.json(
      { ok: false, message: "주차별 당첨 로그를 불러오지 못했습니다." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    week,
    range: {
      startUtc: startUtc.toISOString(),
      endUtcExclusive: endUtcExclusive.toISOString(),
    },
    winners: (data ?? []).map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      boxCode: row.box_code,
      productName: row.product_name,
      studentId: row.student_id,
      studentName: row.student_name_snapshot,
      studentPhone: row.student_phone_snapshot,
    })),
  });
}

