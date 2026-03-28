export type AnswerUploadSeason = "C" | "N";

type AnswerConfig = {
  answerKey: number[];
  questionWeights?: number[];
  scoreMode: "percent100" | "weighted";
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

const N_ANSWER_CONFIGS: Record<number, AnswerConfig> = {
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

function normalizeChoice(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const rounded = Math.round(numeric);
  if (rounded < 1 || rounded > 5) return null;
  return rounded;
}

export function getSeasonAnswerKey(season: AnswerUploadSeason, round: number) {
  if (season === "C") return C_ANSWER_KEYS[Math.round(round)] ?? null;
  return N_ANSWER_CONFIGS[Math.round(round)]?.answerKey ?? null;
}

export function getSeasonQuestionCount(season: AnswerUploadSeason, round: number) {
  return getSeasonAnswerKey(season, round)?.length ?? 0;
}

export function scoreAnswersForSeason(
  season: AnswerUploadSeason,
  round: number,
  answers: Array<number | string | null | undefined>
) {
  const safeRound = Math.round(round);
  const normalizedSeason = season.toUpperCase() as AnswerUploadSeason;
  const normalizedAnswers = answers.map((value) => normalizeChoice(value));
  const answeredCount = normalizedAnswers.filter((value) => value !== null).length;
  if (answeredCount === 0) return null;

  if (normalizedSeason === "C") {
    const answerKey = C_ANSWER_KEYS[safeRound];
    if (!answerKey?.length) return null;
    let correct = 0;
    for (let index = 0; index < answerKey.length; index += 1) {
      if (normalizedAnswers[index] === answerKey[index]) correct += 1;
    }
    return Math.round((correct / answerKey.length) * 100);
  }

  const config = N_ANSWER_CONFIGS[safeRound];
  if (!config?.answerKey?.length) return null;

  if (config.scoreMode === "weighted" && config.questionWeights?.length === config.answerKey.length) {
    let score = 0;
    for (let index = 0; index < config.answerKey.length; index += 1) {
      if (normalizedAnswers[index] === config.answerKey[index]) {
        score += config.questionWeights[index] ?? 0;
      }
    }
    return Math.round(score);
  }

  return null;
}
