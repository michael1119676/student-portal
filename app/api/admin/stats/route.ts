import { NextResponse } from "next/server";
import { getSessionUserFromCookies, unauthorizedResponse } from "@/lib/api-auth";
import { fetchUploadedAnswerRowsByRound } from "@/lib/season-answer-responses";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildSeasonCAdminStats } from "@/lib/season-c";
import { buildSeasonNAdminStats } from "@/lib/season-n";
import {
  buildPremiumAdminStats,
  getPremiumSeasonMeta,
  getPremiumSeasonRounds,
  isPremiumSeason,
} from "@/lib/season-premium";

export async function GET(request: Request) {
  const user = await getSessionUserFromCookies();
  if (!user || user.role !== "admin") return unauthorizedResponse();

  const url = new URL(request.url);
  const season = String(url.searchParams.get("season") || "C").toUpperCase();
  const round = Number(url.searchParams.get("round") || 1);

  if (!Number.isFinite(round) || round < 1 || round > 30) {
    return NextResponse.json(
      { ok: false, message: "회차 정보가 올바르지 않습니다." },
      { status: 400 }
    );
  }

  if (!["C", "N", "M", "DP", "SP", "EA"].includes(season)) {
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
      { ok: false, message: "M 시즌은 개강 전 입니다." },
      { status: 400 }
    );
  }

  if (isPremiumSeason(season)) {
    const seasonMeta = getPremiumSeasonMeta(season);
    const { data: records, error: recordError } = await supabase
      .from("exam_score_records")
      .select("student_id, round, score")
      .eq("season", season)
      .in("round", getPremiumSeasonRounds(season));

    if (recordError) {
      return NextResponse.json(
        { ok: false, message: `${seasonMeta.title} 점수를 불러오지 못했습니다.` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      stats: buildPremiumAdminStats(
        students,
        (records ?? []) as Array<{ student_id: string; round: number; score: number | null }>,
        round,
        season
      ),
    });
  }

  const uploadedRowsByRound =
    season === "N"
      ? await fetchUploadedAnswerRowsByRound("N")
      : await fetchUploadedAnswerRowsByRound("C");
  const stats =
    season === "N"
      ? buildSeasonNAdminStats(students, round, uploadedRowsByRound)
      : buildSeasonCAdminStats(students, round, uploadedRowsByRound);
  return NextResponse.json({
    ok: true,
    stats,
  });
}
