import { NextResponse } from "next/server";
import {
  getSessionUserFromCookies,
  requireAdmin,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { rejectIfCrossOrigin } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";

type AddProductRpcResult = {
  ok: boolean;
  message: string;
  product_id: string | null;
};

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

  const boxCode = String(body.boxCode || "")
    .trim()
    .toLowerCase();
  const name = String(body.name || "").trim();
  const quantity = Number(body.quantity);
  const baseProbabilityPercent =
    body.baseProbabilityPercent === null || body.baseProbabilityPercent === undefined
      ? null
      : Number(body.baseProbabilityPercent);
  const isRare = body.isRare === true;
  const reason = String(body.reason || "").trim();

  if (!["bronze", "silver", "gold", "diamond"].includes(boxCode)) {
    return NextResponse.json(
      { ok: false, message: "상자 선택이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  if (!name || !Number.isFinite(quantity)) {
    return NextResponse.json(
      { ok: false, message: "상품명/수량을 확인해 주세요." },
      { status: 400 }
    );
  }

  if (baseProbabilityPercent !== null && !Number.isFinite(baseProbabilityPercent)) {
    return NextResponse.json(
      { ok: false, message: "기준 확률 값이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("shop_admin_add_product", {
    p_admin_id: user.id,
    p_box_code: boxCode,
    p_name: name,
    p_quantity: Math.max(0, Math.round(quantity)),
    p_base_probability_percent:
      baseProbabilityPercent === null ? null : Math.max(0, Number(baseProbabilityPercent)),
    p_is_rare: isRare,
    p_reason: reason,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, message: `상품 추가 실패: ${error.message}` },
      { status: 500 }
    );
  }

  const row = (Array.isArray(data) ? data[0] : data) as AddProductRpcResult | undefined;
  if (!row || !row.ok) {
    return NextResponse.json(
      { ok: false, message: row?.message || "상품 추가에 실패했습니다." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: row.message,
    productId: row.product_id,
  });
}

