import { parse as parseCsv } from "csv-parse/sync";
import * as XLSX from "xlsx";
import seasonCRoundsRaw from "@/data/season_c_rounds.json";
import seasonNRoundsRaw from "@/data/season_n_rounds.json";
import { createStudentScoreNotification } from "@/lib/notifications";
import {
  fetchSeasonAnswerConfigMap,
  getSeasonAnswerKey,
  getSeasonQuestionCount,
  scoreAnswersForSeason,
  type AnswerConfigMap,
  type AnswerUploadSeason,
} from "@/lib/season-answer-config";
import { createAdminClient } from "@/lib/supabase/admin";

type UploadSeason = "C" | "N" | "DP" | "SP" | "EA" | "M";

type StudentRef = {
  id: string;
  name: string;
  phone: string;
  class_name: string | null;
  is_deleted?: boolean | null;
};

type ParsedUploadRow = {
  rowNumber: number;
  sourceType: "omr_csv" | "answer_sheet_xlsx";
  timestamp: string | null;
  name: string | null;
  className: string | null;
  phoneDigits: string | null;
  phoneSuffix8: string | null;
  phoneSuffix4: string | null;
  score: number | null;
  answers: Array<number | null>;
};

export type AdminScoreUploadPreviewRow = {
  rowNumber: number;
  status: "new" | "update" | "match_failed";
  studentId: string | null;
  studentName: string | null;
  phone: string | null;
  className: string | null;
  score: number | null;
  sourceType: ParsedUploadRow["sourceType"];
  matchedBy: "phone8" | "phone4" | "name_class" | "name" | null;
  reason: string | null;
};

export type AdminScoreUploadPreview = {
  season: UploadSeason;
  round: number;
  fileName: string;
  totalRows: number;
  matchedCount: number;
  newCount: number;
  updateCount: number;
  matchFailedCount: number;
  rows: AdminScoreUploadPreviewRow[];
};

export type AdminScoreUploadApplyResult = AdminScoreUploadPreview & {
  insertedCount: number;
  updatedCountApplied: number;
  answerSavedCount: number;
  awardedCoinCount: number;
  logs: string[];
};

type PreparedUploadRow = ParsedUploadRow & {
  studentId: string | null;
  studentName: string | null;
  studentPhone: string | null;
  classNameResolved: string | null;
  matchedBy: AdminScoreUploadPreviewRow["matchedBy"];
  reason: string | null;
  isNewScoreRecord: boolean;
};

type ExistingScoreRecord = {
  id: number;
  student_id: string;
  season: string;
  round: number;
};

type LocalSeasonAnswerRow = {
  name: string;
  className: string;
  timestamp?: string | null;
};

type LocalSeasonRoundsSource = {
  rounds?: Record<
    string,
    {
      rows?: LocalSeasonAnswerRow[];
    }
  >;
};

type SeasonAnswerUploadRow = {
  student_id: string;
  season: AnswerUploadSeason;
  round: number;
  student_name_snapshot: string;
  student_phone_snapshot: string;
  class_name_snapshot: string | null;
  submitted_at: string;
  score: number | null;
  answers: number[];
  source_type: string;
  source_filename: string;
  uploaded_by: string;
  updated_at: string;
};

function normalizePhone(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeClassName(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  if (normalized === "녹화강의반") return "영상반";
  return normalized;
}

function normalizeStudentName(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  if (normalized === "김아안") return "김이안";
  if (normalized === "임국혁") return "임국현";
  return normalized;
}

function normalizeChoice(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const rounded = Math.round(numeric);
  if (rounded < 1 || rounded > 5) return null;
  return rounded;
}

function normalizeScore(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.round(numeric);
}

function toIsoTimestamp(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  const stringValue = String(value || "").trim();
  if (!stringValue) return null;
  const date = new Date(stringValue);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
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

function getObjectValueContaining(
  row: Record<string, unknown>,
  keywords: string[]
): unknown {
  const normalizedKeywords = keywords.map((keyword) => keyword.trim());
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = String(key || "").trim();
    if (!normalizedKey) continue;
    if (normalizedKeywords.every((keyword) => normalizedKey.includes(keyword))) {
      return value;
    }
  }
  return null;
}

function parseOmrCsvFile(
  season: UploadSeason,
  round: number,
  fileName: string,
  buffer: Buffer,
  answerConfigMap?: AnswerConfigMap
) {
  if (season !== "N" && season !== "C") {
    throw new Error("OMR CSV 업로드는 현재 C/N 시즌에서만 지원합니다.");
  }

  const records = parseCsv(buffer.toString("utf-8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  const answerKey = getSeasonAnswerKey(
    season as AnswerUploadSeason,
    round,
    answerConfigMap
  );
  const questionCount =
    getSeasonQuestionCount(season as AnswerUploadSeason, round, answerConfigMap) || 20;
  if (!answerKey?.length) {
    throw new Error(
      `${season} 시즌 ${round}회 정답 키가 등록되지 않아 CSV 점수를 계산할 수 없습니다.`
    );
  }

  return records.map((record, index) => {
    const rawId = normalizePhone(record.id);
    const answers = Array.from({ length: questionCount }, (_, questionIndex) =>
      normalizeChoice(record[`q${questionIndex + 1}`])
    );
    const score = scoreAnswersForSeason(
      season as AnswerUploadSeason,
      round,
      answers,
      answerConfigMap
    );
    if (score === null) {
      throw new Error(`${fileName} ${index + 2}행의 점수를 계산하지 못했습니다.`);
    }

    return {
      rowNumber: index + 2,
      sourceType: "omr_csv" as const,
      timestamp: null,
      name: null,
      className: null,
      phoneDigits: rawId || null,
      phoneSuffix8: rawId.length >= 8 ? rawId.slice(-8) : null,
      phoneSuffix4: rawId.length >= 4 ? rawId.slice(-4) : null,
      score,
      answers,
    } satisfies ParsedUploadRow;
  });
}

function parseAnswerSheetWorkbook(
  fileName: string,
  buffer: Buffer
) {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
  });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("엑셀 시트를 찾을 수 없습니다.");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: true,
  });

  return rows.map((row, index) => {
    const explicitScoreValue = getObjectValue(row, [
      "점수",
      "score",
      "원점수",
      "물리2 원점수",
      "물2 원점수",
    ]);
    const inferredScoreValue =
      explicitScoreValue ??
      getObjectValueContaining(row, ["원점수"]) ??
      getObjectValueContaining(row, ["점수"]);
    const answers = Array.from({ length: 20 }, (_, questionIndex) =>
      normalizeChoice(row[`${questionIndex + 1}번 답`])
    );
    return {
      rowNumber: index + 2,
      sourceType: "answer_sheet_xlsx" as const,
      timestamp: toIsoTimestamp(getObjectValue(row, ["타임스탬프", "timestamp"])),
      name: String(getObjectValue(row, ["성함", "이름", "name"]) || "").trim() || null,
      className:
        normalizeClassName(
          String(getObjectValue(row, ["반", "class", "className"]) || "")
        ) || null,
      phoneDigits:
        normalizePhone(
          String(
            getObjectValue(row, ["전화번호", "핸드폰", "연락처", "phone", "id"]) || ""
          )
        ) || null,
      phoneSuffix8: null,
      phoneSuffix4: null,
      score: normalizeScore(inferredScoreValue),
      answers,
    } satisfies ParsedUploadRow;
  }).map((row) => ({
    ...row,
    phoneSuffix8: row.phoneDigits && row.phoneDigits.length >= 8 ? row.phoneDigits.slice(-8) : null,
    phoneSuffix4: row.phoneDigits && row.phoneDigits.length >= 4 ? row.phoneDigits.slice(-4) : null,
  }));
}

function parseUploadRows(
  season: UploadSeason,
  round: number,
  fileName: string,
  buffer: Buffer,
  answerConfigMap?: AnswerConfigMap
) {
  const extension = getFileExtension(fileName);
  if (extension === ".csv") {
    return parseOmrCsvFile(season, round, fileName, buffer, answerConfigMap);
  }

  if (extension === ".xlsx" || extension === ".xls") {
    return parseAnswerSheetWorkbook(fileName, buffer);
  }

  throw new Error("지원하지 않는 파일 형식입니다. .csv 또는 .xlsx 파일만 업로드해 주세요.");
}

function matchByPhoneSuffix(
  students: StudentRef[],
  suffix: string | null
) {
  if (!suffix) return [];
  return students.filter((student) => normalizePhone(student.phone).endsWith(suffix));
}

function chooseStudentForLocalRow(
  students: StudentRef[],
  row: LocalSeasonAnswerRow
) {
  const name = normalizeStudentName(row.name);
  const className = normalizeClassName(row.className);
  const candidates = students.filter(
    (student) => normalizeStudentName(student.name) === name
  );

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const classMatched = className
    ? candidates.filter(
        (student) => normalizeClassName(student.class_name) === className
      )
    : [];

  if (classMatched.length === 1) return classMatched[0];
  return candidates[0];
}

function getLocalSeasonRows(
  season: UploadSeason,
  round: number
): LocalSeasonAnswerRow[] {
  const cRounds = seasonCRoundsRaw as LocalSeasonRoundsSource;
  const nRounds = seasonNRoundsRaw as LocalSeasonRoundsSource;
  if (season === "C") {
    return cRounds.rounds?.[String(round)]?.rows ?? [];
  }
  if (season === "N") {
    return nRounds.rounds?.[String(round)]?.rows ?? [];
  }
  return [];
}

function buildLocalExistingStudentIds(
  season: UploadSeason,
  round: number,
  students: StudentRef[]
) {
  if (season !== "C" && season !== "N") {
    return new Set<string>();
  }

  const latestRows = new Map<string, LocalSeasonAnswerRow>();
  for (const row of getLocalSeasonRows(season, round)) {
    const key = `${normalizeStudentName(row.name)}__${normalizeClassName(row.className) ?? ""}`;
    const prev = latestRows.get(key);
    const currentTime = row.timestamp ? Date.parse(row.timestamp) : 0;
    const prevTime = prev?.timestamp ? Date.parse(prev.timestamp) : 0;
    if (!prev || currentTime >= prevTime) {
      latestRows.set(key, row);
    }
  }

  const studentIds = new Set<string>();
  for (const row of latestRows.values()) {
    const matchedStudent = chooseStudentForLocalRow(students, row);
    if (matchedStudent?.id) {
      studentIds.add(matchedStudent.id);
    }
  }
  return studentIds;
}

function prepareRows(
  season: UploadSeason,
  round: number,
  parsedRows: ParsedUploadRow[],
  students: StudentRef[],
  existingRecords: ExistingScoreRecord[],
  answerConfigMap?: AnswerConfigMap
) {
  const activeStudents = students.filter((student) => !student.is_deleted);
  const localExistingStudentIds = buildLocalExistingStudentIds(
    season,
    round,
    activeStudents
  );
  const recordsByStudentId = new Set(
    existingRecords
      .filter(
        (record) =>
          record.season.toUpperCase() === season && Math.round(record.round) === Math.round(round)
      )
      .map((record) => record.student_id)
  );
  for (const studentId of localExistingStudentIds) {
    recordsByStudentId.add(studentId);
  }

  const studentsByName = new Map<string, StudentRef[]>();
  for (const student of activeStudents) {
    const key = normalizeStudentName(student.name);
    const list = studentsByName.get(key) ?? [];
    list.push(student);
    studentsByName.set(key, list);
  }

  const prepared = parsedRows.map((row) => {
    let matchedStudents: StudentRef[] = [];
    let matchedBy: AdminScoreUploadPreviewRow["matchedBy"] = null;
    let reason: string | null = null;

    if (row.phoneDigits) {
      if (row.phoneDigits.length >= 8) {
        matchedStudents = matchByPhoneSuffix(activeStudents, row.phoneSuffix8);
        matchedBy = matchedStudents.length === 1 ? "phone8" : null;
      }
      if (matchedStudents.length === 0 && row.phoneDigits.length >= 4) {
        matchedStudents = matchByPhoneSuffix(activeStudents, row.phoneSuffix4);
        matchedBy = matchedStudents.length === 1 ? "phone4" : null;
      }

      if (matchedStudents.length > 1) {
        reason = "전화번호 끝자리로 여러 학생이 매칭되었습니다.";
        matchedStudents = [];
        matchedBy = null;
      }
    }

    if (matchedStudents.length === 0 && row.name) {
      const candidates = studentsByName.get(normalizeStudentName(row.name)) ?? [];
      if (candidates.length === 1) {
        matchedStudents = candidates;
        matchedBy = "name";
      } else if (candidates.length > 1) {
        const normalizedClass = normalizeClassName(row.className);
        const classMatched = normalizedClass
          ? candidates.filter(
              (candidate) =>
                normalizeClassName(candidate.class_name) === normalizedClass
            )
          : [];
        if (classMatched.length === 1) {
          matchedStudents = classMatched;
          matchedBy = "name_class";
        } else {
          reason = normalizedClass
            ? "이름/반으로 학생을 하나로 특정하지 못했습니다."
            : "동명이인이 있어 반 정보가 필요합니다.";
        }
      }
    }

    const matchedStudent = matchedStudents[0] ?? null;
    if (!matchedStudent && !reason) {
      reason = row.phoneDigits
        ? "전화번호 매칭에 실패했습니다."
        : "학생 이름 매칭에 실패했습니다.";
    }

    const score =
      row.score !== null
        ? row.score
        : season === "C" || season === "N"
          ? scoreAnswersForSeason(season, round, row.answers, answerConfigMap)
          : null;

    return {
      ...row,
      studentId: matchedStudent?.id ?? null,
      studentName: matchedStudent?.name ?? row.name,
      studentPhone: matchedStudent?.phone ?? null,
      classNameResolved:
        normalizeClassName(matchedStudent?.class_name) ??
        normalizeClassName(row.className),
      matchedBy,
      reason,
      score,
      isNewScoreRecord: matchedStudent ? !recordsByStudentId.has(matchedStudent.id) : false,
    } satisfies PreparedUploadRow;
  });

  return prepared;
}

export async function buildAdminScoreUploadPreview(options: {
  season: UploadSeason;
  round: number;
  fileName: string;
  fileBuffer: Buffer;
}) {
  const supabase = createAdminClient();
  const { season, round, fileName, fileBuffer } = options;
  const answerConfigMap =
    season === "C" || season === "N"
      ? await fetchSeasonAnswerConfigMap(season)
      : undefined;
  const parsedRows = parseUploadRows(
    season,
    round,
    fileName,
    fileBuffer,
    answerConfigMap
  );

  const { data: students, error: studentError } = await supabase
    .from("students")
    .select("id, name, phone, class_name, is_deleted")
    .eq("role", "student");

  if (studentError || !students) {
    throw new Error("학생 목록을 불러오지 못했습니다.");
  }

  const { data: existingRecords, error: recordError } = await supabase
    .from("exam_score_records")
    .select("id, student_id, season, round")
    .eq("season", season)
    .eq("round", round);

  if (recordError) {
    throw new Error("기존 성적 레코드를 확인하지 못했습니다.");
  }

  const preparedRows = prepareRows(
    season,
    round,
    parsedRows,
    students as StudentRef[],
    (existingRecords ?? []) as ExistingScoreRecord[],
    answerConfigMap
  );

  const rows: AdminScoreUploadPreviewRow[] = preparedRows.map((row) => ({
    rowNumber: row.rowNumber,
    status: row.studentId ? (row.isNewScoreRecord ? "new" : "update") : "match_failed",
    studentId: row.studentId,
    studentName: row.studentName,
    phone: row.studentPhone,
    className: row.classNameResolved,
    score: row.score,
    sourceType: row.sourceType,
    matchedBy: row.matchedBy,
    reason: row.reason,
  }));

  return {
    season,
    round,
    fileName,
    totalRows: rows.length,
    matchedCount: rows.filter((row) => row.status !== "match_failed").length,
    newCount: rows.filter((row) => row.status === "new").length,
    updateCount: rows.filter((row) => row.status === "update").length,
    matchFailedCount: rows.filter((row) => row.status === "match_failed").length,
    rows,
    preparedRows,
  };
}

export async function applyAdminScoreUpload(options: {
  season: UploadSeason;
  round: number;
  fileName: string;
  fileBuffer: Buffer;
  adminId: string;
}) {
  const supabase = createAdminClient();
  const preview = await buildAdminScoreUploadPreview(options);
  const now = new Date().toISOString();
  const processableRows = preview.preparedRows.filter(
    (row) => row.studentId && row.score !== null
  );
  const answerSeason = options.season === "C" || options.season === "N";
  const logs: string[] = [];
  let insertedCount = 0;
  let updatedCountApplied = 0;
  let answerSavedCount = 0;
  let awardedCoinCount = 0;

  for (const row of processableRows) {
    const studentId = row.studentId as string;
    const score = row.score as number;
    const sourceKey = `upload:${studentId}:${options.season}:${options.round}`;

    const { data: existing, error: existingError } = await supabase
      .from("exam_score_records")
      .select("id")
      .eq("student_id", studentId)
      .eq("season", options.season)
      .eq("round", options.round)
      .maybeSingle();

    if (existingError && existingError.code !== "PGRST116") {
      logs.push(`${row.studentName}: 기존 성적 확인 실패`);
      continue;
    }

    const shouldTreatAsUpdate = Boolean(existing?.id) || !row.isNewScoreRecord;

    if (shouldTreatAsUpdate) {
      if (existing?.id) {
        const { error: updateError } = await supabase
          .from("exam_score_records")
          .update({
            score,
            source_key: sourceKey,
            recorded_by: options.adminId,
            updated_at: now,
          })
          .eq("id", existing.id);

        if (updateError) {
          logs.push(`${row.studentName}: 성적 수정 실패`);
          continue;
        }
      }

      updatedCountApplied += 1;
      logs.push(
        existing?.id
          ? `${row.studentName}: 성적 수정 완료 (${score}점)`
          : `${row.studentName}: 기존 데이터 기준으로 답안/성적 갱신 처리 (${score}점)`
      );

      await supabase.from("admin_action_logs").insert({
        admin_id: options.adminId,
        action_type: existing?.id ? "score_record_update" : "score_upload_existing_sync",
        target_student_id: studentId,
        reason: existing?.id
          ? `${options.season} 시즌 ${options.round}회 파일 업로드 성적 수정`
          : `${options.season} 시즌 ${options.round}회 기존 응답 데이터 동기화`,
        before_data: null,
        after_data: {
          season: options.season,
          round: options.round,
          score,
          sourceKey,
          sourceType: row.sourceType,
          rowNumber: row.rowNumber,
          existingScoreRecord: Boolean(existing?.id),
        },
        created_at: now,
      });
    } else {
      const { error: insertError } = await supabase.from("exam_score_records").insert({
        student_id: studentId,
        season: options.season,
        round: options.round,
        score,
        source_key: sourceKey,
        recorded_by: options.adminId,
        created_at: now,
        updated_at: now,
      });

      if (insertError) {
        logs.push(`${row.studentName}: 성적 신규 입력 실패`);
        continue;
      }

      insertedCount += 1;
      if (options.season !== "SP") awardedCoinCount += 1;
      logs.push(
        `${row.studentName}: 성적 신규 입력 완료 (${score}점${
          options.season !== "SP" ? ", 코인 +1" : ""
        })`
      );

      await supabase.from("admin_action_logs").insert({
        admin_id: options.adminId,
        action_type: "score_record_insert",
        target_student_id: studentId,
        reason: `${options.season} 시즌 ${options.round}회 파일 업로드 성적 신규 입력`,
        before_data: null,
        after_data: {
          season: options.season,
          round: options.round,
          score,
          sourceKey,
          sourceType: row.sourceType,
          rowNumber: row.rowNumber,
        },
        created_at: now,
      });

      try {
        await createStudentScoreNotification(supabase, {
          studentId,
          season: options.season,
          round: options.round,
          score,
          createdBy: options.adminId,
        });
      } catch (error) {
        console.error("[notifications] score upload notification failed", error);
      }
    }

    if (answerSeason && row.answers.some((answer) => answer !== null)) {
      const payload: SeasonAnswerUploadRow = {
        student_id: studentId,
        season: options.season as AnswerUploadSeason,
        round: options.round,
        student_name_snapshot: row.studentName || "",
        student_phone_snapshot: row.studentPhone || "",
        class_name_snapshot: row.classNameResolved,
        submitted_at: row.timestamp || now,
        score,
        answers: row.answers.map((answer) => answer ?? 0),
        source_type: row.sourceType,
        source_filename: options.fileName,
        uploaded_by: options.adminId,
        updated_at: now,
      };

      const { error: answerError } = await supabase
        .from("season_answer_responses")
        .upsert(payload, {
          onConflict: "student_id,season,round",
        });

      if (answerError) {
        logs.push(`${row.studentName}: 답안 저장 실패`);
      } else {
        answerSavedCount += 1;
      }
    }
  }

  await supabase.from("admin_action_logs").insert({
    admin_id: options.adminId,
    action_type: "score_upload_apply",
    reason: `${options.season} 시즌 ${options.round}회 파일 업로드 적용`,
    before_data: null,
    after_data: {
      fileName: options.fileName,
      totalRows: preview.totalRows,
      matchedCount: preview.matchedCount,
      newCount: preview.newCount,
      updateCount: preview.updateCount,
      matchFailedCount: preview.matchFailedCount,
      insertedCount,
      updatedCountApplied,
      answerSavedCount,
      awardedCoinCount,
    },
    created_at: now,
  });

  return {
    season: preview.season,
    round: preview.round,
    fileName: preview.fileName,
    totalRows: preview.totalRows,
    matchedCount: preview.matchedCount,
    newCount: preview.newCount,
    updateCount: preview.updateCount,
    matchFailedCount: preview.matchFailedCount,
    rows: preview.rows,
    insertedCount,
    updatedCountApplied,
    answerSavedCount,
    awardedCoinCount,
    logs,
  } satisfies AdminScoreUploadApplyResult;
}
