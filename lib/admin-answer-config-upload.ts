import { parse as parseCsv } from "csv-parse/sync";
import * as XLSX from "xlsx";
import {
  buildAnswerConfigTemplateRows,
  fetchSeasonAnswerConfigMap,
  resolveSeasonAnswerConfig,
  type AnswerConfigMap,
  type AnswerScoreMode,
  type AnswerUploadSeason,
} from "@/lib/season-answer-config";
import { createAdminClient } from "@/lib/supabase/admin";

type ParsedAnswerConfigRow = {
  rowNumber: number;
  question: number | null;
  answer: number | null;
  weight: number | null;
};

export type AdminAnswerConfigPreviewRow = ParsedAnswerConfigRow & {
  status: "valid" | "invalid";
  reason: string | null;
};

export type AdminAnswerConfigPreview = {
  season: AnswerUploadSeason;
  round: number;
  fileName: string;
  questionCount: number;
  validCount: number;
  invalidCount: number;
  totalWeight: number;
  scoreMode: AnswerScoreMode;
  answerKeyPreview: string;
  rows: AdminAnswerConfigPreviewRow[];
};

export type AdminAnswerConfigApplyResult = AdminAnswerConfigPreview & {
  logs: string[];
};

function normalizeChoice(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const rounded = Math.round(numeric);
  if (rounded < 1 || rounded > 5) return null;
  return rounded;
}

function normalizePositiveNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric;
}

function getFileExtension(fileName: string) {
  const lower = fileName.trim().toLowerCase();
  const index = lower.lastIndexOf(".");
  return index >= 0 ? lower.slice(index) : "";
}

function getObjectValue(
  row: Record<string, unknown>,
  candidates: string[]
): unknown {
  for (const key of candidates) {
    if (key in row) return row[key];
  }
  return null;
}

function parseAnswerConfigRows(fileName: string, fileBuffer: Buffer) {
  const extension = getFileExtension(fileName);
  let rows: Record<string, unknown>[] = [];

  if (extension === ".csv") {
    rows = parseCsv(fileBuffer.toString("utf-8"), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, unknown>[];
  } else if (extension === ".xlsx" || extension === ".xls") {
    const workbook = XLSX.read(fileBuffer, {
      type: "buffer",
      cellDates: true,
    });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error("엑셀 시트를 찾을 수 없습니다.");
    }

    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheetName], {
      defval: null,
      raw: true,
    });
  } else {
    throw new Error("지원하지 않는 파일 형식입니다. .csv 또는 .xlsx 파일만 업로드해 주세요.");
  }

  return rows.map((row, index) => ({
    rowNumber: index + 2,
    question: normalizePositiveNumber(
      getObjectValue(row, ["문항", "번호", "question", "q"])
    ),
    answer: normalizeChoice(getObjectValue(row, ["정답", "answer", "ans"])),
    weight: normalizePositiveNumber(getObjectValue(row, ["배점", "점수", "weight"])),
  })) as ParsedAnswerConfigRow[];
}

function validateAnswerConfigRows(
  season: AnswerUploadSeason,
  parsedRows: ParsedAnswerConfigRow[]
) {
  const seenQuestions = new Set<number>();
  const rows: AdminAnswerConfigPreviewRow[] = [];
  const validRows = new Map<number, { answer: number; weight: number }>();
  const logs: string[] = [];

  for (const row of parsedRows) {
    let reason: string | null = null;

    if (!row.question || !Number.isFinite(row.question)) {
      reason = "문항 번호가 올바르지 않습니다.";
    } else if (!row.answer) {
      reason = "정답은 1~5 사이여야 합니다.";
    } else if (!row.weight) {
      reason = "배점은 0보다 커야 합니다.";
    } else if (seenQuestions.has(Math.round(row.question))) {
      reason = "같은 문항이 중복되었습니다.";
    }

    if (reason) {
      rows.push({
        ...row,
        status: "invalid",
        reason,
      });
      logs.push(`${row.rowNumber}행: ${reason}`);
      continue;
    }

    const safeQuestion = Math.round(row.question);
    const safeAnswer = Math.round(row.answer);
    const safeWeight = Number(row.weight);

    seenQuestions.add(safeQuestion);
    validRows.set(safeQuestion, {
      answer: safeAnswer,
      weight: safeWeight,
    });

    rows.push({
      rowNumber: row.rowNumber,
      question: safeQuestion,
      answer: safeAnswer,
      weight: safeWeight,
      status: "valid",
      reason: null,
    });
  }

  const maxQuestion = validRows.size > 0 ? Math.max(...validRows.keys()) : 0;
  const missingQuestions: number[] = [];
  for (let question = 1; question <= maxQuestion; question += 1) {
    if (!validRows.has(question)) {
      missingQuestions.push(question);
    }
  }

  if (missingQuestions.length > 0) {
    logs.push(`누락 문항: ${missingQuestions.join(", ")}`);
  }

  if (season === "N" && validRows.size > 0) {
    const totalWeight = [...validRows.values()].reduce(
      (sum, row) => sum + row.weight,
      0
    );
    if (totalWeight <= 0) {
      logs.push("총 배점이 0점 이하입니다.");
    }
  }

  const answerKey = Array.from({ length: maxQuestion }, (_, index) => {
    const current = validRows.get(index + 1);
    return current?.answer ?? 0;
  });
  const questionWeights = Array.from({ length: maxQuestion }, (_, index) => {
    const current = validRows.get(index + 1);
    return current?.weight ?? 0;
  });

  return {
    rows,
    logs,
    answerKey,
    questionWeights,
    questionCount: maxQuestion,
  };
}

export async function buildAdminAnswerConfigPreview(options: {
  season: AnswerUploadSeason;
  round: number;
  fileName: string;
  fileBuffer: Buffer;
}) {
  const parsedRows = parseAnswerConfigRows(options.fileName, options.fileBuffer);
  const validated = validateAnswerConfigRows(options.season, parsedRows);
  const invalidCount = validated.rows.filter((row) => row.status === "invalid").length;
  const validCount = validated.rows.length - invalidCount;
  const totalWeight = validated.questionWeights.reduce((sum, weight) => sum + weight, 0);
  const scoreMode: AnswerScoreMode = options.season === "N" ? "weighted" : "percent100";

  return {
    season: options.season,
    round: Math.round(options.round),
    fileName: options.fileName,
    questionCount: validated.questionCount,
    validCount,
    invalidCount,
    totalWeight,
    scoreMode,
    answerKeyPreview: validated.answerKey.filter((value) => value > 0).join(""),
    rows: validated.rows.sort((a, b) => {
      const aQuestion = a.question ?? Number.MAX_SAFE_INTEGER;
      const bQuestion = b.question ?? Number.MAX_SAFE_INTEGER;
      return aQuestion - bQuestion || a.rowNumber - b.rowNumber;
    }),
    answerKey: validated.answerKey,
    questionWeights: validated.questionWeights,
    validationLogs: validated.logs,
  };
}

export async function applyAdminAnswerConfigUpload(options: {
  season: AnswerUploadSeason;
  round: number;
  fileName: string;
  fileBuffer: Buffer;
  adminId: string;
}) {
  const supabase = createAdminClient();
  const preview = await buildAdminAnswerConfigPreview(options);
  const logs = [...preview.validationLogs];

  if (preview.invalidCount > 0) {
    throw new Error("유효하지 않은 행이 있어 저장할 수 없습니다. 미리보기에서 오류를 확인해 주세요.");
  }

  if (preview.questionCount === 0) {
    throw new Error("저장할 정답/배점 데이터가 없습니다.");
  }

  const now = new Date().toISOString();
  const payload = {
    season: options.season,
    round: Math.round(options.round),
    question_count: preview.questionCount,
    answer_key: preview.answerKey,
    question_weights: preview.questionWeights,
    score_mode: preview.scoreMode,
    source_filename: options.fileName,
    uploaded_by: options.adminId,
    updated_at: now,
  };

  const { error } = await supabase.from("season_answer_configs").upsert(payload, {
    onConflict: "season,round",
  });

  if (error) {
    if (
      error.code === "42P01" ||
      /season_answer_configs/i.test(error.message) ||
      /season_answer_configs/i.test(error.details || "")
    ) {
      throw new Error(
        "정답/배점 업로드 테이블이 아직 없습니다. Supabase SQL Editor에서 create_season_answer_configs.sql을 먼저 실행해 주세요."
      );
    }
    throw new Error("정답/배점 설정 저장에 실패했습니다.");
  }

  await supabase.from("admin_action_logs").insert({
    admin_id: options.adminId,
    action_type: "answer_config_upload_apply",
    reason: `${options.season} 시즌 ${options.round}회 정답/배점 업로드 적용`,
    before_data: null,
    after_data: {
      season: options.season,
      round: options.round,
      questionCount: preview.questionCount,
      totalWeight: preview.totalWeight,
      scoreMode: preview.scoreMode,
      fileName: options.fileName,
      answerKeyPreview: preview.answerKeyPreview,
    },
    created_at: now,
  });

  logs.push(
    `${options.season} 시즌 ${options.round}회 정답/배점 저장 완료 (${preview.questionCount}문항)`
  );

  return {
    season: preview.season,
    round: preview.round,
    fileName: preview.fileName,
    questionCount: preview.questionCount,
    validCount: preview.validCount,
    invalidCount: preview.invalidCount,
    totalWeight: preview.totalWeight,
    scoreMode: preview.scoreMode,
    answerKeyPreview: preview.answerKeyPreview,
    rows: preview.rows,
    logs,
  } satisfies AdminAnswerConfigApplyResult;
}

export async function buildAnswerConfigTemplateFile(options: {
  season: AnswerUploadSeason;
  round: number;
  format: "csv" | "xlsx";
}) {
  const overrides: AnswerConfigMap = await fetchSeasonAnswerConfigMap(options.season);
  const config = resolveSeasonAnswerConfig(options.season, options.round, overrides);
  const rows = buildAnswerConfigTemplateRows(options.season, options.round, overrides);

  if (options.format === "csv") {
    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: ["문항", "정답", "배점"],
    });
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    return {
      contentType: "text/csv; charset=utf-8",
      fileName: `answer-config-template-${options.season}-${options.round}.csv`,
      body: Buffer.from(csv, "utf-8"),
      meta: config,
    };
  }

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: ["문항", "정답", "배점"],
  });
  XLSX.utils.book_append_sheet(workbook, worksheet, "정답배점 템플릿");
  const body = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;

  return {
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    fileName: `answer-config-template-${options.season}-${options.round}.xlsx`,
    body,
    meta: config,
  };
}
