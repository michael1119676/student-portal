import { loadShopCatalogDefaults, ShopBoxCode } from "@/lib/shop";
import { createAdminClient } from "@/lib/supabase/admin";

type SupabaseClientLike = ReturnType<typeof createAdminClient>;

type SyncOptions = {
  resetRemaining?: boolean;
  adminId?: string | null;
};

export async function isShopSchemaReady(supabase: SupabaseClientLike) {
  const { error } = await supabase
    .from("shop_boxes")
    .select("id")
    .limit(1);
  return !error;
}

export async function syncShopCatalogFromDefaults(
  supabase: SupabaseClientLike,
  options: SyncOptions = {}
) {
  const { resetRemaining = false, adminId = null } = options;
  const catalog = loadShopCatalogDefaults();
  const now = new Date().toISOString();

  const boxRows = catalog.boxes.map((box) => ({
    code: box.code,
    name: box.name,
    coin_cost: box.coinCost,
    sort_order: box.sortOrder,
    is_active: true,
    updated_at: now,
  }));

  const { error: upsertBoxError } = await supabase
    .from("shop_boxes")
    .upsert(boxRows, { onConflict: "code" });
  if (upsertBoxError) {
    throw new Error(`상자 동기화 실패: ${upsertBoxError.message}`);
  }

  const { data: boxData, error: boxFetchError } = await supabase
    .from("shop_boxes")
    .select("id, code");
  if (boxFetchError || !boxData) {
    throw new Error(`상자 조회 실패: ${boxFetchError?.message ?? "unknown"}`);
  }

  const boxIdMap = new Map<ShopBoxCode, string>();
  for (const row of boxData) {
    boxIdMap.set(row.code as ShopBoxCode, row.id);
  }

  const productRows = catalog.products
    .map((product) => {
      const boxId = boxIdMap.get(product.boxCode);
      if (!boxId) return null;
      return {
        box_id: boxId,
        name: product.name,
        base_probability_percent: product.baseProbabilityPercent,
        is_rare: product.isRare,
        reward_coin_delta: product.rewardCoinDelta,
        reward_coin_multiplier: product.rewardCoinMultiplier,
        is_active: true,
        updated_at: now,
      };
    })
    .filter(Boolean);

  const { error: upsertProductError } = await supabase
    .from("shop_products")
    .upsert(productRows, { onConflict: "box_id,name" });
  if (upsertProductError) {
    throw new Error(`상품 동기화 실패: ${upsertProductError.message}`);
  }

  const targetBoxIds = [...boxIdMap.values()];
  const { data: allProducts, error: productFetchError } = await supabase
    .from("shop_products")
    .select("id, box_id, name")
    .in("box_id", targetBoxIds);
  if (productFetchError || !allProducts) {
    throw new Error(`상품 목록 조회 실패: ${productFetchError?.message ?? "unknown"}`);
  }

  const productIdByKey = new Map<string, string>();
  for (const row of allProducts) {
    productIdByKey.set(`${row.box_id}::${row.name}`, row.id);
  }

  const productIds = allProducts.map((row) => row.id);
  let inventoryRows:
    | Array<{
        product_id: string;
        initial_quantity: number;
        remaining_quantity: number;
      }>
    | [] = [];
  if (productIds.length > 0) {
    const { data: fetchedInventoryRows, error: inventoryFetchError } = await supabase
      .from("box_inventory")
      .select("product_id, initial_quantity, remaining_quantity")
      .in("product_id", productIds);
    if (inventoryFetchError) {
      throw new Error(`재고 조회 실패: ${inventoryFetchError.message}`);
    }
    inventoryRows = (fetchedInventoryRows ?? []) as typeof inventoryRows;
  }

  const inventoryMap = new Map<
    string,
    { initial_quantity: number; remaining_quantity: number }
  >();
  for (const row of inventoryRows) {
    inventoryMap.set(row.product_id, {
      initial_quantity: Number(row.initial_quantity ?? 0),
      remaining_quantity: Number(row.remaining_quantity ?? 0),
    });
  }

  const inventoryUpserts = catalog.products
    .map((product) => {
      const boxId = boxIdMap.get(product.boxCode);
      if (!boxId) return null;
      const productId = productIdByKey.get(`${boxId}::${product.name}`);
      if (!productId) return null;
      const existing = inventoryMap.get(productId);
      const nextInitial = product.quantity;

      let nextRemaining = nextInitial;
      if (existing) {
        if (resetRemaining) {
          nextRemaining = nextInitial;
        } else {
          const drawn = Math.max(existing.initial_quantity - existing.remaining_quantity, 0);
          nextRemaining = Math.max(nextInitial - drawn, 0);
        }
      }

      return {
        product_id: productId,
        initial_quantity: nextInitial,
        remaining_quantity: nextRemaining,
        updated_at: now,
      };
    })
    .filter(Boolean);

  const { error: inventoryUpsertError } = await supabase
    .from("box_inventory")
    .upsert(inventoryUpserts, { onConflict: "product_id" });
  if (inventoryUpsertError) {
    throw new Error(`재고 동기화 실패: ${inventoryUpsertError.message}`);
  }

  const productKeysFromDefaults = new Set(
    catalog.products
      .map((product) => {
        const boxId = boxIdMap.get(product.boxCode);
        if (!boxId) return null;
        return `${boxId}::${product.name}`;
      })
      .filter(Boolean)
  );

  const staleProductIds = allProducts
    .filter((row) => !productKeysFromDefaults.has(`${row.box_id}::${row.name}`))
    .map((row) => row.id);

  if (staleProductIds.length > 0) {
    await supabase
      .from("shop_products")
      .update({ is_active: false, updated_at: now })
      .in("id", staleProductIds);
  }

  await supabase.from("admin_action_logs").insert({
    admin_id: adminId,
    action_type: "default_shop_seed_sync",
    reason: `기본 상점값 동기화 실행 (reset=${resetRemaining})`,
    before_data: null,
    after_data: {
      box_count: catalog.boxes.length,
      product_count: catalog.products.length,
      source_type: catalog.sourceType,
    },
    created_at: now,
  });

  return {
    boxCount: catalog.boxes.length,
    productCount: catalog.products.length,
    sourceType: catalog.sourceType,
  };
}
