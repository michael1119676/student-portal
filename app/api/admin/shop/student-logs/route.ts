import { NextResponse } from "next/server";
import {
  getSessionUserFromCookies,
  requireAdmin,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const user = await getSessionUserFromCookies();
  if (!user) return unauthorizedResponse();

  const adminError = requireAdmin(user);
  if (adminError) return adminError;

  const url = new URL(request.url);
  const studentId = String(url.searchParams.get("studentId") || "").trim();
  if (!studentId) {
    return NextResponse.json(
      { ok: false, message: "학생 정보가 필요합니다." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, name, phone, class_name, coin_balance")
    .eq("id", studentId)
    .maybeSingle();

  if (studentError || !student) {
    return NextResponse.json(
      { ok: false, message: "학생 정보를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const { data: ledgerLogs, error: ledgerError } = await supabase
    .from("coin_ledger")
    .select(
      "id, created_at, event_type, reason, delta, coin_before, coin_after, related_box_code, related_product_name, actor_role, actor_id"
    )
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (ledgerError) {
    return NextResponse.json(
      { ok: false, message: "학생 로그를 불러오지 못했습니다." },
      { status: 500 }
    );
  }

  const { data: drawLogs } = await supabase
    .from("draw_logs")
    .select(
      "id, created_at, box_code, product_name, is_rare, inventory_before, inventory_after, coin_before, coin_after"
    )
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(200);

  return NextResponse.json({
    ok: true,
    student: {
      id: student.id,
      name: student.name,
      phone: student.phone,
      className: student.class_name,
      coinBalance: Number(student.coin_balance ?? 0),
    },
    ledgerLogs: (ledgerLogs ?? []).map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      eventType: row.event_type,
      reason: row.reason,
      delta: row.delta,
      coinBefore: row.coin_before,
      coinAfter: row.coin_after,
      relatedBoxCode: row.related_box_code,
      relatedProductName: row.related_product_name,
      actorRole: row.actor_role,
      actorId: row.actor_id,
    })),
    drawLogs: (drawLogs ?? []).map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      boxCode: row.box_code,
      productName: row.product_name,
      isRare: !!row.is_rare,
      inventoryBefore: row.inventory_before,
      inventoryAfter: row.inventory_after,
      coinBefore: row.coin_before,
      coinAfter: row.coin_after,
    })),
  });
}

