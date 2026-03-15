import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

function normalizeSeason(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function normalizeRound(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const round = Math.round(n);
  if (round < 1 || round > 30) return null;
  return round;
}

function normalizeCut(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const v = Math.round(n);
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
}

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const user = verifySessionToken(token);
  if (!user || user.role !== "admin") return null;
  return user;
}

export async function POST(request: Request) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const season = normalizeSeason(body?.season);
  const round = normalizeRound(body?.round);
  const cut1 = normalizeCut(body?.cut1);
  const cut2 = normalizeCut(body?.cut2);
  const cut3 = normalizeCut(body?.cut3);

  if (!season || round === null) {
    return NextResponse.json(
      { ok: false, message: "시즌/회차 정보가 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("season_cutoffs")
    .upsert(
      {
        season,
        round,
        cut1,
        cut2,
        cut3,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "season,round" }
    );

  if (error) {
    return NextResponse.json(
      { ok: false, message: "컷 저장에 실패했습니다. DB 테이블 구성을 확인해 주세요." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
