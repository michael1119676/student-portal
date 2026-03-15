import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BOX_DEFAULTS = {
  bronze: { name: "브론즈 상자", coinCost: 2, sortOrder: 1 },
  silver: { name: "실버 상자", coinCost: 3, sortOrder: 2 },
  gold: { name: "골드 상자", coinCost: 7, sortOrder: 3 },
  diamond: { name: "다이아 상자", coinCost: 16, sortOrder: 4 },
};

function parseBoxMeta(header) {
  const normalized = String(header || "").replace(/\s+/g, "");
  let code = "bronze";
  if (normalized.includes("실버")) code = "silver";
  if (normalized.includes("골드")) code = "gold";
  if (normalized.includes("다이아")) code = "diamond";
  const defaultMeta = BOX_DEFAULTS[code];
  const costMatch = String(header || "").match(/코인\s*([0-9]+)\s*개/);
  return {
    code,
    name: defaultMeta.name,
    coinCost: costMatch ? Number(costMatch[1]) : defaultMeta.coinCost,
    sortOrder: defaultMeta.sortOrder,
  };
}

function parseRows(filePath) {
  const workbook = XLSX.readFile(filePath);
  const firstSheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
    header: 1,
    defval: "",
  });

  const result = [];
  let currentBox = null;

  for (const row of rows) {
    const name = String(row[0] ?? "").trim();
    const qtyRaw = row[1];
    if (!name && (qtyRaw === "" || qtyRaw === null || qtyRaw === undefined)) continue;

    if (name.includes("상자") && name.includes("코인")) {
      currentBox = parseBoxMeta(name);
      continue;
    }

    if (!currentBox) continue;
    const quantity = Number(qtyRaw);
    if (!Number.isFinite(quantity)) continue;

    result.push({
      boxCode: currentBox.code,
      boxName: currentBox.name,
      boxCost: currentBox.coinCost,
      boxSort: currentBox.sortOrder,
      name,
      quantity: Math.max(0, Math.round(quantity)),
    });
  }
  return result;
}

function buildCatalog() {
  const bsgPath =
    process.env.SHOP_BSG_EXCEL_PATH ??
    path.join(process.cwd(), "data", "shop_bsg_boxes.xlsx");
  const diaPath =
    process.env.SHOP_DIAMOND_EXCEL_PATH ??
    path.join(process.cwd(), "data", "shop_diamond_box.xlsx");

  if (!fs.existsSync(bsgPath) || !fs.existsSync(diaPath)) {
    throw new Error("엑셀 파일을 찾을 수 없습니다. data/shop_bsg_boxes.xlsx, data/shop_diamond_box.xlsx 확인");
  }

  const products = [...parseRows(bsgPath), ...parseRows(diaPath)];
  const totals = products.reduce((acc, item) => {
    acc[item.boxCode] = (acc[item.boxCode] || 0) + item.quantity;
    return acc;
  }, {});

  return products.map((item) => {
    const total = totals[item.boxCode] || 0;
    const probability = total > 0 ? Math.round((item.quantity / total) * 1000000) / 10000 : null;
    return {
      ...item,
      probability,
      isRare: probability !== null && probability < 5,
    };
  });
}

const products = buildCatalog();
const boxes = Object.values(
  products.reduce((acc, item) => {
    acc[item.boxCode] = {
      code: item.boxCode,
      name: item.boxName,
      coin_cost: item.boxCost,
      sort_order: item.boxSort,
      is_active: true,
      updated_at: new Date().toISOString(),
    };
    return acc;
  }, {})
);

const { error: boxErr } = await supabase
  .from("shop_boxes")
  .upsert(boxes, { onConflict: "code" });
if (boxErr) throw boxErr;

const { data: dbBoxes, error: dbBoxErr } = await supabase
  .from("shop_boxes")
  .select("id, code");
if (dbBoxErr) throw dbBoxErr;

const boxIdByCode = new Map(dbBoxes.map((row) => [row.code, row.id]));

const upsertProducts = products.map((item) => ({
  box_id: boxIdByCode.get(item.boxCode),
  name: item.name,
  base_probability_percent: item.probability,
  is_rare: item.isRare,
  reward_coin_delta: 0,
  reward_coin_multiplier: 1,
  is_active: true,
  updated_at: new Date().toISOString(),
}));

const { error: prodErr } = await supabase
  .from("shop_products")
  .upsert(upsertProducts, { onConflict: "box_id,name" });
if (prodErr) throw prodErr;

const { data: dbProducts, error: dbProdErr } = await supabase
  .from("shop_products")
  .select("id, box_id, name");
if (dbProdErr) throw dbProdErr;

const keyToProductId = new Map(dbProducts.map((row) => [`${row.box_id}::${row.name}`, row.id]));
const inventoryRows = products.map((item) => {
  const boxId = boxIdByCode.get(item.boxCode);
  return {
    product_id: keyToProductId.get(`${boxId}::${item.name}`),
    initial_quantity: item.quantity,
    remaining_quantity: item.quantity,
    updated_at: new Date().toISOString(),
  };
});

const { error: invErr } = await supabase
  .from("box_inventory")
  .upsert(inventoryRows, { onConflict: "product_id" });
if (invErr) throw invErr;

console.log(`shop synced: boxes=${boxes.length}, products=${products.length}`);

