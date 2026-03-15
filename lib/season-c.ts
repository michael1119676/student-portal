import seasonCRoundsRaw from "@/data/season_c_rounds.json";

type StudentRef = {
  id: string;
  name: string;
  class_name: string | null;
};

type RawRoundRow = {
  name: string;
  className: string;
  timestamp: string;
  score: number | null;
  answers: Array<number | null>;
};

type RawRound = {
  questionCount: number;
  rows: RawRoundRow[];
};

type RawSeasonCData = {
  season: "C";
  rounds: Record<string, RawRound>;
};

type RoundRow = {
  studentId: string;
  name: string;
  className: string;
  score: number | null;
  answers: Array<number | null>;
};

export type SeasonCRoundSummary = {
  round: number;
  averageScore: number;
  myScore: number | null;
};

export type HistogramBin = {
  label: string;
  start: number;
  end: number;
  count: number;
};

export type ClassStat = {
  className: string;
  average: number;
  median: number;
  stdDev: number;
  max: number;
  min: number;
  count: number;
};

export type QuestionStat = {
  question: number;
  correctChoice: number | null;
  myChoice: number | null;
  isWrong: boolean;
  choices: Array<{
    choice: number;
    count: number;
    rate: number;
  }>;
};

export type SeasonCRoundDetail = {
  round: number;
  myScore: number | null;
  averageScore: number;
  myVsAverage: "above" | "equal" | "below" | "unknown";
  histogram: HistogramBin[];
  classStats: ClassStat[];
  questionStats: QuestionStat[];
};

export type SeasonCViewData = {
  rounds: SeasonCRoundSummary[];
  details: SeasonCRoundDetail[];
};

export type SeasonCAdminStats = {
  season: "C";
  round: number;
  participantCount: number;
  averageScore: number;
  maxScore: number;
  minScore: number;
  histogram: HistogramBin[];
  classStats: ClassStat[];
  weakQuestions: Array<{
    question: number;
    correctChoice: number | null;
    correctRate: number;
    choiceRates: Array<{
      choice: number;
      rate: number;
      count: number;
    }>;
  }>;
};

const ANSWER_KEYS: Record<number, number[]> = {
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

const ROUND_COUNT = 10;
const MAX_SCORE = 100;
const BIN_SIZE = 10;

function normalizeDisplayClassName(value: string) {
  const normalized = String(value || "").trim();
  if (normalized === "영상반") return "녹화강의반";
  return normalized || "미분류";
}

function toOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function parseTimestamp(value: string) {
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

function normalizeChoice(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < 1 || rounded > 5) return null;
  return rounded;
}

function normalizeScore(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < 0) return 0;
  if (rounded > 100) return 100;
  return rounded;
}

function scoreFromAnswers(round: number, answers: Array<number | null>) {
  const key = ANSWER_KEYS[round];
  if (!key || key.length === 0) return null;

  let answered = 0;
  let correct = 0;
  for (let i = 0; i < key.length; i += 1) {
    const choice = normalizeChoice(answers[i]);
    if (choice === null) continue;
    answered += 1;
    if (choice === key[i]) correct += 1;
  }

  if (answered === 0) return null;
  return Math.round((correct / key.length) * 100);
}

function buildNameToStudentsMap(students: StudentRef[]) {
  const map = new Map<string, StudentRef[]>();
  for (const student of students) {
    const key = student.name.trim();
    const list = map.get(key) ?? [];
    list.push(student);
    map.set(key, list);
  }
  return map;
}

function chooseStudentByClass(candidates: StudentRef[], className: string) {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const classMatch = candidates.find(
    (student) => String(student.class_name || "").trim() === className.trim()
  );
  return classMatch ?? candidates[0];
}

function dedupeLatestRows(rows: RawRoundRow[]) {
  const latest = new Map<string, RawRoundRow>();

  for (const row of rows) {
    const key = `${row.name.trim()}__${row.className.trim()}`;
    const prev = latest.get(key);
    if (!prev) {
      latest.set(key, row);
      continue;
    }

    if (parseTimestamp(row.timestamp) >= parseTimestamp(prev.timestamp)) {
      latest.set(key, row);
    }
  }

  return [...latest.values()];
}

function buildRoundRows(
  round: number,
  rawRound: RawRound,
  students: StudentRef[]
) {
  const byName = buildNameToStudentsMap(students);
  const deduped = dedupeLatestRows(rawRound.rows);
  const result: RoundRow[] = [];

  for (const row of deduped) {
    const candidates = byName.get(row.name.trim()) ?? [];
    const matched = chooseStudentByClass(candidates, row.className);
    if (!matched) continue;

    const answers = row.answers.map((value) => normalizeChoice(value));
    const scoreFromSheet = normalizeScore(row.score);
    result.push({
      studentId: matched.id,
      name: matched.name,
      className: normalizeDisplayClassName(row.className || matched.class_name || "미분류"),
      score: scoreFromSheet ?? scoreFromAnswers(round, answers),
      answers,
    });
  }

  return result;
}

function buildHistogram(rows: RoundRow[]) {
  const bins: HistogramBin[] = [];
  for (let start = 0; start <= MAX_SCORE; start += BIN_SIZE) {
    const end = Math.min(MAX_SCORE, start + BIN_SIZE - 1);
    bins.push({ label: `${start}-${end}`, start, end, count: 0 });
  }

  for (const row of rows) {
    if (row.score === null) continue;
    const index = Math.min(Math.floor(row.score / BIN_SIZE), bins.length - 1);
    bins[index].count += 1;
  }

  return bins;
}

function buildClassStats(rows: RoundRow[]) {
  const grouped = new Map<string, number[]>();

  for (const row of rows) {
    if (row.score === null) continue;
    const key = row.className || "미분류";
    const scores = grouped.get(key) ?? [];
    scores.push(row.score);
    grouped.set(key, scores);
  }

  return [...grouped.entries()]
    .map(([className, scores]) => {
      const sorted = [...scores].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median =
        sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];
      const avg = scores.reduce((acc, cur) => acc + cur, 0) / scores.length;
      const variance =
        scores.reduce((acc, cur) => acc + (cur - avg) ** 2, 0) / scores.length;
      return {
        className,
        average: toOneDecimal(avg),
        median: toOneDecimal(median),
        stdDev: toOneDecimal(Math.sqrt(variance)),
        max: Math.max(...scores),
        min: Math.min(...scores),
        count: scores.length,
      };
    })
    .sort((a, b) => a.className.localeCompare(b.className, "ko"));
}

function buildQuestionStats(
  rows: RoundRow[],
  questionCount: number,
  answerKey: number[],
  myAnswers: Array<number | null>
) {
  const result: QuestionStat[] = [];

  for (let i = 0; i < questionCount; i += 1) {
    const counts = new Map<number, number>();
    for (let choice = 1; choice <= 5; choice += 1) {
      counts.set(choice, 0);
    }

    let validCount = 0;
    for (const row of rows) {
      const choice = normalizeChoice(row.answers[i]);
      if (choice === null) continue;
      counts.set(choice, (counts.get(choice) ?? 0) + 1);
      validCount += 1;
    }

    const correctChoice = normalizeChoice(answerKey[i]);
    const myChoice = normalizeChoice(myAnswers[i]);

    result.push({
      question: i + 1,
      correctChoice,
      myChoice,
      isWrong:
        myChoice !== null && correctChoice !== null && myChoice !== correctChoice,
      choices: [1, 2, 3, 4, 5].map((choice) => {
        const count = counts.get(choice) ?? 0;
        return {
          choice,
          count,
          rate: validCount > 0 ? toOneDecimal((count / validCount) * 100) : 0,
        };
      }),
    });
  }

  return result;
}

function getRawRound(data: RawSeasonCData, round: number): RawRound {
  const fallbackQuestionCount = ANSWER_KEYS[round]?.length ?? 0;
  return (
    data.rounds[String(round)] ?? {
      questionCount: fallbackQuestionCount,
      rows: [],
    }
  );
}

export function buildSeasonCViewData(
  students: StudentRef[],
  targetStudentId: string
) {
  const data = seasonCRoundsRaw as RawSeasonCData;
  const rounds: SeasonCRoundSummary[] = [];
  const details: SeasonCRoundDetail[] = [];

  for (let round = 1; round <= ROUND_COUNT; round += 1) {
    const rawRound = getRawRound(data, round);
    const rows = buildRoundRows(round, rawRound, students);
    const answerKey = ANSWER_KEYS[round] ?? [];
    const questionCount = Math.max(rawRound.questionCount, answerKey.length);
    const validScores = rows
      .map((row) => row.score)
      .filter((value): value is number => value !== null);

    const averageScore =
      validScores.length > 0
        ? toOneDecimal(validScores.reduce((acc, cur) => acc + cur, 0) / validScores.length)
        : 0;

    const myRow = rows.find((row) => row.studentId === targetStudentId) ?? null;
    const myScore = myRow?.score ?? null;
    const myAnswers = myRow?.answers ?? [];

    rounds.push({
      round,
      averageScore,
      myScore,
    });

    let myVsAverage: "above" | "equal" | "below" | "unknown" = "unknown";
    if (myScore !== null) {
      if (myScore > averageScore) myVsAverage = "above";
      else if (myScore < averageScore) myVsAverage = "below";
      else myVsAverage = "equal";
    }

    details.push({
      round,
      myScore,
      averageScore,
      myVsAverage,
      histogram: buildHistogram(rows),
      classStats: buildClassStats(rows),
      questionStats: buildQuestionStats(rows, questionCount, answerKey, myAnswers),
    });
  }

  return { rounds, details };
}

export function buildSeasonCAdminStats(
  students: StudentRef[],
  round: number
): SeasonCAdminStats {
  const data = seasonCRoundsRaw as RawSeasonCData;
  const safeRound = Math.max(1, Math.min(10, Math.round(round)));
  const rawRound = getRawRound(data, safeRound);
  const rows = buildRoundRows(safeRound, rawRound, students);
  const answerKey = ANSWER_KEYS[safeRound] ?? [];
  const questionCount = Math.max(rawRound.questionCount, answerKey.length);
  const validScores = rows
    .map((row) => row.score)
    .filter((value): value is number => value !== null);

  const questionStats = buildQuestionStats(rows, questionCount, answerKey, []);
  const weakQuestions = questionStats
    .map((question) => {
      const correctChoice = question.correctChoice;
      const correctItem = question.choices.find(
        (choice) => choice.choice === correctChoice
      );
      return {
        question: question.question,
        correctChoice,
        correctRate: correctItem?.rate ?? 0,
        choiceRates: question.choices.map((choice) => ({
          choice: choice.choice,
          rate: choice.rate,
          count: choice.count,
        })),
      };
    })
    .sort((a, b) => a.correctRate - b.correctRate);

  return {
    season: "C",
    round: safeRound,
    participantCount: validScores.length,
    averageScore:
      validScores.length > 0
        ? toOneDecimal(validScores.reduce((acc, cur) => acc + cur, 0) / validScores.length)
        : 0,
    maxScore: validScores.length > 0 ? Math.max(...validScores) : 0,
    minScore: validScores.length > 0 ? Math.min(...validScores) : 0,
    histogram: buildHistogram(rows),
    classStats: buildClassStats(rows),
    weakQuestions,
  };
}
