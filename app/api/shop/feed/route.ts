import { NextResponse } from "next/server";
import { getSessionUserFromCookies, unauthorizedResponse } from "@/lib/api-auth";
import { maskStudentName } from "@/lib/shop";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const user = await getSessionUserFromCookies();
  if (!user) return unauthorizedResponse();

  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit") || 20);
  const limit = Math.max(1, Math.min(100, Math.round(limitRaw)));
  const rareOnly = url.searchParams.get("rareOnly") === "1";
  const afterIdRaw = Number(url.searchParams.get("afterId") || 0);
  const afterId = Number.isFinite(afterIdRaw) ? Math.max(0, Math.round(afterIdRaw)) : 0;
  const fromRaw = String(url.searchParams.get("from") || "").trim();
  const fromDate = fromRaw ? new Date(fromRaw) : null;
  const hasFromDate = !!fromDate && !Number.isNaN(fromDate.getTime());

  const supabase = createAdminClient();

  let query = supabase
    .from("draw_logs")
    .select("id, student_name_snapshot, box_code, product_name, is_rare, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (rareOnly) {
    query = query.eq("is_rare", true);
  }
  if (afterId > 0) {
    query = query.gt("id", afterId);
  }
  if (hasFromDate && fromDate) {
    query = query.gte("created_at", fromDate.toISOString());
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { ok: false, message: "당첨 피드를 불러오지 못했습니다." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    items: (data ?? []).map((row) => ({
      id: row.id,
      maskedName: maskStudentName(row.student_name_snapshot),
      boxCode: row.box_code,
      productName: row.product_name,
      isRare: !!row.is_rare,
      createdAt: row.created_at,
    })),
  });
}
