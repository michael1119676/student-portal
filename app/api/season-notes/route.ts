import { NextResponse } from "next/server";
import {
  getSessionUserFromCookies,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { createAdminCommentNotification } from "@/lib/notifications";
import { rejectIfCrossOrigin } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";

function normalizeSeason(value: unknown) {
  const season = String(value || "")
    .trim()
    .toUpperCase();
  return season || null;
}

function buildStatus(row: {
  student_note: string;
  admin_comment: string;
  note_updated_at: string | null;
  note_updated_by_role: string | null;
  admin_comment_updated_at: string | null;
}) {
  const hasAdminComment = row.admin_comment.trim().length > 0;
  const noteUpdatedAt = row.note_updated_at ? Date.parse(row.note_updated_at) : NaN;
  const adminCommentUpdatedAt = row.admin_comment_updated_at
    ? Date.parse(row.admin_comment_updated_at)
    : NaN;

  let status: "미댓글" | "댓글 완료" | "갱신됨" = "미댓글";
  if (hasAdminComment) {
    status =
      row.note_updated_by_role === "student" &&
      Number.isFinite(noteUpdatedAt) &&
      Number.isFinite(adminCommentUpdatedAt) &&
      noteUpdatedAt > adminCommentUpdatedAt
        ? "갱신됨"
        : "댓글 완료";
  }

  return {
    hasAdminComment,
    status,
  };
}

export async function GET(request: Request) {
  const user = await getSessionUserFromCookies();
  if (!user) return unauthorizedResponse();

  const url = new URL(request.url);
  const season = normalizeSeason(url.searchParams.get("season"));
  const round = Number(url.searchParams.get("round"));
  const studentIdFromQuery = String(url.searchParams.get("studentId") || "").trim();

  if (!season || !Number.isFinite(round)) {
    return NextResponse.json(
      { ok: false, message: "시즌과 회차 정보가 필요합니다." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const targetStudentId = user.role === "admin" ? studentIdFromQuery : user.id;

  if (!targetStudentId) {
    return NextResponse.json(
      { ok: false, message: "대상 학생 정보가 필요합니다." },
      { status: 400 }
    );
  }

  if (user.role !== "admin" && targetStudentId !== user.id) {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, name, role")
    .eq("id", targetStudentId)
    .maybeSingle();

  if (studentError || !student || student.role !== "student") {
    return NextResponse.json(
      { ok: false, message: "대상 학생을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const { data: row, error } = await supabase
    .from("season_feedback_notes")
    .select(
      "id, student_id, season, round, student_note, admin_comment, note_updated_at, note_updated_by_role, admin_comment_updated_at, updated_at, created_at"
    )
    .eq("student_id", targetStudentId)
    .eq("season", season)
    .eq("round", Math.round(round))
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json(
      { ok: false, message: "메모를 불러오지 못했습니다." },
      { status: 500 }
    );
  }

  const safeRow = row ?? {
    id: null,
    student_id: targetStudentId,
    season,
    round: Math.round(round),
    student_note: "",
    admin_comment: "",
    note_updated_at: null,
    note_updated_by_role: null,
    admin_comment_updated_at: null,
    updated_at: null,
    created_at: null,
  };

  const status = buildStatus(safeRow);

  return NextResponse.json({
    ok: true,
    note: {
      id: safeRow.id,
      studentId: safeRow.student_id,
      season: safeRow.season,
      round: safeRow.round,
      studentNote: safeRow.student_note,
      adminComment: safeRow.admin_comment,
      noteUpdatedAt: safeRow.note_updated_at,
      noteUpdatedByRole: safeRow.note_updated_by_role,
      adminCommentUpdatedAt: safeRow.admin_comment_updated_at,
      updatedAt: safeRow.updated_at,
      createdAt: safeRow.created_at,
      hasAdminComment: status.hasAdminComment,
      status: status.status,
      studentName: student.name,
    },
  });
}

export async function POST(request: Request) {
  const originError = rejectIfCrossOrigin(request);
  if (originError) return originError;

  const user = await getSessionUserFromCookies();
  if (!user) return unauthorizedResponse();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, message: "요청 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const season = normalizeSeason(body.season);
  const round = Number(body.round);
  const studentIdFromBody = String(body.studentId || "").trim();

  if (!season || !Number.isFinite(round)) {
    return NextResponse.json(
      { ok: false, message: "시즌과 회차 정보가 필요합니다." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const targetStudentId = user.role === "admin" ? studentIdFromBody : user.id;

  if (!targetStudentId) {
    return NextResponse.json(
      { ok: false, message: "대상 학생 정보가 필요합니다." },
      { status: 400 }
    );
  }

  if (user.role !== "admin" && targetStudentId !== user.id) {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  const nextStudentNoteRaw =
    body.studentNote === undefined ? undefined : String(body.studentNote ?? "");
  const nextAdminCommentRaw =
    body.adminComment === undefined ? undefined : String(body.adminComment ?? "");

  if (user.role !== "admin" && nextAdminCommentRaw !== undefined) {
    return NextResponse.json(
      { ok: false, message: "학생은 관리자 댓글을 수정할 수 없습니다." },
      { status: 403 }
    );
  }

  if (nextStudentNoteRaw === undefined && nextAdminCommentRaw === undefined) {
    return NextResponse.json(
      { ok: false, message: "수정할 내용이 없습니다." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const safeRound = Math.round(round);

  const { data: existing, error: existingError } = await supabase
    .from("season_feedback_notes")
    .select(
      "id, student_note, admin_comment, note_updated_at, note_updated_by_role, admin_comment_updated_at, created_at"
    )
    .eq("student_id", targetStudentId)
    .eq("season", season)
    .eq("round", safeRound)
    .maybeSingle();

  if (existingError && existingError.code !== "PGRST116") {
    return NextResponse.json(
      { ok: false, message: "기존 메모를 확인하지 못했습니다." },
      { status: 500 }
    );
  }

  const nextStudentNote = nextStudentNoteRaw?.slice(0, 4000);
  const nextAdminComment = nextAdminCommentRaw?.slice(0, 4000);
  const previousAdminComment = existing?.admin_comment ?? "";

  const updatePayload: Record<string, unknown> = {
    updated_at: now,
  };

  if (nextStudentNote !== undefined) {
    updatePayload.student_note = nextStudentNote;
    updatePayload.note_updated_at = now;
    updatePayload.note_updated_by_role = user.role;
  }

  if (user.role === "admin" && nextAdminComment !== undefined) {
    updatePayload.admin_comment = nextAdminComment;
    updatePayload.admin_comment_updated_at = now;
  }

  let savedId: number | null = null;

  if (existing?.id) {
    const { data: updated, error: updateError } = await supabase
      .from("season_feedback_notes")
      .update(updatePayload)
      .eq("id", existing.id)
      .select("id")
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { ok: false, message: `메모 저장 실패: ${updateError?.message || "unknown"}` },
        { status: 500 }
      );
    }

    savedId = Number(updated.id);
  } else {
    const insertPayload = {
      student_id: targetStudentId,
      season,
      round: safeRound,
      student_note: nextStudentNote ?? "",
      admin_comment: user.role === "admin" ? nextAdminComment ?? "" : "",
      note_updated_at: nextStudentNote !== undefined ? now : null,
      note_updated_by_role: nextStudentNote !== undefined ? user.role : null,
      admin_comment_updated_at:
        user.role === "admin" && nextAdminComment !== undefined ? now : null,
      created_at: now,
      updated_at: now,
    };

    const { data: inserted, error: insertError } = await supabase
      .from("season_feedback_notes")
      .insert(insertPayload)
      .select("id")
      .single();

    if (insertError || !inserted) {
      return NextResponse.json(
        { ok: false, message: `메모 저장 실패: ${insertError?.message || "unknown"}` },
        { status: 500 }
      );
    }

    savedId = Number(inserted.id);
  }

  if (user.role === "admin") {
    await supabase.from("admin_action_logs").insert({
      admin_id: user.id,
      action_type: "season_feedback_note_update",
      target_student_id: targetStudentId,
      reason: `${season} ${safeRound} 메모/댓글 수정`,
      before_data: null,
      after_data: {
        noteId: savedId,
        season,
        round: safeRound,
        studentNoteUpdated: nextStudentNote !== undefined,
        adminCommentUpdated: nextAdminComment !== undefined,
      },
      created_at: now,
    });

    const shouldNotifyAdminComment =
      nextAdminComment !== undefined &&
      nextAdminComment.trim().length > 0 &&
      nextAdminComment.trim() !== previousAdminComment.trim();

    if (shouldNotifyAdminComment) {
      try {
        await createAdminCommentNotification(supabase, {
          studentId: targetStudentId,
          season,
          round: safeRound,
          comment: nextAdminComment,
          createdBy: user.id,
        });
      } catch (error) {
        console.error("[notifications] admin comment notification failed", error);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    message: "메모를 저장했습니다.",
  });
}
