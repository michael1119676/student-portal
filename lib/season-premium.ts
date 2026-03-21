export const PREMIUM_MONTH_ROUNDS = [3, 4, 5, 7, 8, 9, 10, 11] as const;
export const EDUCATION_ASSESSMENT_MONTH_ROUNDS = [5, 6, 7, 9, 10] as const;

export const PREMIUM_SEASON_META = {
  DP: {
    badge: "더프",
    shortTitle: "더프",
    title: "더프리미엄 모의고사",
    subtitle: "월별 더프 물리학 II 통계 확인",
    rounds: [...PREMIUM_MONTH_ROUNDS],
    detailMode: "basic",
  },
  SP: {
    badge: "서프",
    shortTitle: "서프",
    title: "서바이벌 프로",
    subtitle: "월별 서프 물리학 II 통계 확인",
    rounds: [...PREMIUM_MONTH_ROUNDS],
    detailMode: "basic",
  },
  EA: {
    badge: "교평",
    shortTitle: "교평",
    title: "교육청/평가원",
    subtitle: "월별 교육청/평가원 물리학 II 통계 확인",
    rounds: [...EDUCATION_ASSESSMENT_MONTH_ROUNDS],
    detailMode: "nLike",
  },
} as const;

export type PremiumSeasonCode = keyof typeof PREMIUM_SEASON_META;

type StudentRef = {
  id: string;
  name: string;
  class_name: string | null;
};

type ScoreRecord = {
  student_id: string;
  round: number;
  score: number | null;
};

export type PremiumRoundSummary = {
  round: number;
  label: string;
  averageScore: number;
  myScore: number | null;
};

export type PremiumRoundDetail = {
  round: number;
  label: string;
  myScore: number | null;
  averageScore: number;
  myStdScore?: number | null;
  cut1?: number | null;
  cut2?: number | null;
  cut3?: number | null;
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
};

export type PremiumViewData = {
  rounds: PremiumRoundSummary[];
  details: PremiumRoundDetail[];
};

export type PremiumAdminStats = {
  season: PremiumSeasonCode;
  round: number;
  roundLabel: string;
  participantCount: number;
  averageScore: number;
  maxScore: number;
  minScore: number;
  histogram: PremiumRoundDetail["histogram"];
  classStats: PremiumRoundDetail["classStats"];
  weakQuestions: [];
};

type PremiumRoundRow = {
  studentId: string;
  className: string;
  score: number | null;
};

function toOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function normalizeDisplayClassName(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  if (normalized === "녹화강의반" || normalized === "영상반") return "영상반";
  return normalized || "미분류";
}

function normalizeScore(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const rounded = Math.round(num);
  if (rounded < 0) return 0;
  if (rounded > 50) return 50;
  return rounded;
}

function computeStdScore(score: number | null, mean: number) {
  if (score === null) return null;
  return Math.round(10 * ((score - (mean - 15)) / 12) + 50);
}

function classOrder(className: string) {
  if (className === "금요일반" || className.startsWith("금")) return 0;
  if (className === "토요일반" || className.startsWith("토")) return 1;
  if (
    className === "영상반" ||
    className.startsWith("영상") ||
    className.startsWith("녹")
  )
    return 2;
  if (className === "전체") return 3;
  return 4;
}

function buildStatItem(className: string, scores: number[]) {
  const sorted = [...scores].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];
  const average = scores.reduce((acc, current) => acc + current, 0) / scores.length;
  const variance =
    scores.reduce((acc, current) => acc + (current - average) ** 2, 0) / scores.length;

  return {
    className,
    average: toOneDecimal(average),
    median: toOneDecimal(median),
    stdDev: toOneDecimal(Math.sqrt(variance)),
    max: Math.max(...scores),
    min: Math.min(...scores),
    count: scores.length,
  };
}

function buildRoundRows(students: StudentRef[], records: ScoreRecord[], round: number) {
  const classNameById = new Map<string, string>();
  for (const student of students) {
    classNameById.set(student.id, normalizeDisplayClassName(student.class_name));
  }

  const rows: PremiumRoundRow[] = [];
  for (const record of records) {
    if (record.round !== round) continue;
    rows.push({
      studentId: record.student_id,
      className: classNameById.get(record.student_id) ?? "미분류",
      score: normalizeScore(record.score),
    });
  }

  return rows;
}

function buildClassStats(rows: PremiumRoundRow[]) {
  const grouped = new Map<string, number[]>();
  for (const row of rows) {
    if (row.score === null) continue;
    const scores = grouped.get(row.className) ?? [];
    scores.push(row.score);
    grouped.set(row.className, scores);
  }

  const stats = [...grouped.entries()].map(([className, scores]) =>
    buildStatItem(className, scores)
  );

  const allScores = rows
    .map((row) => row.score)
    .filter((value): value is number => value !== null);

  if (allScores.length > 0) {
    stats.push(buildStatItem("전체", allScores));
  }

  return stats.sort((a, b) => {
    const rankDiff = classOrder(a.className) - classOrder(b.className);
    if (rankDiff !== 0) return rankDiff;
    return a.className.localeCompare(b.className, "ko");
  });
}

function buildHistogram(rows: PremiumRoundRow[]) {
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

export function getPremiumRoundLabel(round: number) {
  return `${round}월`;
}

export function isPremiumSeason(value: unknown): value is PremiumSeasonCode {
  return value === "DP" || value === "SP" || value === "EA";
}

export function getPremiumSeasonMeta(season: PremiumSeasonCode) {
  return PREMIUM_SEASON_META[season];
}

export function getPremiumSeasonRounds(season: PremiumSeasonCode) {
  return [...PREMIUM_SEASON_META[season].rounds];
}

function normalizePremiumRound(season: PremiumSeasonCode, round: number) {
  const rounds = getPremiumSeasonRounds(season);
  const safeRound = Math.round(round);
  return rounds.some((candidate) => candidate === safeRound) ? safeRound : rounds[0];
}

export function buildPremiumViewData(
  students: StudentRef[],
  records: ScoreRecord[],
  targetStudentId: string,
  season: PremiumSeasonCode,
  cutoffsByRound?: Record<number, { cut1: number | null; cut2: number | null; cut3: number | null }>
): PremiumViewData {
  const rounds: PremiumRoundSummary[] = [];
  const details: PremiumRoundDetail[] = [];
  const seasonMeta = getPremiumSeasonMeta(season);

  for (const round of getPremiumSeasonRounds(season)) {
    const rows = buildRoundRows(students, records, round);
    const validScores = rows
      .map((row) => row.score)
      .filter((value): value is number => value !== null);
    const averageScore =
      validScores.length > 0
        ? toOneDecimal(validScores.reduce((acc, cur) => acc + cur, 0) / validScores.length)
        : 0;
    const myRow = rows.find((row) => row.studentId === targetStudentId) ?? null;
    const cutoff = cutoffsByRound?.[round] ?? { cut1: null, cut2: null, cut3: null };

    rounds.push({
      round,
      label: getPremiumRoundLabel(round),
      averageScore,
      myScore: myRow?.score ?? null,
    });

    details.push({
      round,
      label: getPremiumRoundLabel(round),
      myScore: myRow?.score ?? null,
      averageScore,
      myStdScore:
        seasonMeta.detailMode === "nLike"
          ? computeStdScore(myRow?.score ?? null, validScores.length > 0
              ? validScores.reduce((acc, cur) => acc + cur, 0) / validScores.length
              : 0)
          : null,
      cut1: seasonMeta.detailMode === "nLike" ? cutoff.cut1 : null,
      cut2: seasonMeta.detailMode === "nLike" ? cutoff.cut2 : null,
      cut3: seasonMeta.detailMode === "nLike" ? cutoff.cut3 : null,
      histogram: buildHistogram(rows),
      classStats: buildClassStats(rows),
    });
  }

  return { rounds, details };
}

export function buildPremiumAdminStats(
  students: StudentRef[],
  records: ScoreRecord[],
  round: number,
  season: PremiumSeasonCode
): PremiumAdminStats {
  const safeRound = normalizePremiumRound(season, Math.round(round));
  const rows = buildRoundRows(students, records, safeRound);
  const validScores = rows
    .map((row) => row.score)
    .filter((value): value is number => value !== null);

  return {
    season,
    round: safeRound,
    roundLabel: getPremiumRoundLabel(safeRound),
    participantCount: validScores.length,
    averageScore:
      validScores.length > 0
        ? toOneDecimal(validScores.reduce((acc, cur) => acc + cur, 0) / validScores.length)
        : 0,
    maxScore: validScores.length > 0 ? Math.max(...validScores) : 0,
    minScore: validScores.length > 0 ? Math.min(...validScores) : 0,
    histogram: buildHistogram(rows),
    classStats: buildClassStats(rows),
    weakQuestions: [],
  };
}
