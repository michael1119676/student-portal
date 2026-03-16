import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildPremiumViewData, PREMIUM_MONTH_ROUNDS } from "@/lib/season-premium";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const user = verifySessionToken(token);

  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

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
  const { data: students, error: studentError } = await supabase
    .from("students")
    .select("id, name, class_name")
    .eq("role", "student");

  if (studentError || !students) {
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

  const { data: records, error: recordError } = await supabase
    .from("exam_score_records")
    .select("student_id, round, score")
    .eq("season", "DP")
    .in("round", [...PREMIUM_MONTH_ROUNDS]);

  if (recordError) {
    return NextResponse.json(
      { ok: false, message: "더프리미엄 모의고사 점수를 불러오지 못했습니다." },
      { status: 500 }
    );
  }

  const data = buildPremiumViewData(
    students,
    (records ?? []) as Array<{ student_id: string; round: number; score: number | null }>,
    targetStudentId
  );

  return NextResponse.json({
    ok: true,
    season: "DP",
    maxRound: PREMIUM_MONTH_ROUNDS.length,
    yMax: 50,
    binSize: 5,
    monthRounds: [...PREMIUM_MONTH_ROUNDS],
    data,
  });
}
