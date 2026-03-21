import { NextResponse } from "next/server";
import { getSessionUserFromCookies, unauthorizedResponse } from "@/lib/api-auth";
import { fetchUploadedAnswerRowsByRound } from "@/lib/season-answer-responses";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildSeasonNViewData } from "@/lib/season-n";

export async function GET(request: Request) {
  const user = await getSessionUserFromCookies();
  if (!user) return unauthorizedResponse();

  const url = new URL(request.url);
  const studentIdFromQuery = String(url.searchParams.get("studentId") || "").trim();
  const targetStudentId = user.role === "admin" ? studentIdFromQuery : user.id;

  if (!targetStudentId) {
    return NextResponse.json(
      { ok: false, message: "학생 정보가 필요합니다." },
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
      { ok: false, message: "학생 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }

  if (user.role === "admin") {
    const exists = students.some((student) => student.id === targetStudentId);
    if (!exists) {
      return NextResponse.json(
        { ok: false, message: "대상 학생을 찾을 수 없습니다." },
        { status: 404 }
      );
    }
  }

  if (user.role !== "admin" && targetStudentId !== user.id) {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  const cutoffsByRound: Record<number, { cut1: number | null; cut2: number | null; cut3: number | null }> = {};
  const { data: cutoffs } = await supabase
    .from("season_cutoffs")
    .select("round, cut1, cut2, cut3")
    .eq("season", "N");

  for (const row of cutoffs ?? []) {
    const round = Number(row.round);
    if (!Number.isFinite(round)) continue;
    cutoffsByRound[Math.round(round)] = {
      cut1: row.cut1 === null ? null : Number(row.cut1),
      cut2: row.cut2 === null ? null : Number(row.cut2),
      cut3: row.cut3 === null ? null : Number(row.cut3),
    };
  }

  const uploadedRowsByRound = await fetchUploadedAnswerRowsByRound("N");
  const data = buildSeasonNViewData(
    students,
    targetStudentId,
    cutoffsByRound,
    uploadedRowsByRound
  );

  return NextResponse.json({
    ok: true,
    season: "N",
    maxRound: 12,
    yMax: 50,
    binSize: 5,
    data,
  });
}
