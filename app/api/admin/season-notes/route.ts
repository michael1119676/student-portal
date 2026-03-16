import { NextResponse } from "next/server";
import { getSessionUserFromCookies, requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

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

  if (!hasAdminComment) {
    return {
      hasAdminComment: false,
      status: "미댓글" as const,
    };
  }

  return {
    hasAdminComment: true,
    status:
      row.note_updated_by_role === "student" &&
      Number.isFinite(noteUpdatedAt) &&
      Number.isFinite(adminCommentUpdatedAt) &&
      noteUpdatedAt > adminCommentUpdatedAt
        ? ("갱신됨" as const)
        : ("댓글 완료" as const),
  };
}

export async function GET(request: Request) {
  const user = await getSessionUserFromCookies();
  const adminError = requireAdmin(user);
  if (adminError) return adminError;

  const url = new URL(request.url);
  const query = String(url.searchParams.get("q") || "")
    .trim()
    .toLowerCase();

  const supabase = createAdminClient();
  const { data: noteRows, error: noteError } = await supabase
    .from("season_feedback_notes")
    .select(
      "id, student_id, season, round, student_note, admin_comment, note_updated_at, note_updated_by_role, admin_comment_updated_at, created_at, updated_at"
    )
    .order("note_updated_at", { ascending: false, nullsFirst: false })
    .limit(500);

  if (noteError) {
    return NextResponse.json(
      { ok: false, message: "메모 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }

  const studentIds = [...new Set((noteRows ?? []).map((row) => row.student_id))];
  const { data: students, error: studentError } = await supabase
    .from("students")
    .select("id, name, phone, class_name")
    .in("id", studentIds.length > 0 ? studentIds : ["00000000-0000-0000-0000-000000000000"]);

  if (studentError) {
    return NextResponse.json(
      { ok: false, message: "학생 정보를 불러오지 못했습니다." },
      { status: 500 }
    );
  }

  const studentMap = new Map(
    (students ?? []).map((student) => [
      student.id,
      {
        name: student.name,
        phone: student.phone,
        className: student.class_name,
      },
    ])
  );

  const items = (noteRows ?? [])
    .filter((row) => row.student_note.trim().length > 0)
    .map((row) => {
      const student = studentMap.get(row.student_id);
      const status = buildStatus(row);
      return {
        id: Number(row.id),
        studentId: row.student_id,
        studentName: student?.name ?? "알 수 없음",
        studentPhone: student?.phone ?? "",
        className: student?.className ?? null,
        season: row.season,
        round: Number(row.round),
        studentNote: row.student_note,
        adminComment: row.admin_comment,
        noteUpdatedAt: row.note_updated_at,
        noteUpdatedByRole: row.note_updated_by_role,
        adminCommentUpdatedAt: row.admin_comment_updated_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        hasAdminComment: status.hasAdminComment,
        status: status.status,
      };
    })
    .filter((item) => {
      if (!query) return true;
      return `${item.studentName} ${item.studentPhone} ${item.season} ${item.round}`
        .toLowerCase()
        .includes(query);
    });

  return NextResponse.json({
    ok: true,
    items,
  });
}
