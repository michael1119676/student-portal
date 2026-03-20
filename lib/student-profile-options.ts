export const STUDY_YEAR_OPTIONS = ["현역", "재수", "삼수", "N수", "군수"] as const;
export const STUDY_PLACE_OPTIONS = [
  "시대인재",
  "강남대성",
  "하이퍼",
  "독학재수",
  "이투스",
  "종로",
  "스터디카페",
  "집",
] as const;

export type StudentStudyYear = (typeof STUDY_YEAR_OPTIONS)[number];
export type StudentStudyPlace = (typeof STUDY_PLACE_OPTIONS)[number];

function normalizeEnumValue<T extends readonly string[]>(
  value: unknown,
  allowed: T
): T[number] | null {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  return (allowed as readonly string[]).includes(normalized)
    ? (normalized as T[number])
    : null;
}

export function normalizeStudyYear(value: unknown) {
  return normalizeEnumValue(value, STUDY_YEAR_OPTIONS);
}

export function normalizeStudyPlace(value: unknown) {
  return normalizeEnumValue(value, STUDY_PLACE_OPTIONS);
}
