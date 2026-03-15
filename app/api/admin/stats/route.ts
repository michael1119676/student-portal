import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildSeasonCAdminStats } from "@/lib/season-c";
import { buildSeasonNAdminStats } from "@/lib/season-n";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const user = verifySessionToken(token);

  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const season = String(url.searchParams.get("season") || "C").toUpperCase();
  const round = Number(url.searchParams.get("round") || 1);

  if (!Number.isFinite(round) || round < 1 || round > 30) {
    return NextResponse.json(
      { ok: false, message: "회차 정보가 올바르지 않습니다." },
      { status: 400 }
    );
  }

  if (!["C", "N", "M"].includes(season)) {
    return NextResponse.json(
      { ok: false, message: `지원하지 않는 시즌입니다: ${season}` },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data: students, error } = await supabase
    .from("students")
    .select("id, name, class_name")
    .eq("role", "student");

  if (error || !students) {
    return NextResponse.json(
      { ok: false, message: "학생 데이터를 불러오지 못했습니다." },
      { status: 500 }
    );
  }

  if (season === "M") {
    return NextResponse.json(
      { ok: false, message: "M 시즌 통계는 업데이트 예정입니다." },
      { status: 400 }
    );
  }

  const stats = season === "N"
    ? buildSeasonNAdminStats(students, round)
    : buildSeasonCAdminStats(students, round);
  return NextResponse.json({
    ok: true,
    stats,
  });
}
