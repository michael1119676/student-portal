import seasonNRoundsRaw from "@/data/season_n_rounds.json";

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

type RawSeasonNData = {
  season: "N";
  rounds: Record<string, RawRound>;
};

type RoundRow = {
  studentId: string;
  className: string;
  score: number | null;
  answers: Array<number | null>;
};

export type SeasonNRoundSummary = {
  round: number;
  averageScore: number;
  myScore: number | null;
};

export type SeasonNRoundDetail = {
  round: number;
  myScore: number | null;
  averageScore: number;
  myStdScore: number | null;
  cut1: number | null;
  cut2: number | null;
  cut3: number | null;
  histogram: Array<{
    label: string;
    count: number;
  }>;
  classStats: Array<{
    className: string;
    average: number;
    median: number;
    stdDev: number;
    max: number;
    min: number;
    count: number;
  }>;
  questionStats: Array<{
    question: number;
    correctChoice: number | null;
    myChoice: number | null;
    isWrong: boolean;
    choices: Array<{
      choice: number;
      count: number;
      rate: number;
    }>;
  }>;
};

export type SeasonNViewData = {
  rounds: SeasonNRoundSummary[];
  details: SeasonNRoundDetail[];
};

export type SeasonNAdminStats = {
  season: "N";
  round: number;
  participantCount: number;
  averageScore: number;
  maxScore: number;
  minScore: number;
  histogram: Array<{
    label: string;
    count: number;
  }>;
  classStats: Array<{
    className: string;
    average: number;
    median: number;
    stdDev: number;
    max: number;
    min: number;
    count: number;
  }>;
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

const ROUND_COUNT = 12;
const ANSWER_KEYS: Record<number, number[]> = {
  1: "23521114535424524333".split("").map(Number),
};

function normalizeDisplayClassName(value: string) {
  const normalized = String(value || "").trim();
  if (normalized === "영상반") return "녹화강의반";
  return normalized || "미분류";
}

function toOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
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

function normalizeChoice(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < 1 || rounded > 5) return null;
  return rounded;
}

function parseTimestamp(value: string) {
  const t = Date.parse(value);
  return Number.isNaN(t) ? 0 : t;
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
  const matched = candidates.find(
    (student) => String(student.class_name || "").trim() === className.trim()
  );
  return matched ?? candidates[0];
}

function dedupeLatestRows(rows: RawRoundRow[]) {
  const latest = new Map<string, RawRoundRow>();
  for (const row of rows) {
    const key = `${row.name.trim()}__${row.className.trim()}`;
    const prev = latest.get(key);
    if (!prev || parseTimestamp(row.timestamp) >= parseTimestamp(prev.timestamp)) {
      latest.set(key, row);
    }
  }
  return [...latest.values()];
}

function getRawRound(data: RawSeasonNData, round: number): RawRound {
  return data.rounds[String(round)] ?? { questionCount: 0, rows: [] };
}

function buildRoundRows(round: number, rawRound: RawRound, students: StudentRef[]) {
  void round;
  const byName = buildNameToStudentsMap(students);
  const deduped = dedupeLatestRows(rawRound.rows);
  const rows: RoundRow[] = [];

  for (const row of deduped) {
    const candidates = byName.get(row.name.trim()) ?? [];
    const matched = chooseStudentByClass(candidates, row.className);
    if (!matched) continue;

    rows.push({
      studentId: matched.id,
      className: normalizeDisplayClassName(row.className || matched.class_name || "미분류"),
      score: normalizeScore(row.score),
      answers: row.answers.map((choice) => normalizeChoice(choice)),
    });
  }

  return rows;
}

function buildHistogram(rows: RoundRow[]) {
  const bins = Array.from({ length: 11 }, (_, i) => {
    const start = i * 5;
    const end = i === 10 ? 50 : start + 4;
    return { label: `${start}-${end}`, count: 0 };
  });

  for (const row of rows) {
    if (row.score === null) continue;
    const idx = Math.min(Math.floor(row.score / 5), bins.length - 1);
    bins[idx].count += 1;
  }
  return bins;
}

function buildClassStats(rows: RoundRow[]) {
  const grouped = new Map<string, number[]>();
  for (const row of rows) {
    if (row.score === null) continue;
    const key = row.className || "미분류";
    const list = grouped.get(key) ?? [];
    list.push(row.score);
    grouped.set(key, list);
  }

  return [...grouped.entries()]
    .map(([className, scores]) => {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const sorted = [...scores].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median =
        sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
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
  const result: SeasonNRoundDetail["questionStats"] = [];

  for (let i = 0; i < questionCount; i += 1) {
    const counts = new Map<number, number>([
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
      [5, 0],
    ]);
    let total = 0;

    for (const row of rows) {
      const choice = normalizeChoice(row.answers[i]);
      if (choice === null) continue;
      counts.set(choice, (counts.get(choice) ?? 0) + 1);
      total += 1;
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
          rate: total > 0 ? toOneDecimal((count / total) * 100) : 0,
        };
      }),
    });
  }

  return result;
}

function computeStdScore(score: number | null, mean: number) {
  if (score === null) return null;
  return Math.round(10 * ((score - (mean - 15)) / 12) + 50);
}

export function buildSeasonNViewData(
  students: StudentRef[],
  targetStudentId: string,
  cutoffsByRound: Record<number, { cut1: number | null; cut2: number | null; cut3: number | null }>
) {
  const data = seasonNRoundsRaw as RawSeasonNData;
  const rounds: SeasonNRoundSummary[] = [];
  const details: SeasonNRoundDetail[] = [];

  for (let round = 1; round <= ROUND_COUNT; round += 1) {
    const rawRound = getRawRound(data, round);
    const rows = buildRoundRows(round, rawRound, students);
    const scores = rows
      .map((row) => row.score)
      .filter((score): score is number => score !== null);
    const rawAverageScore =
      scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const averageScore = toOneDecimal(rawAverageScore);

    const myRow = rows.find((row) => row.studentId === targetStudentId) ?? null;
    const myScore = myRow?.score ?? null;
    const myAnswers = myRow?.answers ?? [];
    const answerKey = ANSWER_KEYS[round] ?? [];
    const questionCount = Math.max(rawRound.questionCount, answerKey.length);
    const myStdScore = computeStdScore(myScore, rawAverageScore);
    const cutoff = cutoffsByRound[round] ?? { cut1: null, cut2: null, cut3: null };

    rounds.push({
      round,
      averageScore,
      myScore,
    });

    details.push({
      round,
      myScore,
      averageScore,
      myStdScore,
      cut1: cutoff.cut1,
      cut2: cutoff.cut2,
      cut3: cutoff.cut3,
      histogram: buildHistogram(rows),
      classStats: buildClassStats(rows),
      questionStats: buildQuestionStats(rows, questionCount, answerKey, myAnswers),
    });
  }

  return { rounds, details };
}

export function buildSeasonNAdminStats(
  students: StudentRef[],
  round: number
): SeasonNAdminStats {
  const data = seasonNRoundsRaw as RawSeasonNData;
  const safeRound = Math.max(1, Math.min(ROUND_COUNT, Math.round(round)));
  const rawRound = getRawRound(data, safeRound);
  const rows = buildRoundRows(safeRound, rawRound, students);
  const scores = rows
    .map((row) => row.score)
    .filter((score): score is number => score !== null);
  const answerKey = ANSWER_KEYS[safeRound] ?? [];
  const questionCount = Math.max(rawRound.questionCount, answerKey.length);
  const questionStats = buildQuestionStats(rows, questionCount, answerKey, []);
  const weakQuestions = questionStats
    .map((question) => {
      const correctItem = question.choices.find(
        (choice) => choice.choice === question.correctChoice
      );
      return {
        question: question.question,
        correctChoice: question.correctChoice,
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
    season: "N",
    round: safeRound,
    participantCount: scores.length,
    averageScore:
      scores.length > 0 ? toOneDecimal(scores.reduce((acc, cur) => acc + cur, 0) / scores.length) : 0,
    maxScore: scores.length > 0 ? Math.max(...scores) : 0,
    minScore: scores.length > 0 ? Math.min(...scores) : 0,
    histogram: buildHistogram(rows),
    classStats: buildClassStats(rows),
    weakQuestions,
  };
}
