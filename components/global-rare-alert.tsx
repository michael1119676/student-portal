"use client";

import { useEffect, useMemo, useState } from "react";
import { getCurrentNSeasonWeekByDate, getRareBannerWindowStartUtc } from "@/lib/shop";

type RareFeedItem = {
  id: number;
  maskedName: string;
  boxCode: string;
  productName: string;
  createdAt: string;
};

export default function GlobalRareAlert() {
  const [items, setItems] = useState<RareFeedItem[]>([]);
  const [weekLabel, setWeekLabel] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const now = new Date();
        const currentWeek = getCurrentNSeasonWeekByDate(now);
        const fromUtc = getRareBannerWindowStartUtc(now);
        const params = new URLSearchParams();
        params.set("limit", "120");
        params.set("rareOnly", "1");
        if (fromUtc) {
          params.set("from", fromUtc.toISOString());
        }

        const res = await fetch(`/api/shop/feed?${params.toString()}`, {
          cache: "no-store",
        });
        if (res.status === 401 || cancelled) return;
        const data = await res.json();
        if (!res.ok || !data.ok) return;

        const nextItems = ((data.items ?? []) as RareFeedItem[]).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        if (!cancelled) {
          setItems(nextItems);
          setWeekLabel(currentWeek ? `N 시즌 ${currentWeek}주차` : "N 시즌");
        }
      } catch {
        //
      }
    };

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 7000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const tickerText = useMemo(() => {
    if (items.length === 0) {
      return "희귀 당첨 소식이 아직 없습니다.";
    }
    return items
      .map((row) => `${row.maskedName} 학생 ${row.boxCode.toUpperCase()} 상자 [${row.productName}]`)
      .join("   ✦   ");
  }, [items]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 border-b border-amber-200/20 bg-[#0a111d]/92 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2">
        <div className="shrink-0 rounded-full border border-amber-300/35 bg-amber-400/10 px-2 py-1 text-[10px] tracking-[0.16em] text-amber-100">
          희귀 당첨 배너
        </div>
        <div className="shrink-0 text-[11px] text-white/60">{weekLabel}</div>
        <div className="overflow-hidden whitespace-nowrap text-xs text-white/85">
          <div className="marquee-track">{`${tickerText}   ✦   ${tickerText}`}</div>
        </div>
      </div>
    </div>
  );
}
