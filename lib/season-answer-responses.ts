import { createAdminClient } from "@/lib/supabase/admin";

export type UploadedAnswerRow = {
  name: string;
  className: string;
  timestamp: string;
  score: number | null;
  answers: Array<number | null>;
};

function normalizeClassName(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  if (!normalized) return "미분류";
  if (normalized === "녹화강의반") return "영상반";
  return normalized;
}

function normalizeChoice(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const rounded = Math.round(numeric);
  if (rounded < 1 || rounded > 5) return null;
  return rounded;
}

export async function fetchUploadedAnswerRowsByRound(
  season: "C" | "N"
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("season_answer_responses")
    .select(
      "round, student_name_snapshot, class_name_snapshot, submitted_at, score, answers"
    )
    .eq("season", season);

  if (error) {
    throw new Error(`${season} 시즌 업로드 답안을 불러오지 못했습니다.`);
  }

  const rowsByRound: Record<number, UploadedAnswerRow[]> = {};

  for (const row of data ?? []) {
    const round = Number(row.round);
    if (!Number.isFinite(round)) continue;
    const list = rowsByRound[Math.round(round)] ?? [];
    const answers = Array.isArray(row.answers)
      ? row.answers.map((value) => normalizeChoice(value))
      : [];

    list.push({
      name: String(row.student_name_snapshot || "").trim(),
      className: normalizeClassName(row.class_name_snapshot),
      timestamp: row.submitted_at || new Date(0).toISOString(),
      score: row.score === null || row.score === undefined ? null : Number(row.score),
      answers,
    });
    rowsByRound[Math.round(round)] = list;
  }

  return rowsByRound;
}
