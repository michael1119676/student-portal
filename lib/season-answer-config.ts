import { createAdminClient } from "@/lib/supabase/admin";

export type AnswerUploadSeason = "C" | "N";
export type AnswerScoreMode = "percent100" | "weighted";

export type AnswerConfig = {
  answerKey: number[];
  questionWeights: number[];
  scoreMode: AnswerScoreMode;
  questionCount: number;
  source?: "builtin" | "uploaded";
  updatedAt?: string | null;
};

export type AnswerConfigMap = Record<string, AnswerConfig>;

type StoredAnswerConfigRow = {
  season: string;
  round: number;
  question_count: number | null;
  answer_key: unknown;
  question_weights: unknown;
  score_mode: string | null;
  updated_at: string | null;
};

const C_ANSWER_KEYS: Record<number, number[]> = {
  1: "325454313".split("").map(Number),
  2: "54332241131".split("").map(Number),
  3: "53313351".split("").map(Number),
  4: "14324354".split("").map(Number),
  5: "42231441".split("").map(Number),
  6: "13152152".split("").map(Number),
  7: "44352323".split("").map(Number),
  8: "32153441".split("").map(Number),
  9: "15244115".split("").map(Number),
  10: "15543544".split("").map(Number),
};

const N_ANSWER_CONFIGS: Record<number, Omit<AnswerConfig, "questionCount" | "source">> = {
  1: {
    answerKey: "23521114535424524333".split("").map(Number),
    scoreMode: "weighted",
    questionWeights: Array.from({ length: 20 }, () => 2.5),
  },
  2: {
    answerKey: "11223545334224544333".split("").map(Number),
    scoreMode: "weighted",
    questionWeights: [2, 3, 2, 2, 3, 3, 2, 2, 3, 2, 3, 2, 2, 3, 3, 3, 3, 2, 3, 2],
  },
  3: {
    answerKey: "25125533353124145443".split("").map(Number),
    scoreMode: "weighted",
    questionWeights: [2, 3, 3, 2, 3, 2, 3, 2, 2, 2, 2, 3, 3, 2, 3, 3, 3, 3, 2, 2],
  },
};

function answerConfigKey(season: AnswerUploadSeason, round: number) {
  return `${season}:${Math.round(round)}`;
}

function normalizeChoice(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const rounded = Math.round(numeric);
  if (rounded < 1 || rounded > 5) return null;
  return rounded;
}

function normalizeWeight(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric;
}

function normalizeAnswerArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeChoice(item as number | string | null | undefined))
    .filter((item): item is number => item !== null);
}

function normalizeWeightArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeWeight(item as number | string | null | undefined))
    .filter((item): item is number => item !== null);
}

function withQuestionCount(
  config: Omit<AnswerConfig, "questionCount" | "source" | "updatedAt">,
  source: "builtin" | "uploaded",
  updatedAt: string | null = null
): AnswerConfig {
  const questionCount = config.answerKey.length;
  const weights =
    config.questionWeights.length === questionCount
      ? config.questionWeights
      : Array.from({ length: questionCount }, () => 1);

  return {
    answerKey: config.answerKey,
    questionWeights: weights,
    scoreMode: config.scoreMode,
    questionCount,
    source,
    updatedAt,
  };
}

function getBuiltinSeasonAnswerConfig(
  season: AnswerUploadSeason,
  round: number
): AnswerConfig | null {
  const safeRound = Math.round(round);

  if (season === "C") {
    const answerKey = C_ANSWER_KEYS[safeRound];
    if (!answerKey?.length) return null;

    return withQuestionCount(
      {
        answerKey,
        questionWeights: Array.from({ length: answerKey.length }, () => 1),
        scoreMode: "percent100",
      },
      "builtin"
    );
  }

  const config = N_ANSWER_CONFIGS[safeRound];
  if (!config?.answerKey?.length) return null;
  return withQuestionCount(config, "builtin");
}

function coerceStoredAnswerConfig(row: StoredAnswerConfigRow): AnswerConfig | null {
  const season = String(row.season || "").toUpperCase() as AnswerUploadSeason;
  if (season !== "C" && season !== "N") return null;

  const answerKey = normalizeAnswerArray(row.answer_key);
  if (answerKey.length === 0) return null;

  const questionWeights = normalizeWeightArray(row.question_weights);
  const questionCount = Math.max(
    answerKey.length,
    Number.isFinite(Number(row.question_count)) ? Math.round(Number(row.question_count)) : 0
  );
  const scoreMode: AnswerScoreMode = row.score_mode === "weighted" ? "weighted" : "percent100";

  const normalizedAnswerKey = answerKey.slice(0, questionCount);
  const normalizedWeights =
    questionWeights.length >= normalizedAnswerKey.length
      ? questionWeights.slice(0, normalizedAnswerKey.length)
      : Array.from({ length: normalizedAnswerKey.length }, (_, index) =>
          questionWeights[index] ?? 1
        );

  return {
    answerKey: normalizedAnswerKey,
    questionWeights: normalizedWeights,
    questionCount: normalizedAnswerKey.length,
    scoreMode,
    source: "uploaded",
    updatedAt: row.updated_at,
  };
}

export function resolveSeasonAnswerConfig(
  season: AnswerUploadSeason,
  round: number,
  overrides?: AnswerConfigMap
) {
  const safeSeason = season.toUpperCase() as AnswerUploadSeason;
  const key = answerConfigKey(safeSeason, round);
  return overrides?.[key] ?? getBuiltinSeasonAnswerConfig(safeSeason, round);
}

export function getSeasonAnswerKey(
  season: AnswerUploadSeason,
  round: number,
  overrides?: AnswerConfigMap
) {
  return resolveSeasonAnswerConfig(season, round, overrides)?.answerKey ?? null;
}

export function getSeasonQuestionWeights(
  season: AnswerUploadSeason,
  round: number,
  overrides?: AnswerConfigMap
) {
  return resolveSeasonAnswerConfig(season, round, overrides)?.questionWeights ?? null;
}

export function getSeasonQuestionCount(
  season: AnswerUploadSeason,
  round: number,
  overrides?: AnswerConfigMap
) {
  return resolveSeasonAnswerConfig(season, round, overrides)?.questionCount ?? 0;
}

export function scoreAnswersForSeason(
  season: AnswerUploadSeason,
  round: number,
  answers: Array<number | string | null | undefined>,
  overrides?: AnswerConfigMap
) {
  const config = resolveSeasonAnswerConfig(season, round, overrides);
  if (!config?.answerKey?.length) return null;

  const normalizedAnswers = answers.map((value) => normalizeChoice(value));
  const answeredCount = normalizedAnswers.filter((value) => value !== null).length;
  if (answeredCount === 0) return null;

  const totalWeight = config.questionWeights.reduce((sum, weight) => sum + weight, 0);
  if (totalWeight <= 0) return null;

  let correctWeight = 0;
  for (let index = 0; index < config.answerKey.length; index += 1) {
    if (normalizedAnswers[index] === config.answerKey[index]) {
      correctWeight += config.questionWeights[index] ?? 0;
    }
  }

  if (config.scoreMode === "weighted") {
    return Math.round(correctWeight);
  }

  return Math.round((correctWeight / totalWeight) * 100);
}

export function buildAnswerConfigTemplateRows(
  season: AnswerUploadSeason,
  round: number,
  overrides?: AnswerConfigMap
) {
  const config = resolveSeasonAnswerConfig(season, round, overrides);
  const questionCount =
    config?.questionCount ?? (season === "N" ? 20 : season === "C" ? 10 : 0);

  return Array.from({ length: questionCount }, (_, index) => ({
    문항: index + 1,
    정답: config?.answerKey[index] ?? "",
    배점: config?.questionWeights[index] ?? "",
  }));
}

export async function fetchSeasonAnswerConfigMap(season?: AnswerUploadSeason) {
  const supabase = createAdminClient();
  let query = supabase
    .from("season_answer_configs")
    .select("season, round, question_count, answer_key, question_weights, score_mode, updated_at");

  if (season) {
    query = query.eq("season", season);
  }

  const { data, error } = await query;

  if (error) {
    if (
      error.code === "42P01" ||
      /season_answer_configs/i.test(error.message) ||
      /season_answer_configs/i.test(error.details || "")
    ) {
      return {} as AnswerConfigMap;
    }
    throw new Error("정답/배점 설정을 불러오지 못했습니다.");
  }

  const map: AnswerConfigMap = {};
  for (const row of (data ?? []) as StoredAnswerConfigRow[]) {
    const normalizedSeason = String(row.season || "").toUpperCase() as AnswerUploadSeason;
    const normalizedRound = Math.round(Number(row.round));
    if (!Number.isFinite(normalizedRound)) continue;
    const config = coerceStoredAnswerConfig(row);
    if (!config) continue;
    map[answerConfigKey(normalizedSeason, normalizedRound)] = config;
  }

  return map;
}
