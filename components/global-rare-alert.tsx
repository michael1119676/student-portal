"use client";

import { useEffect, useRef, useState } from "react";

type RareFeedItem = {
  id: number;
  maskedName: string;
  boxCode: string;
  productName: string;
};

export default function GlobalRareAlert() {
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);
  const lastSeenIdRef = useRef(0);

  useEffect(() => {
    const timer = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/shop/feed?limit=1&rareOnly=1&afterId=${lastSeenIdRef.current}`, {
          cache: "no-store",
        });
        if (res.status === 401) return;
        const data = await res.json();
        if (!res.ok || !data.ok) return;
        const latest = (data.items?.[0] ?? null) as RareFeedItem | null;
        if (!latest) return;

        if (latest.id > lastSeenIdRef.current) {
          lastSeenIdRef.current = latest.id;
          setMessage(
            `${latest.maskedName} 학생 ${latest.boxCode.toUpperCase()} 상자에서 [${latest.productName}] 당첨!`
          );
          setVisible(true);
        }
      } catch {
        //
      }
    }, 7000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = window.setTimeout(() => setVisible(false), 5500);
    return () => window.clearTimeout(t);
  }, [visible]);

  if (!visible || !message) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-3">
      <div className="rounded-2xl border border-rose-300/40 bg-rose-500/20 px-4 py-2 text-sm text-rose-100 shadow-[0_0_30px_rgba(244,63,94,0.25)]">
        {message}
      </div>
    </div>
  );
}

