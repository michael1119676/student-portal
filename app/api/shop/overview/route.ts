import { NextResponse } from "next/server";
import { getSessionUserFromCookies, unauthorizedResponse } from "@/lib/api-auth";
import { isShopSchemaReady, syncShopCatalogFromDefaults } from "@/lib/shop-db";
import { maskStudentName } from "@/lib/shop";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const user = await getSessionUserFromCookies();
  if (!user) return unauthorizedResponse();

  const supabase = createAdminClient();
  const schemaReady = await isShopSchemaReady(supabase);
  if (!schemaReady) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "상점 테이블이 아직 준비되지 않았습니다. sql/create_shop_system.sql을 먼저 실행해 주세요.",
      },
      { status: 503 }
    );
  }

  const { data: me, error: meError } = await supabase
    .from("students")
    .select("id, coin_balance")
    .eq("id", user.id)
    .maybeSingle();

  if (meError || !me) {
    return NextResponse.json(
      { ok: false, message: "학생 정보를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const { data: boxes, error: boxError } = await supabase
    .from("shop_boxes")
    .select("id, code, name, coin_cost, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (boxError) {
    return NextResponse.json(
      { ok: false, message: "상자 정보를 불러오지 못했습니다." },
      { status: 500 }
    );
  }

  let safeBoxes = boxes ?? [];
  if (safeBoxes.length === 0) {
    try {
      await syncShopCatalogFromDefaults(supabase, { resetRemaining: false, adminId: null });
      const { data: refreshedBoxes } = await supabase
        .from("shop_boxes")
        .select("id, code, name, coin_cost, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      safeBoxes = refreshedBoxes ?? [];
    } catch {
      //
    }
  }

  if (safeBoxes.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "상점 초기 데이터가 비어 있습니다. 관리자 계정으로 상점 > 기본값 동기화를 1회 실행해 주세요.",
      },
      { status: 503 }
    );
  }

  const boxIds = safeBoxes.map((box) => box.id);
  let products: Array<{ id: string; box_id: string; is_active: boolean }> = [];
  if (boxIds.length > 0) {
    const { data: productRows, error: productError } = await supabase
      .from("shop_products")
      .select("id, box_id, is_active")
      .in("box_id", boxIds);

    if (productError) {
      return NextResponse.json(
        { ok: false, message: "상품 정보를 불러오지 못했습니다." },
        { status: 500 }
      );
    }
    products = (productRows ?? []) as Array<{ id: string; box_id: string; is_active: boolean }>;
  }
  const productIds = products.map((row) => row.id);
  let inventories: Array<{ product_id: string; remaining_quantity: number }> = [];
  if (productIds.length > 0) {
    const { data: inventoryRows, error: inventoryError } = await supabase
      .from("box_inventory")
      .select("product_id, remaining_quantity")
      .in("product_id", productIds);

    if (inventoryError) {
      return NextResponse.json(
        { ok: false, message: "재고 정보를 불러오지 못했습니다." },
        { status: 500 }
      );
    }
    inventories = (inventoryRows ?? []) as Array<{
      product_id: string;
      remaining_quantity: number;
    }>;
  }

  const remainingByProduct = new Map<string, number>();
  for (const row of inventories) {
    remainingByProduct.set(row.product_id, Number(row.remaining_quantity ?? 0));
  }

  const { data: ticketRows, error: ticketError } = await supabase
    .from("student_box_tickets")
    .select("box_code, remaining_count")
    .eq("student_id", user.id);

  if (ticketError && !ticketError.message.includes("student_box_tickets")) {
    return NextResponse.json(
      { ok: false, message: "무료 뽑기권 정보를 불러오지 못했습니다." },
      { status: 500 }
    );
  }

  const ticketCountByBox = new Map<string, number>();
  for (const row of ticketRows ?? []) {
    ticketCountByBox.set(String(row.box_code), Number(row.remaining_count ?? 0));
  }

  const boxSummaries = safeBoxes.map((box) => {
    const activeProducts = products.filter(
      (product) => product.box_id === box.id && product.is_active
    );
    const remaining = activeProducts.reduce(
      (acc, product) => acc + (remainingByProduct.get(product.id) ?? 0),
      0
    );
    return {
      code: box.code,
      name: box.name,
      coinCost: Number(box.coin_cost ?? 0),
      remainingCount: user.role === "admin" ? remaining : null,
      productCount: user.role === "admin" ? activeProducts.length : null,
      ticketCount: Number(ticketCountByBox.get(box.code) ?? 0),
    };
  });

  const { data: recentDraws, error: recentError } = await supabase
    .from("draw_logs")
    .select("id, student_name_snapshot, box_code, product_name, is_rare, created_at")
    .order("created_at", { ascending: false })
    .limit(25);

  if (recentError) {
    return NextResponse.json(
      { ok: false, message: "최근 당첨 내역을 불러오지 못했습니다." },
      { status: 500 }
    );
  }

  const { data: rareTop } = await supabase
    .from("draw_logs")
    .select("id, student_name_snapshot, box_code, product_name, created_at")
    .eq("is_rare", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    role: user.role,
    coinBalance: Number(me.coin_balance ?? 0),
    boxes: boxSummaries,
    recentFeed: (recentDraws ?? []).map((row) => ({
      id: row.id,
      maskedName: maskStudentName(row.student_name_snapshot),
      boxCode: row.box_code,
      productName: row.product_name,
      isRare: !!row.is_rare,
      createdAt: row.created_at,
    })),
    rareTop: rareTop
      ? {
          id: rareTop.id,
          maskedName: maskStudentName(rareTop.student_name_snapshot),
          boxCode: rareTop.box_code,
          productName: rareTop.product_name,
          createdAt: rareTop.created_at,
        }
      : null,
  });
}
