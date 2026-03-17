"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Gift, RefreshCw, Shield, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildShopDeliveryScheduleText } from "@/lib/shop";
import { SessionUser } from "@/lib/session";

type ShopBox = {
  code: string;
  name: string;
  coinCost: number;
  remainingCount: number | null;
  productCount: number | null;
  ticketCount?: number;
};

type FeedItem = {
  id: number;
  maskedName: string;
  boxCode: string;
  productName: string;
  isRare: boolean;
  createdAt: string;
};

type MyLog = {
  id: number;
  createdAt: string;
  reason: string;
  delta: number;
  coinBefore: number;
  coinAfter: number;
  productName: string;
  boxCode: string | null;
  deliveryKind: string | null;
  deliveryCompleted: boolean;
  deliveryScheduleText: string;
};

type AdminStudent = {
  id: string;
  name: string;
  phone: string;
  className: string | null;
  coinBalance: number;
};

type AdminInventoryProduct = {
  id: string;
  name: string;
  baseProbabilityPercent: number | null;
  isRare: boolean;
  rewardCoinDelta: number;
  rewardCoinMultiplier: number;
  isActive: boolean;
  initialQuantity: number;
  remainingQuantity: number;
  updatedAt: string | null;
};

type AdminInventoryBox = {
  code: string;
  name: string;
  coinCost: number;
  products: AdminInventoryProduct[];
};

type StudentLogResponse = {
  student: {
    id: string;
    name: string;
    phone: string;
    className: string | null;
    coinBalance: number;
  };
  ledgerLogs: Array<{
    id: number;
    createdAt: string;
    eventType: string;
    reason: string;
    delta: number;
    coinBefore: number;
    coinAfter: number;
    relatedBoxCode: string | null;
    relatedProductName: string | null;
    actorRole: string;
    actorId: string | null;
  }>;
};

type WeeklyWinner = {
  id: number;
  createdAt: string;
  boxCode: string;
  productName: string;
  deliveryKind: string;
  deliveryCompleted: boolean;
  deliveryScheduleText: string;
  canToggleDelivery: boolean;
  studentId: string;
  studentName: string;
  studentPhone: string;
};

type ProbabilityProduct = {
  id: string;
  name: string;
  baseProbabilityPercent: number | null;
  realtimeProbabilityPercent: number | null;
  remainingQuantity: number | null;
  isRare: boolean;
};

type ProbabilityBox = {
  code: string;
  name: string;
  products: ProbabilityProduct[];
};

type AdminPanelTab = "inventory" | "studentLogs" | "weeklyLogs" | "coinAdjust";
type DrawCinematicPhase = "opening" | "result";

type DrawResult = {
  drawLogId: number;
  boxCode: string;
  productName: string;
  coinBefore: number;
  coinAfter: number;
  remainingQuantity: number | null;
  isRare: boolean;
};

type DrawRequestResult =
  | {
      ok: true;
      message: string;
      result: DrawResult;
    }
  | {
      ok: false;
      message: string;
    };

const BOX_VIDEO_ASSETS: Record<
  string,
  {
    waiting: string;
    opening: string;
  }
> = {
  roulette: {
    waiting: "/shop-videos/roulette-wait.png",
    opening: "/shop-videos/roulette-open.mp4",
  },
  bronze: {
    waiting: "/shop-videos/bronze-wait.mp4",
    opening: "/shop-videos/bronze-open.mp4",
  },
  silver: {
    waiting: "/shop-videos/silver-wait.mp4",
    opening: "/shop-videos/silver-open.mp4",
  },
  gold: {
    waiting: "/shop-videos/gold-wait.mp4",
    opening: "/shop-videos/gold-open.mp4",
  },
  diamond: {
    waiting: "/shop-videos/diamond-wait.mp4",
    opening: "/shop-videos/diamond-open.mp4",
  },
};

const BOX_KO_NAME_TO_CODE: Record<string, string> = {
  룰렛: "roulette",
  브론즈: "bronze",
  실버: "silver",
  골드: "gold",
  다이아: "diamond",
};

const BOX_CODE_TO_KO_NAME: Record<string, string> = {
  roulette: "룰렛",
  bronze: "브론즈",
  silver: "실버",
  gold: "골드",
  diamond: "다이아",
};

function getDisplayBoxName(box: { code: string; name: string }) {
  return box.code === "roulette" ? "룰렛" : box.name;
}

function parseTicketRewardDrawQueue(productName: string) {
  const match = String(productName || "").match(
    /(브론즈|실버|골드|다이아)\s*상자\s*([0-9]+)\s*회/i
  );
  if (!match) return [] as string[];

  const boxCode = BOX_KO_NAME_TO_CODE[match[1]];
  const count = Number(match[2]);
  if (!boxCode || !Number.isFinite(count) || count <= 0) return [] as string[];

  const safeCount = Math.min(100, Math.max(0, Math.round(count)));
  return Array.from({ length: safeCount }, () => boxCode);
}

function formatKst(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
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

function boxBadgeClass(code: string) {
  if (code === "roulette") return "from-emerald-500/75 to-lime-200/20";
  if (code === "bronze") return "from-amber-700/60 to-amber-500/20";
  if (code === "silver") return "from-slate-400/60 to-slate-100/20";
  if (code === "gold") return "from-yellow-500/70 to-yellow-200/20";
  return "from-cyan-400/70 to-blue-200/15";
}

export default function ShopClient({ initialUser }: { initialUser: SessionUser }) {
  const [coinBalance, setCoinBalance] = useState(0);
  const [boxes, setBoxes] = useState<ShopBox[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [myLogs, setMyLogs] = useState<MyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [openingBox, setOpeningBox] = useState<string | null>(null);
  const [drawCinematic, setDrawCinematic] = useState<{
    boxCode: string;
    phase: DrawCinematicPhase;
    resolvingResult: boolean;
  } | null>(null);
  const [drawResult, setDrawResult] = useState<DrawResult | null>(null);
  const lastFeedIdRef = useRef(0);
  const drawRequestRef = useRef<Promise<DrawRequestResult> | null>(null);
  const drawCloseTimerRef = useRef<number | null>(null);
  const autoDrawQueueRef = useRef<string[]>([]);
  const [autoDrawRemainingCount, setAutoDrawRemainingCount] = useState(0);
  const [adminTab, setAdminTab] = useState<AdminPanelTab>("inventory");
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [studentQuery, setStudentQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [studentLogData, setStudentLogData] = useState<StudentLogResponse | null>(null);
  const [week, setWeek] = useState(1);
  const [weeklyWinners, setWeeklyWinners] = useState<WeeklyWinner[]>([]);
  const [inventoryBoxes, setInventoryBoxes] = useState<AdminInventoryBox[]>([]);
  const [inventoryBoxCode, setInventoryBoxCode] = useState("bronze");
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryReason, setInventoryReason] = useState("");
  const [inventoryDraft, setInventoryDraft] = useState<Record<string, string>>({});
  const [inventoryAppliedMap, setInventoryAppliedMap] = useState<Record<string, boolean>>({});
  const [inventorySavingProductId, setInventorySavingProductId] = useState<string | null>(null);
  const [newProductName, setNewProductName] = useState("");
  const [newProductQty, setNewProductQty] = useState("");
  const [newProductProb, setNewProductProb] = useState("");
  const [newProductReason, setNewProductReason] = useState("");
  const [newProductRare, setNewProductRare] = useState(false);
  const [coinAdjustStudentId, setCoinAdjustStudentId] = useState("");
  const [coinAdjustDelta, setCoinAdjustDelta] = useState("");
  const [coinAdjustReason, setCoinAdjustReason] = useState("");
  const [probabilityModalOpen, setProbabilityModalOpen] = useState(false);
  const [probabilityLoading, setProbabilityLoading] = useState(false);
  const [probabilityBoxes, setProbabilityBoxes] = useState<ProbabilityBox[]>([]);
  const [deliveryUpdatingId, setDeliveryUpdatingId] = useState<number | null>(null);
  const isAdmin = initialUser.role === "admin";

  const filteredStudents = useMemo(() => {
    const keyword = studentQuery.trim().toLowerCase();
    if (!keyword) return students;
    return students.filter((student) =>
      `${student.name} ${student.phone}`.toLowerCase().includes(keyword)
    );
  }, [studentQuery, students]);

  const selectedInventoryBox = useMemo(
    () => inventoryBoxes.find((box) => box.code === inventoryBoxCode) ?? null,
    [inventoryBoxes, inventoryBoxCode]
  );

  const selectedInventoryRealtimeProbability = useMemo(() => {
    const rows = selectedInventoryBox?.products ?? [];
    const totalRemaining = rows.reduce(
      (acc, product) => acc + Math.max(0, Number(product.remainingQuantity ?? 0)),
      0
    );
    const map = new Map<string, number | null>();
    for (const product of rows) {
      const remaining = Math.max(0, Number(product.remainingQuantity ?? 0));
      const probability =
        totalRemaining > 0 ? Math.round((remaining / totalRemaining) * 1000000) / 10000 : null;
      map.set(product.id, probability);
    }
    return map;
  }, [selectedInventoryBox]);

  const boxNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const box of boxes) {
      map[box.code] = getDisplayBoxName(box);
    }
    return map;
  }, [boxes]);

  const tickerText = useMemo(() => {
    if (feed.length === 0) return "아직 희귀 당첨 기록이 없습니다.";
    return feed
      .map(
        (item) =>
          `${item.maskedName} 학생 ${BOX_CODE_TO_KO_NAME[item.boxCode] ?? item.boxCode.toUpperCase()} 상자 ${item.productName} 당첨`
      )
      .join("   ✦   ");
  }, [feed]);

  const fetchOverview = async () => {
    const res = await fetch("/api/shop/overview", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.message || "상점 정보를 불러오지 못했습니다.");
    }
    setCoinBalance(Number(data.coinBalance ?? 0));
    setBoxes((data.boxes ?? []) as ShopBox[]);
    const rareFeed = ((data.recentFeed ?? []) as FeedItem[]).filter((item) => item.isRare);
    setFeed(rareFeed);
    const latestId = Math.max(0, ...rareFeed.map((item) => item.id));
    lastFeedIdRef.current = Math.max(lastFeedIdRef.current, latestId);
  };

  const fetchMyLogs = async () => {
    const res = await fetch("/api/shop/my-logs", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.message || "내역을 불러오지 못했습니다.");
    }
    setMyLogs((data.logs ?? []) as MyLog[]);
  };

  const fetchProbabilityTable = async () => {
    setProbabilityLoading(true);
    try {
      const res = await fetch("/api/shop/probability-table", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "확률 고지표를 불러오지 못했습니다.");
      }
      setProbabilityBoxes((data.boxes ?? []) as ProbabilityBox[]);
    } finally {
      setProbabilityLoading(false);
    }
  };

  const fetchAdminStudents = useCallback(async () => {
    if (!isAdmin) return;
    const res = await fetch("/api/admin/shop/students", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.message || "학생 목록을 불러오지 못했습니다.");
    }
    setStudents((data.students ?? []) as AdminStudent[]);
  }, [isAdmin]);

  const fetchInventory = useCallback(async (appliedProductId?: string | null) => {
    if (!isAdmin) return;
    setInventoryLoading(true);
    try {
      const res = await fetch("/api/admin/shop/inventory", {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "재고를 불러오지 못했습니다.");
      }
      const nextBoxes = (data.boxes ?? []) as AdminInventoryBox[];
      setInventoryBoxes(nextBoxes);
      setInventoryDraft(
        nextBoxes.reduce<Record<string, string>>((acc, box) => {
          for (const product of box.products) {
            acc[product.id] = String(product.remainingQuantity);
          }
          return acc;
        }, {})
      );
      setInventoryAppliedMap(() => {
        if (!appliedProductId) return {};
        const stillExists = nextBoxes.some((box) =>
          box.products.some((product) => product.id === appliedProductId)
        );
        return stillExists ? { [appliedProductId]: true } : {};
      });
      if (nextBoxes.length > 0 && !nextBoxes.some((box) => box.code === inventoryBoxCode)) {
        setInventoryBoxCode(nextBoxes[0].code);
      }
    } finally {
      setInventoryLoading(false);
    }
  }, [isAdmin, inventoryBoxCode]);

  const fetchStudentLogs = async (studentId: string) => {
    if (!isAdmin || !studentId) return;
    const res = await fetch(
      `/api/admin/shop/student-logs?studentId=${encodeURIComponent(studentId)}`,
      { cache: "no-store" }
    );
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.message || "학생 로그를 불러오지 못했습니다.");
    }
    setStudentLogData(data as StudentLogResponse);
  };

  const fetchWeeklyWinners = useCallback(
    async (targetWeek: number) => {
      if (!isAdmin) return;
      const res = await fetch(`/api/admin/shop/weekly-winners?week=${targetWeek}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "전체 로그를 불러오지 못했습니다.");
      }
      setWeeklyWinners((data.winners ?? []) as WeeklyWinner[]);
    },
    [isAdmin]
  );

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setMessage("");
      try {
        await fetchOverview();
        await fetchMyLogs();
        if (isAdmin) {
          await fetchAdminStudents();
          await fetchInventory();
          await fetchWeeklyWinners(1);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "상점 로딩에 실패했습니다.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, fetchAdminStudents, fetchInventory, fetchWeeklyWinners]);

  useEffect(() => {
    const timer = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/shop/feed?limit=25&rareOnly=1&afterId=${lastFeedIdRef.current}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok || !data.ok) return;
        const items = (data.items ?? []) as FeedItem[];
        if (items.length === 0) return;

        const maxId = Math.max(...items.map((item) => item.id));
        lastFeedIdRef.current = Math.max(lastFeedIdRef.current, maxId);
        setFeed((prev) => {
          const merged = [...items, ...prev];
          const uniqueById = new Map<number, FeedItem>();
          for (const row of merged) {
            uniqueById.set(row.id, row);
          }
          return [...uniqueById.values()]
            .sort((a, b) => b.id - a.id)
            .slice(0, 25);
        });
      } catch {
        //
      }
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(
    () => () => {
      if (drawCloseTimerRef.current) {
        window.clearTimeout(drawCloseTimerRef.current);
      }
    },
    []
  );

  const requestDraw = async (boxCode: string): Promise<DrawRequestResult> => {
    try {
      const res = await fetch("/api/shop/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boxCode }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        return {
          ok: false,
          message: data.message || "상자 열기에 실패했습니다.",
        };
      }
      return {
        ok: true,
        message: data.message || "상자 열기에 성공했습니다.",
        result: data.result as DrawResult,
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "상자 열기에 실패했습니다.",
      };
    }
  };

  const resolveOpeningResult = async (requestedBoxCode: string) => {
    if (!drawRequestRef.current) return;

    setDrawCinematic((prev) =>
      prev && prev.phase === "opening" && prev.boxCode === requestedBoxCode
        ? { ...prev, resolvingResult: true }
        : prev
    );

    const response = await drawRequestRef.current;
    drawRequestRef.current = null;

    if (!response.ok) {
      clearAutoDrawQueue();
      closeCinematic({ continueAuto: false });
      setMessage(response.message || "상자 열기에 실패했습니다.");
      return;
    }

    const result = response.result;
    const bonusQueue = parseTicketRewardDrawQueue(response.message);
    if (bonusQueue.length > 0) {
      enqueueAutoDraws(bonusQueue);
    }
    setDrawResult(result);
    setDrawCinematic({
      boxCode: result.boxCode,
      phase: "result",
      resolvingResult: false,
    });
    const bonusNotice =
      bonusQueue.length > 0
        ? ` → ${BOX_CODE_TO_KO_NAME[bonusQueue[0]] ?? bonusQueue[0]} 상자 ${bonusQueue.length}회 자동 개봉`
        : "";
    setMessage(
      `${BOX_CODE_TO_KO_NAME[result.boxCode] ?? String(result.boxCode).toUpperCase()} 상자에서 [${result.productName}] 당첨! (코인 ${result.coinBefore} → ${result.coinAfter})${bonusNotice}`
    );

    void (async () => {
      try {
        await fetchOverview();
        await fetchMyLogs();
        if (isAdmin) {
          await fetchInventory();
        }
      } catch (error) {
        setMessage((prev) =>
          prev || (error instanceof Error ? error.message : "상점 정보를 새로고침하지 못했습니다.")
        );
      }
    })();

    drawCloseTimerRef.current = window.setTimeout(() => {
      closeCinematic();
    }, 10000);
  };

  const clearAutoDrawQueue = () => {
    autoDrawQueueRef.current = [];
    setAutoDrawRemainingCount(0);
  };

  const enqueueAutoDraws = (boxCodes: string[]) => {
    if (boxCodes.length === 0) return;
    autoDrawQueueRef.current = [...autoDrawQueueRef.current, ...boxCodes];
    setAutoDrawRemainingCount(autoDrawQueueRef.current.length);
  };

  const dequeueAutoDraw = () => {
    const nextBoxCode = autoDrawQueueRef.current.shift() ?? null;
    setAutoDrawRemainingCount(autoDrawQueueRef.current.length);
    return nextBoxCode;
  };

  const startDraw = (
    boxCode: string,
    options?: {
      fromAuto?: boolean;
      queuedAfterCurrent?: number;
    }
  ) => {
    if (drawCloseTimerRef.current) {
      window.clearTimeout(drawCloseTimerRef.current);
      drawCloseTimerRef.current = null;
    }
    if (options?.fromAuto) {
      const remainingIncludingCurrent = (options.queuedAfterCurrent ?? 0) + 1;
      setMessage(`보너스 상자 자동 개봉 진행 중... (${remainingIncludingCurrent}회 남음)`);
    } else {
      setMessage("");
    }
    setOpeningBox(boxCode);
    setDrawResult(null);
    setDrawCinematic({
      boxCode,
      phase: "opening",
      resolvingResult: false,
    });
    drawRequestRef.current = requestDraw(boxCode);
    if (!BOX_VIDEO_ASSETS[boxCode]?.opening) {
      window.setTimeout(() => {
        void resolveOpeningResult(boxCode);
      }, 1400);
    }
  };

  const closeCinematic = (options?: { continueAuto?: boolean }) => {
    if (drawCloseTimerRef.current) {
      window.clearTimeout(drawCloseTimerRef.current);
      drawCloseTimerRef.current = null;
    }
    drawRequestRef.current = null;
    setDrawCinematic(null);
    setDrawResult(null);
    setOpeningBox(null);

    if (options?.continueAuto === false) return;

    const nextBoxCode = dequeueAutoDraw();
    if (!nextBoxCode) return;

    const queuedAfterCurrent = autoDrawQueueRef.current.length;
    window.setTimeout(() => {
      startDraw(nextBoxCode, { fromAuto: true, queuedAfterCurrent });
    }, 180);
  };

  const handleDraw = (boxCode: string) => {
    if (openingBox) return;
    if (autoDrawQueueRef.current.length > 0) {
      setMessage("보너스 상자 자동 개봉이 진행 중입니다. 잠시만 기다려 주세요.");
      return;
    }
    startDraw(boxCode);
  };

  const handleCinematicVideoEnded = async () => {
    if (!drawCinematic) return;

    if (drawCinematic.phase !== "opening") {
      return;
    }
    await resolveOpeningResult(drawCinematic.boxCode);
  };

  const handleCinematicVideoError = () => {
    if (!drawCinematic) return;
    if (drawCinematic.phase === "opening") {
      void handleCinematicVideoEnded();
    }
  };

  const handleInventorySave = async (productId: string) => {
    const nextQuantity = Number(inventoryDraft[productId] ?? "");
    if (!Number.isFinite(nextQuantity)) {
      setMessage("수량은 숫자로 입력해 주세요.");
      return;
    }
    if (!inventoryReason.trim()) {
      setMessage("재고 수정 사유를 입력해 주세요.");
      return;
    }

    try {
      setInventorySavingProductId(productId);
      const res = await fetch("/api/admin/shop/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          remainingQuantity: Math.max(0, Math.round(nextQuantity)),
          reason: inventoryReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMessage(data.message || "재고 수정에 실패했습니다.");
        return;
      }

      setMessage(data.message || "재고 수정 완료");
      await fetchOverview();
      await fetchInventory(productId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "재고 수정에 실패했습니다.");
    } finally {
      setInventorySavingProductId(null);
    }
  };

  const handleAddProduct = async () => {
    const quantity = Number(newProductQty);
    const probability = newProductProb.trim() ? Number(newProductProb) : null;
    if (!newProductName.trim() || !Number.isFinite(quantity)) {
      setMessage("신규 상품명과 수량을 입력해 주세요.");
      return;
    }
    if (!newProductReason.trim()) {
      setMessage("신규 상품 추가 사유를 입력해 주세요.");
      return;
    }

    const res = await fetch("/api/admin/shop/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        boxCode: inventoryBoxCode,
        name: newProductName.trim(),
        quantity: Math.max(0, Math.round(quantity)),
        baseProbabilityPercent: probability,
        isRare: newProductRare,
        reason: newProductReason.trim(),
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setMessage(data.message || "상품 추가에 실패했습니다.");
      return;
    }

    setMessage(data.message || "상품 추가 완료");
    setNewProductName("");
    setNewProductQty("");
    setNewProductProb("");
    setNewProductReason("");
    setNewProductRare(false);
    await fetchOverview();
    await fetchInventory();
  };

  const handleCoinAdjust = async () => {
    if (!coinAdjustStudentId) {
      setMessage("코인 조정 대상을 선택해 주세요.");
      return;
    }
    const delta = Number(coinAdjustDelta);
    if (!Number.isFinite(delta) || Math.round(delta) === 0) {
      setMessage("증감 수량을 정확히 입력해 주세요.");
      return;
    }
    if (!coinAdjustReason.trim()) {
      setMessage("사유를 입력해 주세요.");
      return;
    }

    const res = await fetch("/api/admin/shop/coin-adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: coinAdjustStudentId,
        delta: Math.round(delta),
        reason: coinAdjustReason.trim(),
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setMessage(data.message || "코인 조정에 실패했습니다.");
      return;
    }
    setMessage(data.message || "코인 조정 완료");
    setCoinAdjustDelta("");
    setCoinAdjustReason("");
    await fetchAdminStudents();
    await fetchOverview();
    if (selectedStudentId) {
      await fetchStudentLogs(selectedStudentId);
    }
  };

  const handleDeliveryToggle = async (drawLogId: number, deliveryCompleted: boolean) => {
    setDeliveryUpdatingId(drawLogId);
    try {
      const res = await fetch("/api/admin/shop/delivery-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drawLogId,
          deliveryCompleted,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMessage(data.message || "지급 상태 수정에 실패했습니다.");
        return;
      }

      setMessage(data.message || "지급 상태를 반영했습니다.");
      setWeeklyWinners((prev) =>
        prev.map((winner) =>
          winner.id !== drawLogId
            ? winner
            : {
                ...winner,
                deliveryCompleted,
                deliveryScheduleText: buildShopDeliveryScheduleText({
                  createdAt: winner.createdAt,
                  productName: winner.productName,
                  deliveryCompleted,
                }),
              }
        )
      );
      await fetchWeeklyWinners(week);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "지급 상태 수정에 실패했습니다.");
    } finally {
      setDeliveryUpdatingId(null);
    }
  };

  const cinematicBoxName = drawCinematic
    ? boxNameMap[drawCinematic.boxCode] ??
      `${BOX_CODE_TO_KO_NAME[drawCinematic.boxCode] ?? drawCinematic.boxCode.toUpperCase()} 상자`
    : "";
  const cinematicVideoSrc =
    drawCinematic && drawCinematic.phase !== "result"
      ? BOX_VIDEO_ASSETS[drawCinematic.boxCode]?.opening ?? null
      : null;

  return (
    <main className="min-h-screen bg-[#04070d] px-4 py-8 text-white sm:px-8">
      <div
        className="pointer-events-none fixed inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(250,204,21,0.18), transparent 35%), radial-gradient(circle at 80% 10%, rgba(14,165,233,0.18), transparent 32%), radial-gradient(circle at 50% 100%, rgba(248,113,113,0.08), transparent 32%)",
        }}
      />

      {drawCinematic && (
        <div className="fixed inset-0 z-[70]">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div className="relative z-[71] mx-auto flex h-full w-full max-w-5xl items-center justify-center px-4">
            {drawCinematic.phase !== "result" ? (
              <div className="w-full overflow-hidden rounded-[2rem] border border-white/20 bg-black/70 shadow-[0_30px_100px_rgba(0,0,0,0.6)]">
                <div className="border-b border-white/10 px-6 py-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-amber-200/80">{cinematicBoxName}</p>
                  <p className="mt-1 text-base font-medium text-white">
                    {drawCinematic.boxCode === "roulette" ? "룰렛 돌리는 중..." : "상자 개봉 중..."}
                  </p>
                </div>
                {cinematicVideoSrc ? (
                  <video
                    key={`${drawCinematic.boxCode}-${drawCinematic.phase}`}
                    src={cinematicVideoSrc}
                    autoPlay
                    playsInline
                    preload="auto"
                    className="max-h-[70vh] w-full bg-black object-contain"
                    onEnded={() => void handleCinematicVideoEnded()}
                    onError={handleCinematicVideoError}
                  />
                ) : (
                  <div className="flex h-[56vh] flex-col items-center justify-center gap-4 bg-black/70 text-white/70">
                    <RefreshCw className="h-10 w-10 animate-spin text-amber-200/80" />
                    <div className="text-center">
                      <p className="text-base font-medium text-white">
                        {drawCinematic.boxCode === "roulette" ? "룰렛을 돌리고 있습니다..." : "상자를 개봉하고 있습니다..."}
                      </p>
                      <p className="mt-1 text-sm text-white/55">
                        영상 없이 바로 결과를 계산하는 상자입니다.
                      </p>
                    </div>
                  </div>
                )}
                {drawCinematic.resolvingResult && (
                  <div className="border-t border-white/10 px-6 py-3 text-center text-sm text-white/70">
                    당첨 결과를 확인하고 있습니다...
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full max-w-xl rounded-[2rem] border border-amber-200/40 bg-gradient-to-b from-black/90 via-[#121726] to-black/90 px-8 py-10 text-center shadow-[0_25px_120px_rgba(250,204,21,0.18)]">
                <p className="text-xs uppercase tracking-[0.26em] text-amber-200/85">{cinematicBoxName}</p>
                <p className="mt-3 text-sm text-white/70">당첨 상품</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  {drawResult?.productName ?? "-"}
                </p>
                <p className="mt-5 text-sm text-amber-100/90">
                  코인 {drawResult?.coinBefore ?? 0} → {drawResult?.coinAfter ?? 0}
                </p>
                <div className="mt-7">
                  <Button
                    className="rounded-2xl bg-amber-300 px-6 text-black hover:bg-amber-200"
                    onClick={() => closeCinematic()}
                  >
                    확인
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {probabilityModalOpen && (
        <div className="fixed inset-0 z-[72]">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setProbabilityModalOpen(false)}
          />
          <div className="relative z-[73] mx-auto mt-8 w-[min(1100px,calc(100%-2rem))] overflow-hidden rounded-[2rem] border border-white/20 bg-[#070b13] shadow-[0_40px_120px_rgba(0,0,0,0.65)]">
            <div className="flex items-start justify-between border-b border-white/10 px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-amber-200/80">Probability Notice</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">상자별 상품 확률 고지표</h2>
                {isAdmin && (
                  <p className="mt-1 text-xs text-white/55">
                    초기 확률은 상점 기준값이며, 실제 추첨은 비복원(남은 재고) 기준으로 진행됩니다.
                  </p>
                )}
              </div>
              <Button
                variant="secondary"
                className="rounded-xl bg-white/10 text-white hover:bg-white/20"
                onClick={() => setProbabilityModalOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-h-[72vh] overflow-y-auto p-6">
              {probabilityLoading ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-white/65">
                  확률 고지표를 불러오는 중...
                </div>
              ) : probabilityBoxes.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-white/65">
                  표시할 확률 정보가 없습니다.
                </div>
              ) : (
                <div className="space-y-4">
                  {probabilityBoxes.map((box) => (
                    <div key={box.code} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="mb-3 text-sm font-medium text-white">{getDisplayBoxName(box)}</p>
                      <div className="overflow-x-auto rounded-xl border border-white/10">
                        <table className="w-full min-w-[700px] text-sm">
                          <thead className="bg-black/40 text-white/65">
                            <tr>
                              <th className="px-3 py-2 text-left">상품명</th>
                              <th className="px-3 py-2 text-left">
                                {isAdmin ? "초기 확률(%)" : "확률(%)"}
                              </th>
                              {isAdmin && <th className="px-3 py-2 text-left">실시간 확률(%)</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {box.products.map((product) => (
                              <tr key={product.id} className="border-t border-white/10">
                                <td className="px-3 py-2">{product.name}</td>
                                <td className="px-3 py-2">
                                  {product.baseProbabilityPercent === null
                                    ? "-"
                                    : product.baseProbabilityPercent.toFixed(4)}
                                </td>
                                {isAdmin && (
                                  <td className="px-3 py-2">
                                    {product.realtimeProbabilityPercent === null
                                      ? "-"
                                      : product.realtimeProbabilityPercent.toFixed(4)}
                                  </td>
                                )}
                              </tr>
                            ))}
                            {box.products.length === 0 && (
                              <tr>
                                <td
                                  colSpan={isAdmin ? 3 : 2}
                                  className="px-3 py-4 text-center text-white/55"
                                >
                                  등록된 상품이 없습니다.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-amber-200/70">Treasure Shop</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">보물상자 상점</h1>
            <p className="mt-1 text-sm text-white/60">
              상자 오픈, 코인 사용 내역, 당첨 기록이 모두 저장됩니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={isAdmin ? "/admin" : "/"}>
              <Button
                variant="secondary"
                className="rounded-2xl bg-white/10 text-white hover:bg-white/20"
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                포털로 돌아가기
              </Button>
            </Link>
            <Button
              variant="secondary"
              className="rounded-2xl bg-white/10 text-white hover:bg-white/20"
              onClick={() => {
                setProbabilityModalOpen(true);
                void fetchProbabilityTable().catch((error) => {
                  setMessage(error instanceof Error ? error.message : "확률 고지표를 불러오지 못했습니다.");
                });
              }}
            >
              확률 고지표
            </Button>
            <Button
              variant="secondary"
              className="rounded-2xl bg-white/10 text-white hover:bg-white/20"
              onClick={() => {
                void fetchOverview();
                void fetchMyLogs();
              }}
            >
              <RefreshCw className="mr-1 h-4 w-4" />
              새로고침
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/80">
          기프티콘 상품은 매주 토요일에 지급되며, 실물 상품은 배송 일정에 따라 지급에 최대
          2주 소요될 수 있습니다.
        </div>

        <div className="rounded-2xl border border-amber-200/20 bg-amber-400/10 px-4 py-3">
          <p className="text-sm text-amber-100">
            현재 보유 코인: <span className="font-semibold">{coinBalance}</span>
          </p>
        </div>

        {autoDrawRemainingCount > 0 && (
          <div className="rounded-2xl border border-amber-200/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
            보너스 상자 자동 개봉 대기: {autoDrawRemainingCount}회
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
          <p className="mb-2 text-xs text-white/60">희귀 당첨 내역</p>
          <div className="overflow-hidden whitespace-nowrap rounded-xl border border-white/10 bg-black/30 py-2">
            <div className="marquee-track px-4 text-sm text-white/80">{`${tickerText}   ✦   ${tickerText}`}</div>
          </div>
        </div>

        {loading ? (
          <Card className="rounded-[2rem] border border-white/10 bg-white/5 text-white">
            <CardContent className="py-8 text-center text-white/70">상점 정보를 불러오는 중...</CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {boxes.map((box) => {
              const isOpening = openingBox === box.code;
              const isRoulette = box.code === "roulette";
              const soldOut = box.remainingCount === 0;
              const hasTicket = Number(box.ticketCount ?? 0) > 0;
              const canOpen = (hasTicket || coinBalance >= box.coinCost) && !soldOut && !isOpening;
              const waitingMediaSrc = BOX_VIDEO_ASSETS[box.code]?.waiting ?? null;
              const waitingIsVideo = !!waitingMediaSrc && /\.(mp4|webm|ogg)$/i.test(waitingMediaSrc);
              const displayBoxName = getDisplayBoxName(box);
              return (
                <Card
                  key={box.code}
                  className={`rounded-[2rem] border border-white/10 bg-black/35 text-white shadow-xl transition ${
                    isOpening ? "scale-[1.01] ring-2 ring-amber-300/50" : ""
                  }`}
                >
                  <CardHeader>
                    <div
                      className={`mb-2 inline-flex w-fit rounded-full bg-gradient-to-r px-3 py-1 text-xs text-white/85 ${boxBadgeClass(box.code)}`}
                    >
                      {displayBoxName}
                    </div>
                    <CardTitle className="text-2xl">{box.coinCost} 코인</CardTitle>
                    <CardDescription className="text-white/55">
                      {isAdmin
                        ? `남은 재고 ${box.remainingCount ?? "-"}개 · 상품 ${box.productCount ?? "-"}종`
                        : `${isRoulette ? "코인으로 룰렛을 돌려 랜덤 상품을 획득할 수 있습니다" : "코인으로 상자를 열고 랜덤 상품을 획득할 수 있습니다."}${hasTicket ? ` 무료권 ${box.ticketCount}장 보유` : ""}`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="relative h-24 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                      {waitingMediaSrc ? (
                        waitingIsVideo ? (
                          <video
                            key={`${box.code}-waiting`}
                            src={waitingMediaSrc}
                            autoPlay
                            loop
                            muted
                            playsInline
                            preload="metadata"
                            className="h-24 w-full object-cover opacity-85"
                          />
                        ) : (
                          <Image
                            src={waitingMediaSrc}
                            alt={`${displayBoxName} 대기 이미지`}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
                            className="object-cover opacity-90"
                          />
                        )
                      ) : (
                        <div className="flex h-24 items-center justify-center">
                          <Gift
                            className={`h-10 w-10 text-amber-200 transition-all duration-500 ${
                              isOpening ? "animate-pulse scale-110" : ""
                            }`}
                          />
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
                    </div>
                    <Button
                      onClick={() => void handleDraw(box.code)}
                      disabled={!canOpen}
                      className="w-full rounded-2xl bg-amber-300 text-black hover:bg-amber-200 disabled:bg-white/20 disabled:text-white/50"
                    >
                      {soldOut
                        ? "재고 소진"
                        : !hasTicket && coinBalance < box.coinCost
                          ? "코인 부족"
                        : isOpening
                          ? isRoulette
                            ? "돌리는 중..."
                            : "오픈 중..."
                          : hasTicket
                            ? isRoulette
                              ? `무료권 사용 돌리기 (${box.ticketCount})`
                              : `무료권 사용 열기 (${box.ticketCount})`
                            : isRoulette
                              ? "룰렛 돌리기"
                              : "상자 열기"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {message && (
          <div className="rounded-2xl border border-cyan-200/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
            {message}
          </div>
        )}

        <Card className="rounded-[2rem] border border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle className="text-xl">내 코인/뽑기 기록</CardTitle>
            <CardDescription className="text-white/55">
              날짜&시각(KST), 사유, 변동 전/후 코인, 획득 상품
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="text-white/60">
                <tr>
                  <th className="px-3 py-2 text-left">날짜&시각</th>
                  <th className="px-3 py-2 text-left">사유</th>
                  <th className="px-3 py-2 text-left">변동량</th>
                  <th className="px-3 py-2 text-left">변동 전 코인</th>
                  <th className="px-3 py-2 text-left">변동 후 코인</th>
                  <th className="px-3 py-2 text-left">획득 상품</th>
                  <th className="px-3 py-2 text-left">지급 일정</th>
                </tr>
              </thead>
              <tbody>
                {myLogs.map((row) => (
                  <tr key={row.id} className="border-t border-white/10">
                    <td className="px-3 py-2">{formatKst(row.createdAt)}</td>
                    <td className="px-3 py-2">{row.reason}</td>
                    <td className="px-3 py-2">{row.delta > 0 ? `+${row.delta}` : row.delta}</td>
                    <td className="px-3 py-2">{row.coinBefore}</td>
                    <td className="px-3 py-2">{row.coinAfter}</td>
                    <td className="px-3 py-2">{row.productName || "-"}</td>
                    <td className="px-3 py-2">{row.deliveryScheduleText || "-"}</td>
                  </tr>
                ))}
                {!myLogs.length && (
                  <tr>
                    <td colSpan={7} className="px-3 py-4 text-center text-white/55">
                      아직 기록이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card className="rounded-[2rem] border border-cyan-300/25 bg-cyan-500/10 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Shield className="h-5 w-5 text-cyan-100" />
                관리자 전용 기능
              </CardTitle>
              <CardDescription className="text-cyan-50/75">
                재고/학생별 로그/전체 로그/코인 조정을 관리할 수 있습니다.
              </CardDescription>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variant={adminTab === "inventory" ? "default" : "secondary"}
                  className={
                    adminTab === "inventory"
                      ? "rounded-2xl bg-white text-black hover:bg-white/90"
                      : "rounded-2xl bg-white/10 text-white hover:bg-white/20"
                  }
                  onClick={() => setAdminTab("inventory")}
                >
                  각 상자별 남은 상품 확인
                </Button>
                <Button
                  variant={adminTab === "studentLogs" ? "default" : "secondary"}
                  className={
                    adminTab === "studentLogs"
                      ? "rounded-2xl bg-white text-black hover:bg-white/90"
                      : "rounded-2xl bg-white/10 text-white hover:bg-white/20"
                  }
                  onClick={() => setAdminTab("studentLogs")}
                >
                  학생별 로그 보기
                </Button>
                <Button
                  variant={adminTab === "weeklyLogs" ? "default" : "secondary"}
                  className={
                    adminTab === "weeklyLogs"
                      ? "rounded-2xl bg-white text-black hover:bg-white/90"
                      : "rounded-2xl bg-white/10 text-white hover:bg-white/20"
                  }
                  onClick={() => setAdminTab("weeklyLogs")}
                >
                  전체 로그 보기
                </Button>
                <Button
                  variant={adminTab === "coinAdjust" ? "default" : "secondary"}
                  className={
                    adminTab === "coinAdjust"
                      ? "rounded-2xl bg-white text-black hover:bg-white/90"
                      : "rounded-2xl bg-white/10 text-white hover:bg-white/20"
                  }
                  onClick={() => setAdminTab("coinAdjust")}
                >
                  학생 코인 추가/소멸
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              {adminTab === "inventory" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                      <Label className="text-white/80">상자 선택</Label>
                      <select
                        value={inventoryBoxCode}
                        onChange={(e) => {
                          const value = e.target.value;
                          setInventoryBoxCode(value);
                        }}
                        className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-white"
                      >
                        {inventoryBoxes.map((box) => (
                          <option key={box.code} value={box.code}>
                            {getDisplayBoxName(box)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-white/80">재고 수정 사유 (필수)</Label>
                      <Input
                        value={inventoryReason}
                        onChange={(e) => setInventoryReason(e.target.value)}
                        className="h-11 min-w-64 rounded-xl border-white/15 bg-black/30 text-white"
                        placeholder="예: 이벤트 지급분 반영"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-white/10">
                    <table className="w-full min-w-[1020px] text-sm">
                      <thead className="bg-black/40 text-white/65">
                        <tr>
                          <th className="px-3 py-2 text-left">상품명</th>
                          <th className="px-3 py-2 text-left">초기 수량</th>
                          <th className="px-3 py-2 text-left">남은 수량</th>
                          <th className="px-3 py-2 text-left">기준 확률(%)</th>
                          <th className="px-3 py-2 text-left">실시간 확률(%)</th>
                          <th className="px-3 py-2 text-left">희귀</th>
                          <th className="px-3 py-2 text-left">수정</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventoryLoading ? (
                          <tr>
                            <td colSpan={7} className="px-3 py-4 text-center text-white/55">
                              재고 정보를 불러오는 중입니다...
                            </td>
                          </tr>
                        ) : (
                          (selectedInventoryBox?.products ?? []).map((product) => {
                            const draftValue =
                              inventoryDraft[product.id] ?? String(product.remainingQuantity);
                            const hasInventoryChange =
                              draftValue !== String(product.remainingQuantity);
                            const isApplied =
                              !!inventoryAppliedMap[product.id] && !hasInventoryChange;
                            const isSaving = inventorySavingProductId === product.id;

                            return (
                              <tr key={product.id} className="border-t border-white/10">
                                <td className="px-3 py-2">{product.name}</td>
                                <td className="px-3 py-2">{product.initialQuantity}</td>
                                <td className="px-3 py-2">
                                  <Input
                                    value={draftValue}
                                    onChange={(e) => {
                                      const nextValue = e.target.value.replace(/[^\d-]/g, "");
                                      setInventoryDraft((prev) => ({
                                        ...prev,
                                        [product.id]: nextValue,
                                      }));
                                      setInventoryAppliedMap((prev) => {
                                        if (!prev[product.id]) return prev;
                                        const next = { ...prev };
                                        delete next[product.id];
                                        return next;
                                      });
                                    }}
                                    className="h-9 w-24 rounded-lg border-white/15 bg-black/30 text-white"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  {product.baseProbabilityPercent === null
                                    ? "-"
                                    : product.baseProbabilityPercent.toFixed(4)}
                                </td>
                                <td className="px-3 py-2">
                                  {selectedInventoryRealtimeProbability.get(product.id) === null ||
                                  selectedInventoryRealtimeProbability.get(product.id) === undefined
                                    ? "-"
                                    : (selectedInventoryRealtimeProbability.get(product.id) as number).toFixed(
                                        4
                                      )}
                                </td>
                                <td className="px-3 py-2">
                                  {product.isRare ? (
                                    <span className="rounded-full border border-rose-300/35 bg-rose-500/20 px-2 py-0.5 text-xs text-rose-100">
                                      희귀
                                    </span>
                                  ) : (
                                    "-"
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  <Button
                                    variant="secondary"
                                    className={`rounded-lg ${
                                      isApplied
                                        ? "bg-emerald-400/20 text-emerald-100 hover:bg-emerald-400/20"
                                        : "bg-white/10 text-white hover:bg-white/20"
                                    }`}
                                    disabled={isSaving || isApplied}
                                    onClick={() => void handleInventorySave(product.id)}
                                  >
                                    {isSaving ? "반영 중..." : isApplied ? "적용 완료" : "즉시 반영"}
                                  </Button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                        {!inventoryLoading && !selectedInventoryBox?.products.length && (
                          <tr>
                            <td colSpan={7} className="px-3 py-4 text-center text-white/55">
                              표시할 상품이 없습니다.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="mb-3 text-sm text-white/75">신규 상품 추가</p>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                      <Input
                        value={newProductName}
                        onChange={(e) => setNewProductName(e.target.value)}
                        placeholder="상품명"
                        className="h-11 rounded-xl border-white/15 bg-black/30 text-white"
                      />
                      <Input
                        value={newProductQty}
                        onChange={(e) => setNewProductQty(e.target.value.replace(/[^\d]/g, ""))}
                        placeholder="수량"
                        className="h-11 rounded-xl border-white/15 bg-black/30 text-white"
                      />
                      <Input
                        value={newProductProb}
                        onChange={(e) => setNewProductProb(e.target.value.replace(/[^\d.]/g, ""))}
                        placeholder="기준 확률(선택)"
                        className="h-11 rounded-xl border-white/15 bg-black/30 text-white"
                      />
                      <Input
                        value={newProductReason}
                        onChange={(e) => setNewProductReason(e.target.value)}
                        placeholder="추가 사유(필수)"
                        className="h-11 rounded-xl border-white/15 bg-black/30 text-white"
                      />
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-sm text-white/80">
                          <input
                            type="checkbox"
                            checked={newProductRare}
                            onChange={(e) => setNewProductRare(e.target.checked)}
                          />
                          희귀 상품
                        </label>
                        <Button
                          className="ml-auto rounded-xl bg-white text-black hover:bg-white/90"
                          onClick={() => void handleAddProduct()}
                        >
                          상품 추가
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {adminTab === "studentLogs" && (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <Input
                      value={studentQuery}
                      onChange={(e) => setStudentQuery(e.target.value)}
                      placeholder="학생 이름/전화번호 검색"
                      className="h-11 rounded-xl border-white/15 bg-black/30 text-white"
                    />
                    <select
                      value={selectedStudentId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setSelectedStudentId(id);
                        if (id) void fetchStudentLogs(id);
                      }}
                      className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-white"
                    >
                      <option value="">학생 선택</option>
                      {filteredStudents.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.name} / {student.phone}
                        </option>
                      ))}
                    </select>
                  </div>

                  {studentLogData ? (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/80">
                        {studentLogData.student.name} / {studentLogData.student.phone} / 현재 코인{" "}
                        {studentLogData.student.coinBalance}
                      </div>
                      <div className="overflow-x-auto rounded-2xl border border-white/10">
                        <table className="w-full min-w-[960px] text-sm">
                          <thead className="bg-black/40 text-white/65">
                            <tr>
                              <th className="px-3 py-2 text-left">날짜&시각</th>
                              <th className="px-3 py-2 text-left">이벤트</th>
                              <th className="px-3 py-2 text-left">사유</th>
                              <th className="px-3 py-2 text-left">변동량</th>
                              <th className="px-3 py-2 text-left">전 코인</th>
                              <th className="px-3 py-2 text-left">후 코인</th>
                              <th className="px-3 py-2 text-left">상자</th>
                              <th className="px-3 py-2 text-left">상품</th>
                            </tr>
                          </thead>
                          <tbody>
                            {studentLogData.ledgerLogs.map((log) => (
                              <tr key={log.id} className="border-t border-white/10">
                                <td className="px-3 py-2">{formatKst(log.createdAt)}</td>
                                <td className="px-3 py-2">{log.eventType}</td>
                                <td className="px-3 py-2">{log.reason}</td>
                                <td className="px-3 py-2">
                                  {log.delta > 0 ? `+${log.delta}` : log.delta}
                                </td>
                                <td className="px-3 py-2">{log.coinBefore}</td>
                                <td className="px-3 py-2">{log.coinAfter}</td>
                                <td className="px-3 py-2">{log.relatedBoxCode || "-"}</td>
                                <td className="px-3 py-2">{log.relatedProductName || "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-white/55">학생을 선택하면 로그가 표시됩니다.</p>
                  )}
                </div>
              )}

              {adminTab === "weeklyLogs" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Label className="text-white/80">N 시즌 주차 선택</Label>
                    <select
                      value={week}
                      onChange={(e) => {
                        const nextWeek = Number(e.target.value);
                        setWeek(nextWeek);
                        void fetchWeeklyWinners(nextWeek);
                      }}
                      className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-white"
                    >
                      {Array.from({ length: 12 }, (_, idx) => idx + 1).map((w) => (
                        <option key={w} value={w}>
                          {w}주차
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="overflow-x-auto rounded-2xl border border-white/10">
                    <table className="w-full min-w-[1220px] text-sm">
                      <thead className="bg-black/40 text-white/65">
                        <tr>
                          <th className="px-3 py-2 text-left">날짜/시간</th>
                          <th className="px-3 py-2 text-left">상자 종류</th>
                          <th className="px-3 py-2 text-left">당첨 상품</th>
                          <th className="px-3 py-2 text-left">당첨자 이름</th>
                          <th className="px-3 py-2 text-left">당첨자 전화번호</th>
                          <th className="px-3 py-2 text-left">지급 일정</th>
                          <th className="px-3 py-2 text-left">처리</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weeklyWinners.map((winner) => (
                          <tr key={winner.id} className="border-t border-white/10">
                            <td className="px-3 py-2">{formatKst(winner.createdAt)}</td>
                            <td className="px-3 py-2">
                              {BOX_CODE_TO_KO_NAME[winner.boxCode] ?? winner.boxCode.toUpperCase()}
                            </td>
                            <td className="px-3 py-2">{winner.productName}</td>
                            <td className="px-3 py-2">{winner.studentName}</td>
                            <td className="px-3 py-2">{winner.studentPhone}</td>
                            <td className="px-3 py-2">{winner.deliveryScheduleText}</td>
                            <td className="px-3 py-2">
                              {winner.canToggleDelivery ? (
                                <Button
                                  variant="secondary"
                                  className="rounded-lg bg-white/10 text-white hover:bg-white/20"
                                  disabled={deliveryUpdatingId === winner.id}
                                  onClick={() =>
                                    void handleDeliveryToggle(winner.id, !winner.deliveryCompleted)
                                  }
                                >
                                  {deliveryUpdatingId === winner.id
                                    ? "처리 중..."
                                    : winner.deliveryCompleted
                                      ? "지급 취소"
                                      : "지급 처리"}
                                </Button>
                              ) : (
                                <span className="text-white/45">자동 지급</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {!weeklyWinners.length && (
                          <tr>
                            <td colSpan={7} className="px-3 py-4 text-center text-white/55">
                              선택한 주차의 당첨 기록이 없습니다.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {adminTab === "coinAdjust" && (
                <div className="space-y-4">
                  <Input
                    value={studentQuery}
                    onChange={(e) => setStudentQuery(e.target.value)}
                    placeholder="학생 이름/전화번호 검색"
                    className="h-11 rounded-xl border-white/15 bg-black/30 text-white"
                  />
                  <select
                    value={coinAdjustStudentId}
                    onChange={(e) => setCoinAdjustStudentId(e.target.value)}
                    className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-white"
                  >
                    <option value="">학생 선택</option>
                    {filteredStudents.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.name} / {student.phone} / 현재 {student.coinBalance}코인
                      </option>
                    ))}
                  </select>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      value={coinAdjustDelta}
                      onChange={(e) => setCoinAdjustDelta(e.target.value.replace(/[^\d+-]/g, ""))}
                      placeholder="+3 또는 -2"
                      className="h-11 rounded-xl border-white/15 bg-black/30 text-white"
                    />
                    <Input
                      value={coinAdjustReason}
                      onChange={(e) => setCoinAdjustReason(e.target.value)}
                      placeholder="조정 사유 (필수)"
                      className="h-11 rounded-xl border-white/15 bg-black/30 text-white"
                    />
                  </div>
                  <Button
                    className="rounded-xl bg-white text-black hover:bg-white/90"
                    onClick={() => void handleCoinAdjust()}
                  >
                    코인 즉시 반영
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/45">
          <p className="flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" />
            상점 로그 시각은 KST(Asia/Seoul) 기준으로 표시됩니다.
          </p>
        </div>
      </div>
    </main>
  );
}
