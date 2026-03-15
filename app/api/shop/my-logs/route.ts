import { NextResponse } from "next/server";
import { getSessionUserFromCookies, unauthorizedResponse } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const user = await getSessionUserFromCookies();
  if (!user) return unauthorizedResponse();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("coin_ledger")
    .select(
      "id, created_at, reason, delta, coin_before, coin_after, related_product_name, related_box_code"
    )
    .eq("student_id", user.id)
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    return NextResponse.json(
      { ok: false, message: "내 코인 기록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    logs: (data ?? []).map((row) => ({
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

