import { NextResponse } from "next/server";
import {
  getSessionUserFromCookies,
  requireAdmin,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { rejectIfCrossOrigin } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";

type InventorySetRpcResult = {
  ok: boolean;
  message: string;
  product_id: string | null;
  quantity_before: number | null;
  quantity_after: number | null;
};

const VALID_BOXES = ["roulette", "bronze", "silver", "gold", "diamond"] as const;

export async function GET(request: Request) {
  const user = await getSessionUserFromCookies();
  if (!user) return unauthorizedResponse();

  const adminError = requireAdmin(user);
  if (adminError) return adminError;

  const url = new URL(request.url);
  const boxCode = String(url.searchParams.get("boxCode") || "")
    .trim()
    .toLowerCase();

  const supabase = createAdminClient();
  let boxQuery = supabase
    .from("shop_boxes")
    .select("id, code, name, coin_cost, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (boxCode && VALID_BOXES.includes(boxCode as (typeof VALID_BOXES)[number])) {
    boxQuery = boxQuery.eq("code", boxCode);
  }

  const { data: boxes, error: boxError } = await boxQuery;
  if (boxError) {
    return NextResponse.json(
      { ok: false, message: "상자 정보를 불러오지 못했습니다." },
      { status: 500 }
    );
  }

  const boxIds = (boxes ?? []).map((box) => box.id);
  let products:
    | Array<{
        id: string;
        box_id: string;
        name: string;
        base_probability_percent: number | null;
        is_rare: boolean;
        reward_coin_delta: number;
        reward_coin_multiplier: number;
        is_active: boolean;
        created_at: string;
      }>
    | [] = [];

  if (boxIds.length > 0) {
    const { data: productRows, error: productError } = await supabase
      .from("shop_products")
      .select(
        "id, box_id, name, base_probability_percent, is_rare, reward_coin_delta, reward_coin_multiplier, is_active, created_at"
      )
      .in("box_id", boxIds)
      .order("created_at", { ascending: true });

    if (productError) {
      return NextResponse.json(
        { ok: false, message: "상품 정보를 불러오지 못했습니다." },
        { status: 500 }
      );
    }
    products = (productRows ?? []) as typeof products;
  }

  const productIds = products.map((product) => product.id);
  let inventories:
    | Array<{
        product_id: string;
        initial_quantity: number;
        remaining_quantity: number;
        updated_at: string;
      }>
    | [] = [];

  if (productIds.length > 0) {
    const { data: inventoryRows, error: inventoryError } = await supabase
      .from("box_inventory")
      .select("product_id, initial_quantity, remaining_quantity, updated_at")
      .in("product_id", productIds);

    if (inventoryError) {
      return NextResponse.json(
        { ok: false, message: "재고 정보를 불러오지 못했습니다." },
        { status: 500 }
      );
    }
    inventories = (inventoryRows ?? []) as typeof inventories;
  }

  const inventoryMap = new Map<string, { initial: number; remaining: number; updatedAt: string }>();
  for (const row of inventories) {
    inventoryMap.set(row.product_id, {
      initial: Number(row.initial_quantity ?? 0),
      remaining: Number(row.remaining_quantity ?? 0),
      updatedAt: String(row.updated_at ?? ""),
    });
  }

  return NextResponse.json({
    ok: true,
    boxes: (boxes ?? []).map((box) => ({
      code: box.code,
      name: box.name,
      coinCost: Number(box.coin_cost ?? 0),
      products: products
        .filter((product) => product.box_id === box.id)
        .map((product) => {
          const inv = inventoryMap.get(product.id);
          return {
            id: product.id,
            name: product.name,
            baseProbabilityPercent:
              product.base_probability_percent === null
                ? null
                : Number(product.base_probability_percent),
            isRare: !!product.is_rare,
            rewardCoinDelta: Number(product.reward_coin_delta ?? 0),
            rewardCoinMultiplier: Number(product.reward_coin_multiplier ?? 1),
            isActive: !!product.is_active,
            initialQuantity: inv?.initial ?? 0,
            remainingQuantity: inv?.remaining ?? 0,
            updatedAt: inv?.updatedAt ?? null,
          };
        }),
    })),
  });
}

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

  const productId = String(body.productId || "").trim();
  const reason = String(body.reason || "").trim();
  const remainingQuantity = Number(body.remainingQuantity);

  if (!productId || !Number.isFinite(remainingQuantity)) {
    return NextResponse.json(
      { ok: false, message: "상품/수량 정보가 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("shop_admin_set_inventory", {
    p_admin_id: user.id,
    p_product_id: productId,
    p_remaining_quantity: Math.max(0, Math.round(remainingQuantity)),
    p_reason: reason,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, message: `재고 수정 실패: ${error.message}` },
      { status: 500 }
    );
  }

  const row = (Array.isArray(data) ? data[0] : data) as InventorySetRpcResult | undefined;
  if (!row || !row.ok) {
    return NextResponse.json(
      { ok: false, message: row?.message || "재고 수정에 실패했습니다." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: row.message,
    result: {
      productId: row.product_id,
      before: row.quantity_before,
      after: row.quantity_after,
    },
  });
}
