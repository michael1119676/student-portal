import { NextResponse } from "next/server";
import { getSessionUserFromCookies, unauthorizedResponse } from "@/lib/api-auth";
import { fetchSeasonAnswerConfigMap } from "@/lib/season-answer-config";
import { fetchUploadedAnswerRowsByRound } from "@/lib/season-answer-responses";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildSeasonCViewData } from "@/lib/season-c";

export async function GET(request: Request) {
  const user = await getSessionUserFromCookies();
  if (!user) return unauthorizedResponse();

  const url = new URL(request.url);
  const studentIdFromQuery = String(url.searchParams.get("studentId") || "").trim();

  const targetStudentId =
    user.role === "admin" ? studentIdFromQuery : user.id;

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
    return NextResponse.json(
      { ok: false, message: "Forbidden" },
      { status: 403 }
    );
  }

  const uploadedRowsByRound = await fetchUploadedAnswerRowsByRound("C");
  const answerConfigMap = await fetchSeasonAnswerConfigMap("C");
  const data = buildSeasonCViewData(
    students,
    targetStudentId,
    uploadedRowsByRound,
    answerConfigMap
  );
  return NextResponse.json({
    ok: true,
    season: "C",
    maxRound: 10,
    yMax: 100,
    binSize: 10,
    data,
  });
}
