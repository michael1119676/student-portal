import { NextResponse } from "next/server";
import {
  getSessionUserFromCookies,
  requireAdmin,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { rejectIfCrossOrigin } from "@/lib/security";
import { syncShopCatalogFromExcel } from "@/lib/shop-db";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const originError = rejectIfCrossOrigin(request);
  if (originError) return originError;

  const user = await getSessionUserFromCookies();
  if (!user) return unauthorizedResponse();

  const adminError = requireAdmin(user);
  if (adminError) return adminError;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const resetRemaining = body.resetRemaining === true;

  try {
    const result = await syncShopCatalogFromExcel(createAdminClient(), {
      resetRemaining,
      adminId: user.id,
    });
    return NextResponse.json({
      ok: true,
      message: `엑셀 동기화 완료 (상자 ${result.boxCount}개, 상품 ${result.productCount}개)`,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "엑셀 동기화에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}

