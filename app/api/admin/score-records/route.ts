import { NextResponse } from "next/server";
import {
  getSessionUserFromCookies,
  requireAdmin,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { createStudentScoreNotification } from "@/lib/notifications";
import { rejectIfCrossOrigin } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const studentId = String(body.studentId || "").trim();
  const season = String(body.season || "").trim().toUpperCase();
  const round = Number(body.round);
  const score = body.score === null || body.score === undefined ? null : Number(body.score);
  const sourceKey = String(body.sourceKey || "").trim();

  if (!studentId || !season || !Number.isFinite(round)) {
    return NextResponse.json(
      { ok: false, message: "학생/시즌/회차 정보가 올바르지 않습니다." },
      { status: 400 }
    );
  }

  if (score !== null && !Number.isFinite(score)) {
    return NextResponse.json(
      { ok: false, message: "점수 값이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const safeRound = Math.max(1, Math.min(100, Math.round(round)));

  const supabase = createAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("exam_score_records")
    .select("id")
    .eq("student_id", studentId)
    .eq("season", season)
    .eq("round", safeRound)
    .maybeSingle();

  if (existingError && existingError.code !== "PGRST116") {
    return NextResponse.json(
      { ok: false, message: "기존 성적 레코드를 확인하지 못했습니다." },
      { status: 500 }
    );
  }

  const now = new Date().toISOString();

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from("exam_score_records")
      .update({
        score,
        source_key: sourceKey || null,
        recorded_by: user.id,
        updated_at: now,
      })
      .eq("id", existing.id);

    if (updateError) {
      return NextResponse.json(
        { ok: false, message: `성적 수정 실패: ${updateError.message}` },
        { status: 500 }
      );
    }

    await supabase.from("admin_action_logs").insert({
      admin_id: user.id,
      action_type: "score_record_update",
      target_student_id: studentId,
      reason: `${season} 시즌 ${safeRound}회 성적 수정`,
      before_data: null,
      after_data: { season, round: safeRound, score, sourceKey: sourceKey || null },
      created_at: now,
    });

    return NextResponse.json({
      ok: true,
      created: false,
      awardedCoin: false,
      message: "성적 레코드를 수정했습니다. (코인은 신규 입력 시에만 지급됩니다.)",
    });
  }

  const { error: insertError } = await supabase.from("exam_score_records").insert({
    student_id: studentId,
    season,
    round: safeRound,
    score,
    source_key: sourceKey || `${studentId}:${season}:${safeRound}`,
    recorded_by: user.id,
    created_at: now,
    updated_at: now,
  });

  if (insertError) {
    return NextResponse.json(
      { ok: false, message: `성적 입력 실패: ${insertError.message}` },
      { status: 500 }
    );
  }

  await supabase.from("admin_action_logs").insert({
    admin_id: user.id,
    action_type: "score_record_insert",
    target_student_id: studentId,
    reason: `${season} 시즌 ${safeRound}회 성적 신규 입력`,
    before_data: null,
    after_data: { season, round: safeRound, score, sourceKey: sourceKey || null },
    created_at: now,
  });

  try {
    await createStudentScoreNotification(supabase, {
      studentId,
      season,
      round: safeRound,
      score,
      createdBy: user.id,
    });
  } catch (error) {
    console.error("[notifications] score insert notification failed", error);
  }

  return NextResponse.json({
    ok: true,
    created: true,
    awardedCoin: true,
    message: "성적 레코드를 신규 입력했습니다. 코인 +1이 자동 지급됩니다.",
  });
}
