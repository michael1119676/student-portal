import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

export type ShopBoxCode = "bronze" | "silver" | "gold" | "diamond";

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
  bronze: { code: "bronze", name: "브론즈 상자", coinCost: 2, sortOrder: 1 },
  silver: { code: "silver", name: "실버 상자", coinCost: 3, sortOrder: 2 },
  gold: { code: "gold", name: "골드 상자", coinCost: 7, sortOrder: 3 },
  diamond: { code: "diamond", name: "다이아 상자", coinCost: 16, sortOrder: 4 },
};

type RawExcelRow = Array<string | number | boolean | null | undefined>;

const STATIC_SHOP_PRODUCTS: Array<{
  boxCode: ShopBoxCode;
  name: string;
  quantity: number;
}> = [
  { boxCode: "bronze", name: "CU 마이쮸", quantity: 200000 },
  { boxCode: "bronze", name: "코인 10개 추가", quantity: 2000 },
  { boxCode: "bronze", name: "한국표준금거래소 24K 순금 골드바 0.1g", quantity: 1000 },
  { boxCode: "bronze", name: "지금까지의 코인 개수 2배로", quantity: 200 },
  { boxCode: "bronze", name: "지금까지의 코인 개수 5배로", quantity: 100 },
  { boxCode: "silver", name: "CU 1,000원 기프트 카드", quantity: 10000 },
  { boxCode: "silver", name: "CU 2,000원 기프트 카드", quantity: 6000 },
  { boxCode: "silver", name: "CU 5,000원 기프트 카드", quantity: 3000 },
  { boxCode: "silver", name: "CU 10,000원 기프트 카드", quantity: 1000 },
  { boxCode: "gold", name: "CU 3,000원 기프트 카드", quantity: 6000 },
  { boxCode: "gold", name: "베스킨라빈스 싱글레귤러", quantity: 4000 },
  { boxCode: "gold", name: "스타벅스 아이스 아메리카노", quantity: 4000 },
  { boxCode: "gold", name: "페로로 로쉐 T8", quantity: 3000 },
  { boxCode: "gold", name: "굽네 오븐바사삭+콜라", quantity: 2000 },
  { boxCode: "gold", name: "조말론 블랙베리 앤 베이 핸드크림", quantity: 1000 },
  {
    boxCode: "diamond",
    name: "지인선 N제 Seoson2(공통+미적확통 하프 모의고사)",
    quantity: 1000,
  },
  { boxCode: "diamond", name: "페레로로쉐 T16", quantity: 1000 },
  { boxCode: "diamond", name: "CU 20,000원 기프트 카드", quantity: 600 },
  { boxCode: "diamond", name: "골드 상자 3회 뽑기권", quantity: 400 },
  { boxCode: "diamond", name: "베스킨라빈스 패밀리(5가지 맛)", quantity: 400 },
  { boxCode: "diamond", name: "메이레 혼공 뽀모도로 타이머 무소음", quantity: 400 },
  { boxCode: "diamond", name: "라미 사파리 볼펜(색상 선택 가능)", quantity: 350 },
  {
    boxCode: "diamond",
    name: "할리데이 일반물리학, Principles of Physics, 스튜어트 미분적분학 중 1권",
    quantity: 250,
  },
  {
    boxCode: "diamond",
    name: "연의 합격 26수능 샤프, 카의 합격 25수능 샤프 중 1개(재고 소진시 종료)",
    quantity: 250,
  },
  { boxCode: "diamond", name: "포켓쉴 대용량 보조바태리 20000mAh 22.5W", quantity: 150 },
  { boxCode: "diamond", name: "카오스 진자 키네틱아트 T형", quantity: 100 },
  { boxCode: "diamond", name: "카오스 진자 키네틱아트 A형", quantity: 50 },
  { boxCode: "diamond", name: "카오스 진자 키네틱아트 C형", quantity: 50 },
  { boxCode: "diamond", name: "순은 그래뉼 10g", quantity: 75 },
  {
    boxCode: "diamond",
    name: "한서준T와 오마카세 식사(한우, 스시, 양식 중 선택 가능)",
    quantity: 40,
  },
  { boxCode: "diamond", name: "에어팟4 MXP63KH/A 화이트", quantity: 25 },
  {
    boxCode: "diamond",
    name: "한국순금거래소 24K 순금 골드바 1g(학생 성함 각인 가능)",
    quantity: 10,
  },
];

function parseBoxMetaByHeader(header: string): Partial<ShopBoxSeed> & { code: ShopBoxCode } {
  const normalized = header.replace(/\s+/g, "");
  let code: ShopBoxCode = "bronze";
  if (normalized.includes("실버")) code = "silver";
  if (normalized.includes("골드")) code = "gold";
  if (normalized.includes("다이아")) code = "diamond";

  const defaultMeta = SHOP_BOX_DEFAULTS[code];
  const costMatch = header.match(/코인\s*([0-9]+)\s*개/);
  const cost = costMatch ? Number(costMatch[1]) : defaultMeta.coinCost;

  return {
    code,
    coinCost: Number.isFinite(cost) ? Math.max(0, Math.round(cost)) : defaultMeta.coinCost,
    name: defaultMeta.name,
    sortOrder: defaultMeta.sortOrder,
  };
}

function parseRewardCoinDelta(productName: string) {
  const match = productName.match(/코인\s*([0-9]+)\s*개\s*추가/i);
  if (!match) return 0;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function parseRewardCoinMultiplier(productName: string) {
  const match = productName.match(/코인\s*개수\s*([0-9]+)\s*배/i);
  if (!match) return 1;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return 1;
  return value;
}

function parseSheetRows(filePath: string) {
  const workbook = XLSX.readFile(filePath);
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [] as RawExcelRow[];
  return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
    header: 1,
    defval: "",
  }) as RawExcelRow[];
}

function parseProductsFromRows(rows: RawExcelRow[]) {
  const products: Array<Omit<ShopProductSeed, "baseProbabilityPercent" | "isRare">> = [];
  const boxOverrides = new Map<ShopBoxCode, Partial<ShopBoxSeed>>();
  let currentBox: ShopBoxCode | null = null;

  for (const row of rows) {
    const cell0 = String(row[0] ?? "").trim();
    const cell1Raw = row[1];

    if (!cell0 && (cell1Raw === "" || cell1Raw === null || cell1Raw === undefined)) {
      continue;
    }

    if (cell0.includes("상자") && cell0.includes("코인")) {
      const meta = parseBoxMetaByHeader(cell0);
      currentBox = meta.code;
      boxOverrides.set(meta.code, meta);
      continue;
    }

    if (!currentBox) continue;
    if (!cell0) continue;

    const quantity = Number(cell1Raw);
    if (!Number.isFinite(quantity)) continue;

    const safeQuantity = Math.max(0, Math.round(quantity));
    products.push({
      boxCode: currentBox,
      name: cell0,
      quantity: safeQuantity,
      rewardCoinDelta: parseRewardCoinDelta(cell0),
      rewardCoinMultiplier: parseRewardCoinMultiplier(cell0),
    });
  }

  return { products, boxOverrides };
}

function buildProbabilityAndRarity(
  list: Array<Omit<ShopProductSeed, "baseProbabilityPercent" | "isRare">>
) {
  const totals = new Map<ShopBoxCode, number>();
  for (const item of list) {
    totals.set(item.boxCode, (totals.get(item.boxCode) ?? 0) + item.quantity);
  }

  return list.map((item) => {
    const total = totals.get(item.boxCode) ?? 0;
    const baseProbabilityPercent =
      total > 0 ? Math.round((item.quantity / total) * 1000000) / 10000 : null;
    return {
      ...item,
      baseProbabilityPercent,
      isRare: baseProbabilityPercent !== null && baseProbabilityPercent < 5,
    } satisfies ShopProductSeed;
  });
}

export function loadShopCatalogFromExcel() {
  const bsgPath =
    process.env.SHOP_BSG_EXCEL_PATH ??
    path.join(process.cwd(), "data", "shop_bsg_boxes.xlsx");
  const diamondPath =
    process.env.SHOP_DIAMOND_EXCEL_PATH ??
    path.join(process.cwd(), "data", "shop_diamond_box.xlsx");

  const files = [bsgPath, diamondPath];

  const buildFromProducts = (
    products: Array<Omit<ShopProductSeed, "baseProbabilityPercent" | "isRare">>,
    boxOverrides?: Map<ShopBoxCode, Partial<ShopBoxSeed>>
  ) => {
    const mergedProducts = buildProbabilityAndRarity(products);
    const boxesMap = new Map<ShopBoxCode, ShopBoxSeed>();
    (Object.keys(SHOP_BOX_DEFAULTS) as ShopBoxCode[]).forEach((code) => {
      boxesMap.set(code, SHOP_BOX_DEFAULTS[code]);
    });

    for (const [code, override] of boxOverrides?.entries() ?? []) {
      const base = boxesMap.get(code) ?? SHOP_BOX_DEFAULTS[code];
      boxesMap.set(code, {
        ...base,
        ...override,
        code,
      });
    }

    const boxes = (["bronze", "silver", "gold", "diamond"] as ShopBoxCode[]).map(
      (code) => boxesMap.get(code) ?? SHOP_BOX_DEFAULTS[code]
    );
    return { boxes, products: mergedProducts };
  };

  try {
    for (const file of files) {
      if (!fs.existsSync(file)) {
        throw new Error(`엑셀 파일을 찾을 수 없습니다: ${file}`);
      }
    }
    const parsedChunks = files.map((file) => parseProductsFromRows(parseSheetRows(file)));
    const fromExcel = buildFromProducts(
      parsedChunks.flatMap((chunk) => chunk.products),
      new Map(parsedChunks.flatMap((chunk) => [...chunk.boxOverrides.entries()]))
    );
    return {
      ...fromExcel,
      sourceFiles: files,
      sourceType: "excel" as const,
    };
  } catch {
    const staticProducts: Array<Omit<ShopProductSeed, "baseProbabilityPercent" | "isRare">> =
      STATIC_SHOP_PRODUCTS.map((item) => ({
        boxCode: item.boxCode,
        name: item.name,
        quantity: item.quantity,
        rewardCoinDelta: parseRewardCoinDelta(item.name),
        rewardCoinMultiplier: parseRewardCoinMultiplier(item.name),
      }));

    const fromStatic = buildFromProducts(staticProducts);
    return {
      ...fromStatic,
      sourceFiles: [],
      sourceType: "static" as const,
    };
  }
}

export function maskStudentName(name: string) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "익명";
  const chars = [...trimmed];
  if (chars.length <= 1) return `${chars[0]}*`;
  return `${chars[0]}${"X".repeat(Math.max(2, chars.length - 1))}`;
}

export function formatKstDateTime(isoString: string | Date) {
  const date = typeof isoString === "string" ? new Date(isoString) : isoString;
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
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
