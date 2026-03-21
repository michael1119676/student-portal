export type ShopBoxCode = "roulette" | "bronze" | "silver" | "gold" | "diamond";
export type ShopDeliveryKind = "instant" | "gifticon" | "physical";

export type ShopBoxSeed = {
  code: ShopBoxCode;
  name: string;
  coinCost: number;
  sortOrder: number;
};

export type ShopProductSeed = {
  boxCode: ShopBoxCode;
  name: string;
  quantity: number;
  baseProbabilityPercent: number | null;
  isRare: boolean;
  rewardCoinDelta: number;
  rewardCoinMultiplier: number;
};

export const SHOP_BOX_DEFAULTS: Record<ShopBoxCode, ShopBoxSeed> = {
  roulette: { code: "roulette", name: "룰렛", coinCost: 1, sortOrder: 0 },
  bronze: { code: "bronze", name: "브론즈 상자", coinCost: 2, sortOrder: 1 },
  silver: { code: "silver", name: "실버 상자", coinCost: 3, sortOrder: 2 },
  gold: { code: "gold", name: "골드 상자", coinCost: 7, sortOrder: 3 },
  diamond: { code: "diamond", name: "다이아 상자", coinCost: 16, sortOrder: 4 },
};

const STATIC_SHOP_PRODUCTS: Array<{
  boxCode: ShopBoxCode;
  name: string;
  quantity: number;
  baseProbabilityPercent?: number | null;
}> = [
  { boxCode: "roulette", name: "꽝!", quantity: 560000, baseProbabilityPercent: 53.8899 },
  { boxCode: "roulette", name: "코인 1개", quantity: 250000, baseProbabilityPercent: 25 },
  { boxCode: "roulette", name: "코인 2개", quantity: 150000, baseProbabilityPercent: 15 },
  { boxCode: "roulette", name: "코인 5개", quantity: 50000, baseProbabilityPercent: 5 },
  { boxCode: "roulette", name: "코인 10개", quantity: 10000, baseProbabilityPercent: 1 },
  { boxCode: "roulette", name: "코인 30개", quantity: 1000, baseProbabilityPercent: 0.1 },
  { boxCode: "roulette", name: "코인 50개", quantity: 100, baseProbabilityPercent: 0.01 },
  { boxCode: "roulette", name: "코인 777개", quantity: 1, baseProbabilityPercent: 0.0001 },
  { boxCode: "bronze", name: "CU 마이쮸", quantity: 200000, baseProbabilityPercent: 98.35 },
  { boxCode: "bronze", name: "코인 10개 추가", quantity: 2000, baseProbabilityPercent: 1 },
  {
    boxCode: "bronze",
    name: "한국표준금거래소 24K 순금 골드바 0.1g",
    quantity: 1000,
    baseProbabilityPercent: 0.5,
  },
  { boxCode: "bronze", name: "지금까지의 코인 개수 2배로", quantity: 200, baseProbabilityPercent: 0.1 },
  {
    boxCode: "bronze",
    name: "지금까지의 코인 개수 5배로",
    quantity: 100,
    baseProbabilityPercent: 0.05,
  },
  { boxCode: "silver", name: "CU 1,000원 기프트 카드", quantity: 10000, baseProbabilityPercent: 50 },
  { boxCode: "silver", name: "CU 2,000원 기프트 카드", quantity: 6000, baseProbabilityPercent: 30 },
  { boxCode: "silver", name: "CU 5,000원 기프트 카드", quantity: 3000, baseProbabilityPercent: 15 },
  { boxCode: "silver", name: "CU 10,000원 기프트 카드", quantity: 1000, baseProbabilityPercent: 5 },
  { boxCode: "gold", name: "CU 3,000원 기프트 카드", quantity: 6000, baseProbabilityPercent: 30 },
  { boxCode: "gold", name: "베스킨라빈스 싱글레귤러", quantity: 4000, baseProbabilityPercent: 20 },
  { boxCode: "gold", name: "스타벅스 아이스 아메리카노", quantity: 4000, baseProbabilityPercent: 20 },
  { boxCode: "gold", name: "페로로 로쉐 T8", quantity: 3000, baseProbabilityPercent: 15 },
  { boxCode: "gold", name: "굽네 오븐바사삭+콜라", quantity: 2000, baseProbabilityPercent: 10 },
  { boxCode: "gold", name: "조말론 블랙베리 앤 베이 핸드크림", quantity: 1000, baseProbabilityPercent: 5 },
  {
    boxCode: "diamond",
    name: "지인선 N제 Seoson2(공통+미적확통 하프 모의고사)",
    quantity: 1000,
    baseProbabilityPercent: 20,
  },
  { boxCode: "diamond", name: "페레로로쉐 T16", quantity: 1000, baseProbabilityPercent: 18 },
  { boxCode: "diamond", name: "CU 20,000원 기프트 카드", quantity: 600, baseProbabilityPercent: 11 },
  { boxCode: "diamond", name: "골드 상자 3회 뽑기권", quantity: 400, baseProbabilityPercent: 7 },
  { boxCode: "diamond", name: "베스킨라빈스 패밀리(5가지 맛)", quantity: 400, baseProbabilityPercent: 7 },
  { boxCode: "diamond", name: "메이레 혼공 뽀모도로 타이머 무소음", quantity: 400, baseProbabilityPercent: 7 },
  { boxCode: "diamond", name: "라미 사파리 볼펜(색상 선택 가능)", quantity: 350, baseProbabilityPercent: 7 },
  {
    boxCode: "diamond",
    name: "할리데이 일반물리학, Principles of Physics, 스튜어트 미분적분학 중 1권",
    quantity: 250,
    baseProbabilityPercent: 5,
  },
  {
    boxCode: "diamond",
    name: "연의 합격 26수능 샤프, 카의 합격 25수능 샤프 중 1개(재고 소진시 종료)",
    quantity: 250,
    baseProbabilityPercent: 5,
  },
  { boxCode: "diamond", name: "포켓쉴 대용량 보조바태리 20000mAh 22.5W", quantity: 150, baseProbabilityPercent: 3 },
  { boxCode: "diamond", name: "카오스 진자 키네틱아트 T형", quantity: 100, baseProbabilityPercent: 2 },
  { boxCode: "diamond", name: "카오스 진자 키네틱아트 A형", quantity: 50, baseProbabilityPercent: 1 },
  { boxCode: "diamond", name: "카오스 진자 키네틱아트 C형", quantity: 50, baseProbabilityPercent: 1 },
  { boxCode: "diamond", name: "순은 그래뉼 10g", quantity: 75, baseProbabilityPercent: 1.5 },
  {
    boxCode: "diamond",
    name: "한서준T와 오마카세 식사(한우, 스시, 양식 중 선택 가능)",
    quantity: 40,
    baseProbabilityPercent: 0.8,
  },
  { boxCode: "diamond", name: "에어팟4 MXP63KH/A 화이트", quantity: 25, baseProbabilityPercent: 0.5 },
  {
    boxCode: "diamond",
    name: "한국순금거래소 24K 순금 골드바 1g(학생 성함 각인 가능)",
    quantity: 10,
    baseProbabilityPercent: 0.2,
  },
];

function parseRewardCoinDelta(productName: string) {
  const match =
    productName.match(/코인\s*([0-9]+)\s*개\s*추가/i) ??
    productName.match(/^코인\s*([0-9]+)\s*개$/i);
  if (!match) return 0;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function parseRewardCoinMultiplier(productName: string) {
  const match =
    productName.match(/코인\s*개수\s*([0-9]+(?:\.[0-9]+)?)\s*배/i) ??
    productName.match(/코인\s*([0-9]+(?:\.[0-9]+)?)\s*배(?:\s*뽑기권)?/i);
  if (!match) return 1;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return 1;
  return value;
}

function buildProbabilityAndRarity(
  list: Array<
    Omit<ShopProductSeed, "baseProbabilityPercent" | "isRare"> & {
      baseProbabilityPercent?: number | null;
    }
  >
) {
  const totals = new Map<ShopBoxCode, number>();
  for (const item of list) {
    totals.set(item.boxCode, (totals.get(item.boxCode) ?? 0) + item.quantity);
  }

  return list.map((item) => {
    const total = totals.get(item.boxCode) ?? 0;
    const baseProbabilityPercent =
      item.baseProbabilityPercent !== undefined && item.baseProbabilityPercent !== null
        ? item.baseProbabilityPercent
        : total > 0
          ? Math.round((item.quantity / total) * 1000000) / 10000
          : null;
    return {
      ...item,
      baseProbabilityPercent,
      isRare: baseProbabilityPercent !== null && baseProbabilityPercent < 5,
    } satisfies ShopProductSeed;
  });
}

export function loadShopCatalogDefaults() {
  const boxes = (["roulette", "bronze", "silver", "gold", "diamond"] as ShopBoxCode[]).map(
    (code) => SHOP_BOX_DEFAULTS[code]
  );

  const products = buildProbabilityAndRarity(
    STATIC_SHOP_PRODUCTS.map((item) => ({
      boxCode: item.boxCode,
      name: item.name,
      quantity: item.quantity,
      baseProbabilityPercent: item.baseProbabilityPercent ?? null,
      rewardCoinDelta: parseRewardCoinDelta(item.name),
      rewardCoinMultiplier: parseRewardCoinMultiplier(item.name),
    }))
  );

  return {
    boxes,
    products,
    sourceType: "defaults" as const,
  };
}

function normalizeProductName(value: string) {
  return String(value || "").trim().toLowerCase();
}

export function getShopProductDeliveryKind(productName: string): ShopDeliveryKind {
  const normalized = normalizeProductName(productName);
  if (!normalized) return "instant";

  if (
    normalized.includes("꽝") ||
    normalized.includes("뽑기권") ||
    (normalized.includes("코인") && normalized.includes("배")) ||
    /^코인\s*[0-9]+\s*개(?:\s*추가)?$/i.test(String(productName || ""))
  ) {
    return "instant";
  }

  if (normalized.includes("골드바") || normalized.includes("조말론")) {
    return "physical";
  }

  if (
    normalized.includes("cu") ||
    normalized.includes("스타벅스") ||
    normalized.includes("굽네") ||
    normalized.includes("베스킨라빈스") ||
    normalized.includes("베스킨") ||
    normalized.includes("페레로") ||
    normalized.includes("페로로") ||
    normalized.includes("마이쮸")
  ) {
    return "gifticon";
  }

  return "physical";
}

export function isShopDeliveryToggleAllowed(productName: string) {
  return getShopProductDeliveryKind(productName) !== "instant";
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function getUpcomingSaturdayKst(value: string | Date | null | undefined, order: 1 | 2) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const kstDate = new Date(date.getTime() + KST_OFFSET_MS);
  const saturdayDiff = (6 - kstDate.getUTCDay() + 7) % 7;
  const candidateUtcMs =
    Date.UTC(
      kstDate.getUTCFullYear(),
      kstDate.getUTCMonth(),
      kstDate.getUTCDate() + saturdayDiff,
      12,
      0,
      0
    ) - KST_OFFSET_MS;

  const firstEligibleUtcMs =
    candidateUtcMs >= date.getTime() ? candidateUtcMs : candidateUtcMs + 7 * 24 * 60 * 60 * 1000;

  const targetUtcMs = firstEligibleUtcMs + (order - 1) * 7 * 24 * 60 * 60 * 1000;
  return new Date(targetUtcMs);
}

export function formatShopDeliveryDate(
  value: string | Date | null | undefined,
  options?: { includeTime?: boolean }
) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    ...(options?.includeTime
      ? {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }
      : {}),
  }).format(date);
}

export function buildShopDeliveryScheduleText(options: {
  createdAt: string | Date | null | undefined;
  productName: string | null | undefined;
  deliveryCompleted: boolean;
}) {
  const productName = String(options.productName || "").trim();
  if (!productName || productName === "-") return "-";

  const kind = getShopProductDeliveryKind(productName);
  const receivedDate = formatShopDeliveryDate(options.createdAt);
  if (kind === "instant" || options.deliveryCompleted) {
    return `${receivedDate} · 지급완료`;
  }

  const targetDate = getUpcomingSaturdayKst(options.createdAt ?? null, kind === "gifticon" ? 1 : 2);
  if (!targetDate) return "-";
  return `${formatShopDeliveryDate(targetDate, { includeTime: true })} · 지급 예정`;
}

export function maskStudentName(name: string) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "익명";
  const chars = [...trimmed];
  if (chars.length <= 1) return `${chars[0]}*`;
  return `${chars[0]}${"X".repeat(Math.max(2, chars.length - 1))}`;
}

export function getNSeasonWeekRange(week: number) {
  const safeWeek = Math.max(1, Math.min(12, Math.round(week)));
  const baseUtcMs = Date.UTC(2026, 2, 13, 15, 0, 0); // 2026-03-14 00:00 KST
  const startMs = baseUtcMs + (safeWeek - 1) * 7 * 24 * 60 * 60 * 1000;
  const endMs = startMs + 7 * 24 * 60 * 60 * 1000;

  return {
    week: safeWeek,
    startUtc: new Date(startMs),
    endUtcExclusive: new Date(endMs),
    labelKst: `${safeWeek}주차`,
  };
}

export function getCurrentNSeasonWeekByDate(now = new Date()) {
  const baseUtcMs = Date.UTC(2026, 2, 13, 15, 0, 0); // 2026-03-14 00:00 KST
  const diffMs = now.getTime() - baseUtcMs;
  if (diffMs < 0) return null;
  const week = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
  if (week < 1 || week > 12) return null;
  return week;
}

export function getRareBannerWindowStartUtc(now = new Date()) {
  const currentWeek = getCurrentNSeasonWeekByDate(now);
  if (!currentWeek) return null;
  const resetWeek = currentWeek % 2 === 0 ? currentWeek : Math.max(1, currentWeek - 1);
  return getNSeasonWeekRange(resetWeek).startUtc;
}
