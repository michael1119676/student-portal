import { NextResponse } from "next/server";
import { getSessionUserFromCookies, unauthorizedResponse } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

type ProbabilityRow = {
  id: string;
  box_id: string;
  name: string;
  base_probability_percent: number | null;
  is_rare: boolean;
  created_at: string;
};

export async function GET() {
  const user = await getSessionUserFromCookies();
  if (!user) return unauthorizedResponse();

  const supabase = createAdminClient();

  const { data: boxes, error: boxError } = await supabase
    .from("shop_boxes")
    .select("id, code, name, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (boxError) {
    return NextResponse.json(
      { ok: false, message: "상자 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }

  const boxIds = (boxes ?? []).map((box) => box.id);
  if (boxIds.length === 0) {
    return NextResponse.json({ ok: true, role: user.role, boxes: [] });
  }

  const { data: products, error: productError } = await supabase
    .from("shop_products")
    .select("id, box_id, name, base_probability_percent, is_rare, created_at")
    .in("box_id", boxIds)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (productError) {
    return NextResponse.json(
      { ok: false, message: "상품 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }

  const productIds = (products ?? []).map((product) => product.id);
  let remainingMap = new Map<string, number>();
  if (productIds.length > 0) {
    const { data: inventories, error: inventoryError } = await supabase
      .from("box_inventory")
      .select("product_id, remaining_quantity")
      .in("product_id", productIds);

    if (inventoryError) {
      return NextResponse.json(
        { ok: false, message: "재고 정보를 불러오지 못했습니다." },
        { status: 500 }
      );
    }

    remainingMap = new Map<string, number>(
      (inventories ?? []).map((row) => [row.product_id, Number(row.remaining_quantity ?? 0)])
    );
  }

  const productRows = (products ?? []) as ProbabilityRow[];
  const payload = (boxes ?? []).map((box) => {
    const rows = productRows.filter((row) => row.box_id === box.id);
    const totalRemaining = rows.reduce(
      (acc, row) => acc + Math.max(0, Number(remainingMap.get(row.id) ?? 0)),
      0
    );

    return {
      code: box.code,
      name: box.name,
      products: rows.map((row) => {
        const remainingQuantity = Math.max(0, Number(remainingMap.get(row.id) ?? 0));
        const realtimeProbabilityPercent =
          totalRemaining > 0 ? Math.round((remainingQuantity / totalRemaining) * 1000000) / 10000 : null;

        return {
          id: row.id,
          name: row.name,
          baseProbabilityPercent:
            row.base_probability_percent === null ? null : Number(row.base_probability_percent),
          realtimeProbabilityPercent: user.role === "admin" ? realtimeProbabilityPercent : null,
          remainingQuantity: user.role === "admin" ? remainingQuantity : null,
          isRare: !!row.is_rare,
        };
      }),
    };
  });

  return NextResponse.json({
    ok: true,
    role: user.role,
    boxes: payload,
  });
}
