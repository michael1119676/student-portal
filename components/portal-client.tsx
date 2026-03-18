"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Gift,
  GraduationCap,
  Instagram,
  MessageCircleMore,
  Phone,
  Search,
  Settings,
  Shield,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getPremiumRoundLabel,
  getPremiumSeasonMeta,
  isPremiumSeason,
  PREMIUM_MONTH_ROUNDS,
  type PremiumSeasonCode,
} from "@/lib/season-premium";

export type SessionUser = {
  id: string;
  name: string;
  phone: string;
  role: "student" | "admin";
};

export type StudentProfile = {
  korean_subject?: string | null;
  math_subject?: string | null;
  science_1?: string | null;
  science_2?: string | null;
  target_university?: string | null;
};

export type ManagedStudent = {
  id: string;
  name: string;
  phone: string;
  role: "student";
  className?: string | null;
};

type PortalClientProps = {
  mode?: "student" | "admin";
  initialSessionUser?: SessionUser | null;
  initialProfile?: StudentProfile | null;
  managedStudents?: ManagedStudent[];
};

type SeasonCRoundSummary = {
  round: number;
  averageScore: number;
  myScore: number | null;
};

type SeasonCRoundDetail = {
  round: number;
  myScore: number | null;
  averageScore: number;
  myVsAverage: "above" | "equal" | "below" | "unknown";
  histogram: Array<{
    label: string;
    start: number;
    end: number;
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

type SeasonCResponse = {
  ok: boolean;
  season: "C";
  maxRound: number;
  yMax: number;
  binSize: number;
  data: {
    rounds: SeasonCRoundSummary[];
    details: SeasonCRoundDetail[];
  };
  message?: string;
};

type SeasonNRoundSummary = {
  round: number;
  averageScore: number;
  myScore: number | null;
};

type SeasonNRoundDetail = {
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

type SeasonNResponse = {
  ok: boolean;
  season: "N";
  maxRound: number;
  yMax: number;
  binSize: number;
  data: {
    rounds: SeasonNRoundSummary[];
    details: SeasonNRoundDetail[];
  };
  message?: string;
};

type PremiumRoundSummary = {
  round: number;
  label: string;
  averageScore: number;
  myScore: number | null;
};

type PremiumRoundDetail = {
  round: number;
  label: string;
  myScore: number | null;
  averageScore: number;
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

type PremiumSeasonResponse = {
  ok: boolean;
  season: PremiumSeasonCode;
  maxRound: number;
  yMax: number;
  binSize: number;
  monthRounds: number[];
  data: {
    rounds: PremiumRoundSummary[];
    details: PremiumRoundDetail[];
  };
  message?: string;
};

type SeasonNote = {
  id: number | null;
  studentId: string;
  studentName?: string;
  season: string;
  round: number;
  studentNote: string;
  adminComment: string;
  noteUpdatedAt: string | null;
  noteUpdatedByRole: "student" | "admin" | null;
  adminCommentUpdatedAt: string | null;
  updatedAt: string | null;
  createdAt: string | null;
  hasAdminComment: boolean;
  status: "미댓글" | "댓글 완료" | "갱신됨";
};

type SeasonNoteResponse = {
  ok: boolean;
  message?: string;
  note?: SeasonNote;
};

type AdminSeasonNoteItem = SeasonNote & {
  studentId: string;
  studentName: string;
  studentPhone: string;
  className: string | null;
};

type AdminSeasonNotesResponse = {
  ok: boolean;
  message?: string;
  items?: AdminSeasonNoteItem[];
};

type AdminSeasonCutoffsResponse = {
  ok: boolean;
  message?: string;
  cutoffs?: Array<{
    season: string;
    round: number;
    cut1: number | null;
    cut2: number | null;
    cut3: number | null;
    updated_at?: string | null;
  }>;
};

type AdminStatsResponse = {
  ok: boolean;
  message?: string;
  stats?: {
    season: "C" | "N" | PremiumSeasonCode;
    round: number;
    roundLabel?: string;
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
};

type PortalHistoryState = {
  __portalNav: true;
  selectedSeason: string | null;
  adminStep: "home" | "search" | "scores" | "stats" | "create" | "notes";
  selectedStudentId: string | null;
};

const seasons = [
  { id: "C", badge: "C", title: "C 시즌", subtitle: "C 시즌 성적 확인" },
  { id: "N", badge: "N", title: "N 시즌", subtitle: "N 시즌 성적 확인" },
  { id: "M", badge: "M", title: "M 시즌", subtitle: "M 시즌 성적 확인" },
  {
    id: "DP",
    ...getPremiumSeasonMeta("DP"),
  },
  {
    id: "SP",
    ...getPremiumSeasonMeta("SP"),
  },
];

const universityProfiles = {
  seoul: {
    label: "서울대학교",
    image: "/logos/snu.png",
  },
  yonsei: {
    label: "연세대학교",
    image: "/logos/yonsei.png",
  },
  korea: {
    label: "고려대학교",
    image: "/logos/korea.png",
  },
  kaist: {
    label: "KAIST",
    image: "/logos/kaist.png",
  },
  sogang: {
    label: "서강대학교",
    image: "/logos/sogang.svg",
  },
  skku: {
    label: "성균관대학교",
    image: "/logos/skku.svg",
  },
  medical: {
    label: "의대",
    image: "/logos/medical.svg",
  },
  oriental: {
    label: "한의대",
    image: "/logos/oriental.svg",
  },
  veterinary: {
    label: "수의대",
    image: "/logos/veterinary.svg",
  },
  pharmacy: {
    label: "약대",
    image: "/logos/pharmacy.svg",
  },
  dental: {
    label: "치대",
    image: "/logos/dental.svg",
  },
  public_health: {
    label: "보건계열",
    image: "/logos/public-health.svg",
  },
} as const;

const subjectOptions = {
  korean: ["언어와 매체", "화법과 작문"],
  math: ["미적분", "확률과 통계", "기하"],
  science: [
    "물리학 I",
    "물리학 II",
    "화학 I",
    "화학 II",
    "생명과학 I",
    "생명과학 II",
    "지구과학 I",
    "지구과학 II",
  ],
};

const quickLinks = [
  {
    title: "Instagram",
    description: "강사 인스타그램으로 이동",
    href: "https://www.instagram.com/forphysics2?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==",
    icon: Instagram,
  },
  {
    title: "Open Chat",
    description: "오픈채팅방으로 이동",
    href: "https://open.kakao.com/o/sEOzN8Zg",
    icon: MessageCircleMore,
  },
  {
    title: "Curriculum",
    description: "연간 커리큘럼 보기",
    href: "https://drive.google.com/file/d/10uJNOkYOY1ZqscGfhf_0kIN-17YUHiVw/view?usp=sharing",
    icon: BookOpen,
  },
  {
    title: "About Han Seojun T",
    description: "한서준 T 소개 화면 보기",
    href: "/about",
    icon: GraduationCap,
  },
];

const LOGIN_INTRO_SESSION_KEY = "portal-login-intro-seen";
const LOGIN_INTRO_DURATION_MS = 4000;

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function normalizeClassNameLabel(className: string | null | undefined) {
  if (!className) return className;
  const normalized = className.trim();
  if (normalized === "녹화강의반") return "영상반";
  return normalized;
}

function formatSeasonRoundLabel(
  season: string,
  round: number,
  options?: { longPremium?: boolean }
) {
  if (isPremiumSeason(season)) {
    const meta = getPremiumSeasonMeta(season);
    return `${options?.longPremium ? meta.title : meta.shortTitle} ${getPremiumRoundLabel(round)}`;
  }

  return `${season} 시즌 ${round}회`;
}

function classStatOrder(className: string | null | undefined) {
  const normalized = normalizeClassNameLabel(className)?.trim() ?? "";
  if (normalized === "금요일반" || normalized.startsWith("금")) return 0;
  if (normalized === "토요일반" || normalized.startsWith("토")) return 1;
  if (
    normalized === "영상반" ||
    normalized === "녹화강의반" ||
    normalized.startsWith("영상") ||
    normalized.startsWith("녹")
  )
    return 2;
  if (normalized === "전체") return 3;
  return 4;
}

function sortClassStats<T extends { className: string }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const rankDiff = classStatOrder(a.className) - classStatOrder(b.className);
    if (rankDiff !== 0) return rankDiff;
    return normalizeClassNameLabel(a.className)?.localeCompare(
      normalizeClassNameLabel(b.className) ?? "",
      "ko-KR"
    ) ?? 0;
  });
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
    hour12: false,
  }).format(date);
}

function ScriptLogo() {
  return (
    <div className="relative inline-block">
      <div className="absolute -inset-8 rounded-full bg-sky-400/10 blur-3xl" />
      <h1
        className="relative text-6xl italic tracking-tight text-white drop-shadow-[0_10px_40px_rgba(255,255,255,0.12)] sm:text-7xl lg:text-8xl"
        style={{ fontFamily: '"Times New Roman", "Georgia", serif' }}
      >
        Han&apos;s Physics
      </h1>
    </div>
  );
}

function IntroWriteLine({
  text,
  delay,
  className,
  cursorClassName,
  textStyle,
}: {
  text: string;
  delay: number;
  className: string;
  cursorClassName?: string;
  textStyle?: React.CSSProperties;
}) {
  return (
    <div className="relative inline-flex max-w-full overflow-hidden whitespace-nowrap">
      <motion.div
        initial={{ width: 0, opacity: 0.35 }}
        animate={{ width: "100%", opacity: 1 }}
        transition={{ duration: 1.05, delay, ease: [0.22, 1, 0.36, 1] }}
        className="overflow-hidden"
      >
        <span className={className} style={textStyle}>
          {text}
        </span>
      </motion.div>
      <motion.span
        initial={{ opacity: 0, x: 0 }}
        animate={{ opacity: [0, 1, 0.4, 0], x: ["0%", "100%", "100%", "100%"] }}
        transition={{ duration: 1.05, delay, ease: "easeInOut" }}
        className={`absolute inset-y-0 right-0 w-[2px] rounded-full bg-white/90 shadow-[0_0_18px_rgba(255,255,255,0.8)] ${cursorClassName ?? ""}`}
      />
    </div>
  );
}

function AnimatedLoginIntro({ onComplete }: { onComplete: () => void }) {
  const prefersReducedMotion = useReducedMotion();
  const [isCompactIntro, setIsCompactIntro] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(onComplete, LOGIN_INTRO_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [onComplete]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const updateCompactState = () => setIsCompactIntro(mediaQuery.matches);

    updateCompactState();
    mediaQuery.addEventListener("change", updateCompactState);
    return () => mediaQuery.removeEventListener("change", updateCompactState);
  }, []);

  const useCompactMotion = prefersReducedMotion || isCompactIntro;

  return (
    <motion.div
      key="login-intro"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="fixed inset-0 z-[90] overflow-hidden bg-[#020407]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_32%,rgba(255,255,255,0.16),transparent_18%),radial-gradient(circle_at_50%_44%,rgba(56,189,248,0.18),transparent_28%),linear-gradient(180deg,rgba(10,14,20,0.24),rgba(3,5,8,0.94))]" />
      {!useCompactMotion && (
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(transparent_0%,rgba(255,255,255,0.03)_48%,transparent_100%)] bg-[length:100%_5px] opacity-20" />
      )}

      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-80 sm:h-[50rem] sm:w-[50rem]"
        style={{
          background:
            "conic-gradient(from 0deg, rgba(255,255,255,0.02), rgba(255,255,255,0.14), rgba(56,189,248,0.08), rgba(255,255,255,0.02) 62%, rgba(255,255,255,0.12), rgba(255,255,255,0.02))",
          filter: useCompactMotion ? "none" : "blur(1px)",
        }}
        animate={useCompactMotion ? { rotate: 180 } : { rotate: 360, scale: [0.96, 1.01, 0.97] }}
        transition={{
          rotate: { duration: useCompactMotion ? 4 : 14, repeat: useCompactMotion ? 0 : Infinity, ease: "linear" },
          scale: { duration: 4, repeat: useCompactMotion ? 0 : Infinity, ease: "easeInOut" },
        }}
      />
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[27rem] w-[27rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/8 sm:h-[38rem] sm:w-[38rem]"
        animate={useCompactMotion ? { opacity: [0.16, 0.34, 0.16] } : { rotate: -360, opacity: [0.18, 0.45, 0.18] }}
        transition={{
          rotate: { duration: 11, repeat: useCompactMotion ? 0 : Infinity, ease: "linear" },
          opacity: { duration: 2.6, repeat: useCompactMotion ? 1 : Infinity, ease: "easeInOut" },
        }}
      />
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[18rem] w-[18rem] -translate-x-1/2 -translate-y-1/2 rounded-full sm:h-[25rem] sm:w-[25rem]"
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(56,189,248,0.12) 22%, rgba(56,189,248,0.04) 42%, transparent 70%)",
          filter: useCompactMotion ? "blur(2px)" : "blur(6px)",
        }}
        animate={{ scale: [0.88, 1.08, 0.9], opacity: [0.24, 0.58, 0.28] }}
        transition={{ duration: 2.8, repeat: useCompactMotion ? 1 : Infinity, ease: "easeInOut" }}
      />

      {!useCompactMotion && (
        <motion.div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-300/16"
          animate={{ scale: [0.75, 1.04], opacity: [0.75, 0] }}
          transition={{ duration: 1.3, repeat: Infinity, ease: "easeOut" }}
        />
      )}

      {!useCompactMotion && (
        <>
          <motion.div
            className="pointer-events-none absolute left-[-12%] top-[22%] h-px w-[124%] bg-gradient-to-r from-transparent via-white/75 to-transparent"
            animate={{ x: ["-8%", "16%"], opacity: [0, 0.9, 0] }}
            transition={{ duration: 1.15, repeat: Infinity, repeatDelay: 0.18, ease: "easeInOut" }}
          />
          <motion.div
            className="pointer-events-none absolute left-[-12%] top-[58%] h-px w-[124%] bg-gradient-to-r from-transparent via-sky-300/60 to-transparent"
            animate={{ x: ["10%", "-14%"], opacity: [0, 0.65, 0] }}
            transition={{ duration: 1.45, repeat: Infinity, repeatDelay: 0.08, ease: "easeInOut" }}
          />
        </>
      )}

      {[0, 1, 2, 3, ...(useCompactMotion ? [] : [4, 5])].map((index) => {
        const offsets = [
          { left: "18%", top: "28%" },
          { left: "30%", top: "68%" },
          { left: "46%", top: "18%" },
          { left: "62%", top: "72%" },
          { left: "76%", top: "34%" },
          { left: "84%", top: "54%" },
        ][index];

        return (
          <motion.div
            key={`intro-particle-${index}`}
            className="pointer-events-none absolute h-2 w-2 rounded-full bg-white/80 shadow-[0_0_18px_rgba(255,255,255,0.45)]"
            style={offsets}
            animate={{
              y: [0, -34, 12, 0],
              opacity: [0.12, 1, 0.3, 0.12],
              scale: [0.65, 1.28, 0.84, 0.65],
            }}
            transition={{
              duration: 2.4 + index * 0.2,
              repeat: useCompactMotion ? 1 : Infinity,
              ease: "easeInOut",
              delay: index * 0.12,
            }}
          />
        );
      })}

      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-5 sm:px-8">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.38em] text-white/55">
            Han&apos;s Physics Portal
          </p>
          <p className="text-sm text-white/75 sm:text-base">
            실력이 만드는 결과의 차이
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="pointer-events-auto rounded-2xl bg-white/10 px-4 text-white hover:bg-white/20"
          onClick={onComplete}
        >
          건너뛰기
        </Button>
      </div>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex w-full max-w-4xl flex-col items-center gap-5 sm:gap-7"
        >
          <motion.div
            className="absolute h-32 w-32 rounded-full border border-white/15 sm:h-40 sm:w-40"
            animate={{ rotate: 360 }}
            transition={{ duration: 8.5, repeat: useCompactMotion ? 0 : Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute h-24 w-24 rounded-full border border-sky-200/20 sm:h-28 sm:w-28"
            animate={{ rotate: -360 }}
            transition={{ duration: 6.2, repeat: useCompactMotion ? 0 : Infinity, ease: "linear" }}
          />
          {!useCompactMotion && (
            <motion.div
              className="absolute h-56 w-56 rounded-full"
              style={{
                background:
                  "conic-gradient(from 90deg, transparent 0deg, rgba(255,255,255,0.18) 48deg, transparent 92deg, transparent 220deg, rgba(56,189,248,0.22) 270deg, transparent 320deg)",
                filter: "blur(2px)",
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 5.8, repeat: Infinity, ease: "linear" }}
            />
          )}
          <div className="relative z-10 flex flex-col items-center gap-3 text-center">
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.72, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <div className="absolute -inset-x-8 -inset-y-6 rounded-full bg-sky-400/12 blur-3xl" />
              <IntroWriteLine
                text="Han's Physics"
                delay={0.38}
                className="relative text-5xl tracking-tight text-white italic drop-shadow-[0_10px_40px_rgba(255,255,255,0.12)] sm:text-7xl lg:text-8xl"
                cursorClassName="bg-sky-100/95"
                textStyle={{
                  fontFamily: '"Times New Roman", "Georgia", serif',
                }}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.88 }}
            >
              <IntroWriteLine
                text="PREMIUM PHYSICS II SERVICE"
                delay={1.08}
                className="text-sm tracking-[0.18em] text-white/68 italic sm:text-lg"
                cursorClassName="bg-white/90"
                textStyle={{
                  fontFamily:
                    '"Palatino Linotype", "Book Antiqua", "Times New Roman", serif',
                  fontWeight: 500,
                }}
              />
            </motion.div>
          </div>
          <motion.div
            initial={{ opacity: 0, scaleX: 0.2 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 1.3, delay: 1.3, ease: "easeOut" }}
            className="relative mt-1 h-px w-48 origin-center overflow-hidden bg-white/12 sm:w-56"
          >
            <motion.div
              className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white to-transparent"
              animate={{ x: ["-60%", "260%"] }}
              transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        </motion.div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 px-5 pb-8 sm:px-8 sm:pb-10">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.9 }}
          className="mx-auto max-w-4xl"
        >
          <div className="h-1 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-sky-300 via-white to-sky-300"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: LOGIN_INTRO_DURATION_MS / 1000, ease: "linear" }}
            />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function getTargetUniversity(value?: string | null) {
  if (value && value in universityProfiles) {
    return value as keyof typeof universityProfiles;
  }
  return "seoul";
}

function buildSmoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length < 2) return "";
  const tension = 0.12;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  return d;
}

const SCORE_LINE_COLOR = "#ec6a78";
const SCORE_POINT_COLOR = "#ff4d6d";
const SCORE_POINT_RING = "#ffe2e8";

type StudentQuestionStatRow = {
  question: number;
  correctChoice: number | null;
  myChoice: number | null;
  isWrong: boolean;
  choices: Array<{
    choice: number;
    count: number;
    rate: number;
  }>;
};

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function getTopWrongQuestions(questionStats: StudentQuestionStatRow[]) {
  return [...questionStats]
    .filter((question) => question.correctChoice !== null)
    .map((question) => {
      const correctRate =
        question.choices.find((choice) => choice.choice === question.correctChoice)?.rate ?? 0;

      return {
        ...question,
        correctRate,
        wrongRate: roundToOneDecimal(Math.max(0, 100 - correctRate)),
      };
    })
    .sort((a, b) => b.wrongRate - a.wrongRate || a.question - b.question)
    .slice(0, 5);
}

export default function PortalClient({
  mode = "student",
  initialSessionUser = null,
  initialProfile = null,
  managedStudents = [],
}: PortalClientProps) {
  const isAdminMode = mode === "admin";

  const [sessionUser, setSessionUser] = useState<SessionUser | null>(initialSessionUser);
  const [isCheckingSession, setIsCheckingSession] = useState(!initialSessionUser);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);

  const [studentName, setStudentName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginFailCount, setLoginFailCount] = useState(0);
  const [showLoginIntro, setShowLoginIntro] = useState(!initialSessionUser);

  const [selectedKorean, setSelectedKorean] = useState(initialProfile?.korean_subject || "언어와 매체");
  const [selectedMath, setSelectedMath] = useState(initialProfile?.math_subject || "미적분");
  const [selectedScience1, setSelectedScience1] = useState(initialProfile?.science_1 || "물리학 I");
  const [selectedScience2, setSelectedScience2] = useState(initialProfile?.science_2 || "화학 I");
  const [targetUniversity, setTargetUniversity] = useState<keyof typeof universityProfiles>(
    getTargetUniversity(initialProfile?.target_university)
  );
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const [adminStep, setAdminStep] = useState<"home" | "search" | "scores" | "stats" | "create" | "notes">(
    "home"
  );
  const [adminStudents, setAdminStudents] = useState<ManagedStudent[]>(managedStudents);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<ManagedStudent | null>(null);
  const [isLoadingStudent, setIsLoadingStudent] = useState(false);
  const [seasonCData, setSeasonCData] = useState<SeasonCResponse["data"] | null>(null);
  const [seasonCLoading, setSeasonCLoading] = useState(false);
  const [seasonCError, setSeasonCError] = useState("");
  const [seasonCLoadedForId, setSeasonCLoadedForId] = useState<string | null>(null);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [seasonNData, setSeasonNData] = useState<SeasonNResponse["data"] | null>(null);
  const [seasonNLoading, setSeasonNLoading] = useState(false);
  const [seasonNError, setSeasonNError] = useState("");
  const [seasonNLoadedForId, setSeasonNLoadedForId] = useState<string | null>(null);
  const [selectedNRound, setSelectedNRound] = useState<number | null>(null);
  const [premiumData, setPremiumData] = useState<PremiumSeasonResponse["data"] | null>(null);
  const [premiumLoading, setPremiumLoading] = useState(false);
  const [premiumError, setPremiumError] = useState("");
  const [premiumLoadedForKey, setPremiumLoadedForKey] = useState<string | null>(null);
  const [selectedPremiumRound, setSelectedPremiumRound] = useState<number | null>(null);
  const [adminCutSeason, setAdminCutSeason] = useState<"N" | "M" | null>(null);
  const [adminNInputRound, setAdminNInputRound] = useState(1);
  const [nCutInputs, setNCutInputs] = useState({ cut1: "", cut2: "", cut3: "" });
  const [nCutSaveMessage, setNCutSaveMessage] = useState("");
  const [nCutLoading, setNCutLoading] = useState(false);
  const [statsSeason, setStatsSeason] = useState<"C" | "M" | "N" | PremiumSeasonCode>("C");
  const [statsRound, setStatsRound] = useState(1);
  const [adminStats, setAdminStats] = useState<AdminStatsResponse["stats"] | null>(null);
  const [adminStatsLoading, setAdminStatsLoading] = useState(false);
  const [adminStatsError, setAdminStatsError] = useState("");
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentPhone, setNewStudentPhone] = useState("");
  const [newStudentPin, setNewStudentPin] = useState("1111");
  const [newStudentClassName, setNewStudentClassName] = useState("");
  const [newStudentLoading, setNewStudentLoading] = useState(false);
  const [newStudentMessage, setNewStudentMessage] = useState("");
  const [seasonNote, setSeasonNote] = useState<SeasonNote | null>(null);
  const [seasonNoteLoading, setSeasonNoteLoading] = useState(false);
  const [seasonNoteMessage, setSeasonNoteMessage] = useState("");
  const [studentNoteDraft, setStudentNoteDraft] = useState("");
  const [adminCommentDraft, setAdminCommentDraft] = useState("");
  const [adminNotes, setAdminNotes] = useState<AdminSeasonNoteItem[]>([]);
  const [adminNotesLoading, setAdminNotesLoading] = useState(false);
  const [adminNotesMessage, setAdminNotesMessage] = useState("");
  const [adminNotesQuery, setAdminNotesQuery] = useState("");
  const [selectedAdminNoteId, setSelectedAdminNoteId] = useState<number | null>(null);
  const [adminManagedNoteDraft, setAdminManagedNoteDraft] = useState("");
  const [adminManagedCommentDraft, setAdminManagedCommentDraft] = useState("");
  const studentProfileCacheRef = useRef<Record<string, StudentProfile | null>>({});

  const isLoggedIn = !!sessionUser;
  const visibleUser = isAdminMode ? selectedStudent : sessionUser;
  const canShowStudentPortal = isAdminMode ? !!sessionUser && !!selectedStudent : isLoggedIn;
  const profile = universityProfiles[targetUniversity];
  const selectedPremiumSeason = isPremiumSeason(selectedSeason) ? selectedSeason : null;
  const currentPremiumDataKey =
    selectedPremiumSeason && visibleUser?.id ? `${selectedPremiumSeason}:${visibleUser.id}` : null;
  const activePremiumData =
    currentPremiumDataKey && premiumLoadedForKey === currentPremiumDataKey ? premiumData : null;
  const selectedPremiumMeta = selectedPremiumSeason
    ? getPremiumSeasonMeta(selectedPremiumSeason)
    : null;
  const statsRoundOptions = useMemo(
    () =>
      statsSeason === "N"
        ? Array.from({ length: 12 }, (_, i) => i + 1)
        : isPremiumSeason(statsSeason)
          ? [...PREMIUM_MONTH_ROUNDS]
          : Array.from({ length: 10 }, (_, i) => i + 1),
    [statsSeason]
  );

  const canLogin = useMemo(() => {
    return (
      studentName.trim().length > 0 &&
      normalizePhone(phone).length >= 8 &&
      /^\d{4}$/.test(pin)
    );
  }, [studentName, phone, pin]);

  const filteredStudents = useMemo(() => {
    const keyword = studentSearch.trim().toLowerCase();
    if (!keyword) return adminStudents;

    return adminStudents.filter(
      (student) =>
        student.name.toLowerCase().includes(keyword) ||
        student.phone.toLowerCase().includes(keyword)
    );
  }, [adminStudents, studentSearch]);

  useEffect(() => {
    setAdminStudents(managedStudents);
  }, [managedStudents]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isLoggedIn) {
      setShowLoginIntro(false);
      return;
    }

    const hasSeenIntro = window.sessionStorage.getItem(LOGIN_INTRO_SESSION_KEY) === "1";
    setShowLoginIntro(!hasSeenIntro);
  }, [isLoggedIn]);

  const selectedRoundDetail = useMemo(() => {
    if (!seasonCData || selectedRound === null) return null;
    return seasonCData.details.find((detail) => detail.round === selectedRound) ?? null;
  }, [seasonCData, selectedRound]);

  const selectedRoundTopWrongQuestions = useMemo(
    () => getTopWrongQuestions(selectedRoundDetail?.questionStats ?? []),
    [selectedRoundDetail]
  );

  const myPlotPoints = useMemo(() => {
    if (!seasonCData || seasonCData.rounds.length === 0) return [];

    return seasonCData.rounds
      .map((round, index, array) => {
        if (round.myScore === null) return null;
        const x = ((index + 0.5) / array.length) * 100;
        const y = 100 - round.myScore;
        return { x, y };
      })
      .filter((point): point is { x: number; y: number } => point !== null);
  }, [seasonCData]);

  const smoothLinePath = useMemo(() => buildSmoothPath(myPlotPoints), [myPlotPoints]);

  const selectedNRoundDetail = useMemo(() => {
    if (!seasonNData || selectedNRound === null) return null;
    return seasonNData.details.find((detail) => detail.round === selectedNRound) ?? null;
  }, [seasonNData, selectedNRound]);

  const selectedNRoundTopWrongQuestions = useMemo(
    () => getTopWrongQuestions(selectedNRoundDetail?.questionStats ?? []),
    [selectedNRoundDetail]
  );

  const selectedPremiumRoundDetail = useMemo(() => {
    if (!activePremiumData || selectedPremiumRound === null) return null;
    return activePremiumData.details.find((detail) => detail.round === selectedPremiumRound) ?? null;
  }, [activePremiumData, selectedPremiumRound]);

  const nPlotPoints = useMemo(() => {
    if (!seasonNData || seasonNData.rounds.length === 0) return [];
    return seasonNData.rounds
      .map((round, index, arr) => {
        if (round.myScore === null) return null;
        const x = ((index + 0.5) / arr.length) * 100;
        const y = 100 - round.myScore * 2;
        return { x, y };
      })
      .filter((point): point is { x: number; y: number } => point !== null);
  }, [seasonNData]);

  const nSmoothLinePath = useMemo(() => buildSmoothPath(nPlotPoints), [nPlotPoints]);

  const premiumPlotPoints = useMemo(() => {
    if (!activePremiumData || activePremiumData.rounds.length === 0) return [];
    return activePremiumData.rounds
      .map((round, index, arr) => {
        if (round.myScore === null) return null;
        const x = ((index + 0.5) / arr.length) * 100;
        const y = 100 - round.myScore * 2;
        return { x, y };
      })
      .filter((point): point is { x: number; y: number } => point !== null);
  }, [activePremiumData]);

  const premiumSmoothLinePath = useMemo(
    () => buildSmoothPath(premiumPlotPoints),
    [premiumPlotPoints]
  );

  const selectedAdminNote = useMemo(
    () => adminNotes.find((item) => item.id === selectedAdminNoteId) ?? null,
    [adminNotes, selectedAdminNoteId]
  );

  const currentNoteTarget = useMemo(() => {
    if (!visibleUser?.id) return null;
    if (selectedSeason === "C" && selectedRoundDetail) {
      return { season: "C", round: selectedRoundDetail.round };
    }
    if (selectedSeason === "N" && selectedNRoundDetail) {
      return { season: "N", round: selectedNRoundDetail.round };
    }
    if (selectedPremiumSeason && selectedPremiumRoundDetail) {
      return { season: selectedPremiumSeason, round: selectedPremiumRoundDetail.round };
    }
    return null;
  }, [
    visibleUser?.id,
    selectedSeason,
    selectedPremiumSeason,
    selectedRoundDetail,
    selectedNRoundDetail,
    selectedPremiumRoundDetail,
  ]);

  function applyProfile(profileData?: StudentProfile | null) {
    setSelectedKorean(profileData?.korean_subject || "언어와 매체");
    setSelectedMath(profileData?.math_subject || "미적분");
    setSelectedScience1(profileData?.science_1 || "물리학 I");
    setSelectedScience2(profileData?.science_2 || "화학 I");
    setTargetUniversity(getTargetUniversity(profileData?.target_university));
  }

  function handleReturnToPortalHome() {
    setSelectedSeason(null);
    setIsEditingProfile(false);
    setSaveMessage("");
    setSeasonNoteMessage("");
    setAdminNotesMessage("");
    setLoginError("");
    setNewPin("");
  }

  function pushPortalHistoryEntry() {
    if (typeof window === "undefined") return;
    const state: PortalHistoryState = {
      __portalNav: true,
      selectedSeason,
      adminStep,
      selectedStudentId: selectedStudent?.id ?? null,
    };
    window.history.pushState(state, "", window.location.href);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onPopState = () => {
      if (isEditingProfile) {
        setIsEditingProfile(false);
        setSaveMessage("");
        setNewPin("");
        return;
      }

      if (selectedSeason !== null) {
        setSelectedSeason(null);
        return;
      }

      if (!isAdminMode) {
        return;
      }

      if (selectedStudent) {
        setSelectedStudent(null);
        setSelectedSeason(null);
        setAdminStep("search");
        setSaveMessage("");
        return;
      }

      if (adminStep !== "home") {
        setAdminStep("home");
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [adminStep, isAdminMode, isEditingProfile, selectedSeason, selectedStudent]);

  useEffect(() => {
    if (isAdminMode) {
      setIsCheckingSession(false);
      return;
    }

    if (initialSessionUser) {
      setIsCheckingSession(false);
      return;
    }

    const loadSession = async () => {
      try {
        const res = await fetch("/api/session", { cache: "no-store" });
        if (!res.ok) {
          setIsCheckingSession(false);
          return;
        }

        const data = await res.json();
        const user = data.user as SessionUser;

        if (user.role === "admin") {
          window.location.href = "/admin";
          return;
        }

        setSessionUser(user);
        setStudentName(user.name);
        setPhone(user.phone);
        applyProfile(data.profile as StudentProfile | undefined);
      } catch {
        //
      } finally {
        setIsCheckingSession(false);
      }
    };

    loadSession();
  }, [initialSessionUser, isAdminMode]);

  useEffect(() => {
    if (!isEditingProfile) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isEditingProfile]);

  useEffect(() => {
    if (selectedSeason !== "C") return;
    if (!canShowStudentPortal || !visibleUser?.id) return;
    if (seasonCData && seasonCLoadedForId === visibleUser.id) {
      setSeasonCLoading(false);
      setSeasonCError("");
      if (selectedRound === null) {
        const defaultRound = seasonCData.rounds.find((round) => round.myScore !== null)?.round ?? 1;
        setSelectedRound(defaultRound);
      }
      return;
    }

    let cancelled = false;

    const loadSeasonC = async () => {
      setSeasonCLoading(true);
      setSeasonCError("");

      const query = isAdminMode
        ? `?studentId=${encodeURIComponent(visibleUser.id)}`
        : "";

      try {
        const res = await fetch(`/api/season/c${query}`, { cache: "no-store" });
        const data = (await res.json()) as SeasonCResponse;

        if (!res.ok || !data.ok) {
          if (!cancelled) {
            setSeasonCError(data.message || "시즌 C 데이터를 불러오지 못했습니다.");
            setSeasonCData(null);
            setSelectedRound(null);
          }
          return;
        }

        if (!cancelled) {
          setSeasonCData(data.data);
          setSeasonCLoadedForId(visibleUser.id);
          const defaultRound =
            data.data.rounds.find((round) => round.myScore !== null)?.round ?? 1;
          setSelectedRound(defaultRound);
        }
      } catch {
        if (!cancelled) {
          setSeasonCError("시즌 C 데이터를 불러오지 못했습니다.");
          setSeasonCData(null);
          setSeasonCLoadedForId(null);
          setSelectedRound(null);
        }
      } finally {
        if (!cancelled) {
          setSeasonCLoading(false);
        }
      }
    };

    loadSeasonC();

    return () => {
      cancelled = true;
    };
  }, [selectedSeason, canShowStudentPortal, visibleUser?.id, isAdminMode, seasonCData, seasonCLoadedForId, selectedRound]);

  useEffect(() => {
    if (selectedSeason !== "N") return;
    if (!canShowStudentPortal || !visibleUser?.id) return;
    if (seasonNData && seasonNLoadedForId === visibleUser.id) {
      setSeasonNLoading(false);
      setSeasonNError("");
      if (selectedNRound === null) {
        const defaultRound = seasonNData.rounds.find((r) => r.myScore !== null)?.round ?? 1;
        setSelectedNRound(defaultRound);
      }
      return;
    }

    let cancelled = false;
    const loadSeasonN = async () => {
      setSeasonNLoading(true);
      setSeasonNError("");
      setNCutSaveMessage("");

      const query = isAdminMode ? `?studentId=${encodeURIComponent(visibleUser.id)}` : "";

      try {
        const res = await fetch(`/api/season/n${query}`, { cache: "no-store" });
        const data = (await res.json()) as SeasonNResponse;

        if (!res.ok || !data.ok) {
          if (!cancelled) {
            setSeasonNError(data.message || "시즌 N 데이터를 불러오지 못했습니다.");
            setSeasonNData(null);
            setSelectedNRound(null);
          }
          return;
        }

        if (!cancelled) {
          setSeasonNData(data.data);
          setSeasonNLoadedForId(visibleUser.id);
          const defaultRound = data.data.rounds.find((r) => r.myScore !== null)?.round ?? 1;
          setSelectedNRound(defaultRound);
        }
      } catch {
        if (!cancelled) {
          setSeasonNError("시즌 N 데이터를 불러오지 못했습니다.");
          setSeasonNData(null);
          setSeasonNLoadedForId(null);
          setSelectedNRound(null);
        }
      } finally {
        if (!cancelled) setSeasonNLoading(false);
      }
    };

    loadSeasonN();
    return () => {
      cancelled = true;
    };
  }, [selectedSeason, canShowStudentPortal, visibleUser?.id, isAdminMode, seasonNData, seasonNLoadedForId, selectedNRound]);

  useEffect(() => {
    if (!selectedPremiumSeason) return;
    if (!canShowStudentPortal || !visibleUser?.id || !currentPremiumDataKey) return;
    if (activePremiumData) {
      setPremiumLoading(false);
      setPremiumError("");
      if (selectedPremiumRound === null) {
        const defaultRound =
          activePremiumData.rounds.find((round) => round.myScore !== null)?.round ??
          PREMIUM_MONTH_ROUNDS[0];
        setSelectedPremiumRound(defaultRound);
      }
      return;
    }

    let cancelled = false;
    const apiPath =
      selectedPremiumSeason === "SP" ? "/api/season/survival-premium" : "/api/season/premium";
    const premiumMeta = getPremiumSeasonMeta(selectedPremiumSeason);

    const loadPremium = async () => {
      setPremiumLoading(true);
      setPremiumError("");

      const query = isAdminMode ? `?studentId=${encodeURIComponent(visibleUser.id)}` : "";

      try {
        const res = await fetch(`${apiPath}${query}`, { cache: "no-store" });
        const data = (await res.json()) as PremiumSeasonResponse;

        if (!res.ok || !data.ok) {
          if (!cancelled) {
            setPremiumError(data.message || `${premiumMeta.title} 데이터를 불러오지 못했습니다.`);
            setPremiumData(null);
            setSelectedPremiumRound(null);
          }
          return;
        }

        if (!cancelled) {
          setPremiumData(data.data);
          setPremiumLoadedForKey(currentPremiumDataKey);
          const defaultRound =
            data.data.rounds.find((round) => round.myScore !== null)?.round ?? PREMIUM_MONTH_ROUNDS[0];
          setSelectedPremiumRound(defaultRound);
        }
      } catch {
        if (!cancelled) {
          setPremiumError(`${premiumMeta.title} 데이터를 불러오지 못했습니다.`);
          setPremiumData(null);
          setPremiumLoadedForKey(null);
          setSelectedPremiumRound(null);
        }
      } finally {
        if (!cancelled) {
          setPremiumLoading(false);
        }
      }
    };

    void loadPremium();

    return () => {
      cancelled = true;
    };
  }, [
    selectedPremiumSeason,
    canShowStudentPortal,
    visibleUser?.id,
    isAdminMode,
    currentPremiumDataKey,
    activePremiumData,
    selectedPremiumRound,
  ]);

  useEffect(() => {
    if (!selectedNRoundDetail) return;
    setNCutInputs({
      cut1: selectedNRoundDetail.cut1 === null ? "" : String(selectedNRoundDetail.cut1),
      cut2: selectedNRoundDetail.cut2 === null ? "" : String(selectedNRoundDetail.cut2),
      cut3: selectedNRoundDetail.cut3 === null ? "" : String(selectedNRoundDetail.cut3),
    });
  }, [selectedNRoundDetail]);

  useEffect(() => {
    if (!isAdminMode || adminStep !== "scores" || !adminCutSeason) return;

    let cancelled = false;

    const loadNCutoffsForRound = async () => {
      setNCutLoading(true);
      setNCutSaveMessage("");
      try {
        const res = await fetch(
          `/api/admin/season-cutoffs?season=${adminCutSeason}&round=${adminNInputRound}`,
          { cache: "no-store" }
        );
        const data = (await res.json()) as AdminSeasonCutoffsResponse;
        if (!res.ok || !data.ok) {
          if (!cancelled) {
            setNCutSaveMessage(data.message || "컷 정보를 불러오지 못했습니다.");
          }
          return;
        }

        const row = data.cutoffs?.[0] ?? null;
        if (!cancelled) {
          setNCutInputs({
            cut1: row?.cut1 === null || row?.cut1 === undefined ? "" : String(row.cut1),
            cut2: row?.cut2 === null || row?.cut2 === undefined ? "" : String(row.cut2),
            cut3: row?.cut3 === null || row?.cut3 === undefined ? "" : String(row.cut3),
          });
        }
      } catch {
        if (!cancelled) {
          setNCutSaveMessage("컷 정보를 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) {
          setNCutLoading(false);
        }
      }
    };

    loadNCutoffsForRound();

    return () => {
      cancelled = true;
    };
  }, [isAdminMode, adminStep, adminCutSeason, adminNInputRound]);

  async function handleSaveNCutoffs() {
    if (!isAdminMode || !adminCutSeason) return;
    const targetRound = adminStep === "scores" ? adminNInputRound : selectedNRound;
    if (!targetRound) return;
    setNCutSaveMessage("");

    const parseCut = (value: string) => {
      const v = value.trim();
      if (!v) return null;
      const n = Number(v);
      if (!Number.isFinite(n)) return null;
      return Math.max(0, Math.min(100, Math.round(n)));
    };

    const res = await fetch("/api/admin/season-cutoffs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        season: adminCutSeason,
        round: targetRound,
        cut1: parseCut(nCutInputs.cut1),
        cut2: parseCut(nCutInputs.cut2),
        cut3: parseCut(nCutInputs.cut3),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setNCutSaveMessage(data.message || "컷 저장 실패");
      return;
    }

    setNCutSaveMessage("컷 저장 완료");

    if (adminStep === "scores") {
      return;
    }

    const query = isAdminMode && visibleUser?.id ? `?studentId=${encodeURIComponent(visibleUser.id)}` : "";
    const refreshRes = await fetch(`/api/season/n${query}`, { cache: "no-store" });
    const refreshData = (await refreshRes.json()) as SeasonNResponse;
    if (refreshRes.ok && refreshData.ok) {
      setSeasonNData(refreshData.data);
    }
  }

  async function handleSaveSeasonNote() {
    if (!currentNoteTarget || !visibleUser?.id) return;

    setSeasonNoteMessage("");

    const res = await fetch("/api/season-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: isAdminMode ? visibleUser.id : undefined,
        season: currentNoteTarget.season,
        round: currentNoteTarget.round,
        studentNote: studentNoteDraft,
        adminComment: isAdminMode ? adminCommentDraft : undefined,
      }),
    });
    const data = (await res.json()) as SeasonNoteResponse;
    if (!res.ok || !data.ok) {
      setSeasonNoteMessage(data.message || "메모 저장에 실패했습니다.");
      return;
    }

    const query = new URLSearchParams({
      season: currentNoteTarget.season,
      round: String(currentNoteTarget.round),
    });
    if (isAdminMode) {
      query.set("studentId", visibleUser.id);
    }

    const refreshRes = await fetch(`/api/season-notes?${query.toString()}`, {
      cache: "no-store",
    });
    const refreshData = (await refreshRes.json()) as SeasonNoteResponse;
    if (refreshRes.ok && refreshData.ok && refreshData.note) {
      setSeasonNote(refreshData.note);
      setStudentNoteDraft(refreshData.note.studentNote || "");
      setAdminCommentDraft(refreshData.note.adminComment || "");
      setSeasonNoteMessage("메모를 저장했습니다.");
    } else {
      setSeasonNoteMessage(refreshData.message || "메모 저장 후 새로고침에 실패했습니다.");
    }
  }

  async function handleSaveAdminManagedNote() {
    if (!selectedAdminNote) return;

    setAdminNotesMessage("");

    const res = await fetch("/api/season-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: selectedAdminNote.studentId,
        season: selectedAdminNote.season,
        round: selectedAdminNote.round,
        studentNote: adminManagedNoteDraft,
        adminComment: adminManagedCommentDraft,
      }),
    });
    const data = (await res.json()) as SeasonNoteResponse;
    if (!res.ok || !data.ok) {
      setAdminNotesMessage(data.message || "메모 저장에 실패했습니다.");
      return;
    }

    const query = adminNotesQuery.trim()
      ? `?q=${encodeURIComponent(adminNotesQuery.trim())}`
      : "";
    const refreshRes = await fetch(`/api/admin/season-notes${query}`, { cache: "no-store" });
    const refreshData = (await refreshRes.json()) as AdminSeasonNotesResponse;
    if (refreshRes.ok && refreshData.ok) {
      const nextItems = refreshData.items ?? [];
      setAdminNotes(nextItems);
      setSelectedAdminNoteId(selectedAdminNote.id);
      setAdminNotesMessage("메모를 저장했습니다.");
    } else {
      setAdminNotesMessage(refreshData.message || "메모 저장 후 목록 갱신에 실패했습니다.");
    }
  }

  useEffect(() => {
    if (!isAdminMode || adminStep !== "stats") return;

    let cancelled = false;

    const loadAdminStats = async () => {
      setAdminStatsLoading(true);
      setAdminStatsError("");

      try {
        const res = await fetch(
          `/api/admin/stats?season=${statsSeason}&round=${statsRound}`,
          { cache: "no-store" }
        );
        const data = (await res.json()) as AdminStatsResponse;

        if (!res.ok || !data.ok || !data.stats) {
          if (!cancelled) {
            setAdminStats(null);
            setAdminStatsError(data.message || "통계를 불러오지 못했습니다.");
          }
          return;
        }

        if (!cancelled) {
          setAdminStats(data.stats);
        }
      } catch {
        if (!cancelled) {
          setAdminStats(null);
          setAdminStatsError("통계를 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) {
          setAdminStatsLoading(false);
        }
      }
    };

    loadAdminStats();

    return () => {
      cancelled = true;
    };
  }, [isAdminMode, adminStep, statsSeason, statsRound]);

  useEffect(() => {
    if (statsRoundOptions.includes(statsRound)) return;
    setStatsRound(statsRoundOptions[0]);
  }, [statsRound, statsRoundOptions]);

  useEffect(() => {
    if (!currentNoteTarget || !visibleUser?.id || !canShowStudentPortal) {
      setSeasonNote(null);
      setStudentNoteDraft("");
      setAdminCommentDraft("");
      setSeasonNoteMessage("");
      return;
    }

    let cancelled = false;

    const loadNote = async () => {
      setSeasonNoteLoading(true);
      setSeasonNoteMessage("");

      const query = new URLSearchParams({
        season: currentNoteTarget.season,
        round: String(currentNoteTarget.round),
      });
      if (isAdminMode) {
        query.set("studentId", visibleUser.id);
      }

      try {
        const res = await fetch(`/api/season-notes?${query.toString()}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as SeasonNoteResponse;
        if (!res.ok || !data.ok || !data.note) {
          if (!cancelled) {
            setSeasonNote(null);
            setStudentNoteDraft("");
            setAdminCommentDraft("");
            setSeasonNoteMessage(data.message || "메모를 불러오지 못했습니다.");
          }
          return;
        }

        if (!cancelled) {
          setSeasonNote(data.note);
          setStudentNoteDraft(data.note.studentNote || "");
          setAdminCommentDraft(data.note.adminComment || "");
        }
      } catch {
        if (!cancelled) {
          setSeasonNote(null);
          setStudentNoteDraft("");
          setAdminCommentDraft("");
          setSeasonNoteMessage("메모를 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) {
          setSeasonNoteLoading(false);
        }
      }
    };

    void loadNote();

    return () => {
      cancelled = true;
    };
  }, [currentNoteTarget, visibleUser?.id, canShowStudentPortal, isAdminMode]);

  useEffect(() => {
    if (!isAdminMode || adminStep !== "notes") return;

    let cancelled = false;

    const loadAdminNotes = async () => {
      setAdminNotesLoading(true);
      setAdminNotesMessage("");

      try {
        const query = adminNotesQuery.trim()
          ? `?q=${encodeURIComponent(adminNotesQuery.trim())}`
          : "";
        const res = await fetch(`/api/admin/season-notes${query}`, { cache: "no-store" });
        const data = (await res.json()) as AdminSeasonNotesResponse;

        if (!res.ok || !data.ok) {
          if (!cancelled) {
            setAdminNotes([]);
            setAdminNotesMessage(data.message || "메모 목록을 불러오지 못했습니다.");
          }
          return;
        }

        if (!cancelled) {
          const nextItems = data.items ?? [];
          setAdminNotes(nextItems);
          setSelectedAdminNoteId((prev) =>
            prev && nextItems.some((item) => item.id === prev) ? prev : nextItems[0]?.id ?? null
          );
        }
      } catch {
        if (!cancelled) {
          setAdminNotes([]);
          setAdminNotesMessage("메모 목록을 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) {
          setAdminNotesLoading(false);
        }
      }
    };

    void loadAdminNotes();

    return () => {
      cancelled = true;
    };
  }, [isAdminMode, adminStep, adminNotesQuery]);

  useEffect(() => {
    setAdminManagedNoteDraft(selectedAdminNote?.studentNote || "");
    setAdminManagedCommentDraft(selectedAdminNote?.adminComment || "");
  }, [selectedAdminNote]);

  function handleDownloadStatsPdf() {
    if (!adminStats) return;

    const win = window.open("", "_blank", "width=1200,height=900");
    if (!win) {
      setAdminStatsError("팝업이 차단되어 PDF 창을 열 수 없습니다.");
      return;
    }

    const classRows = sortClassStats(adminStats.classStats)
      .map(
        (row) =>
          `<tr><td>${row.className}</td><td>${row.count}</td><td>${row.average}</td><td>${row.median}</td><td>${row.stdDev}</td><td>${row.max}</td><td>${row.min}</td></tr>`
      )
      .join("");

    const weakRows = adminStats.weakQuestions
      .slice(0, 8)
      .map((row) => {
        const choiceCell = row.choiceRates
          .map((choice) => `${choice.choice}:${choice.rate}%`)
          .join(" / ");
        return `<tr><td>${row.question}번</td><td>${row.correctChoice ?? "-"}</td><td>${row.correctRate}%</td><td>${choiceCell}</td></tr>`;
      })
      .join("");

    const html = `
      <html>
        <head>
          <title>${isPremiumSeason(adminStats.season) ? `${getPremiumSeasonMeta(adminStats.season).title} ${adminStats.roundLabel ?? `${adminStats.round}월`}` : `${adminStats.season} 시즌 ${adminStats.round}회 통계`}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 28px; color: #111; }
            h1 { margin: 0 0 8px; font-size: 26px; }
            p { margin: 0 0 20px; color: #555; }
            .cards { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 10px; margin-bottom: 18px; }
            .card { border: 1px solid #ddd; border-radius: 10px; padding: 10px; }
            .label { color: #666; font-size: 12px; }
            .value { font-size: 24px; font-weight: 700; margin-top: 6px; }
            table { border-collapse: collapse; width: 100%; margin-top: 8px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            th { background: #f6f6f6; }
            h2 { margin: 20px 0 8px; font-size: 16px; }
          </style>
        </head>
        <body>
          <h1>${isPremiumSeason(adminStats.season) ? `${getPremiumSeasonMeta(adminStats.season).title} ${adminStats.roundLabel ?? `${adminStats.round}월`}` : `${adminStats.season} 시즌 ${adminStats.round}회 통계`}</h1>
          <p>전체 통계 및 반별 통계 리포트</p>
          <div class="cards">
            <div class="card"><div class="label">응시 인원</div><div class="value">${adminStats.participantCount}</div></div>
            <div class="card"><div class="label">평균 점수</div><div class="value">${adminStats.averageScore}</div></div>
            <div class="card"><div class="label">최고 점수</div><div class="value">${adminStats.maxScore}</div></div>
            <div class="card"><div class="label">최저 점수</div><div class="value">${adminStats.minScore}</div></div>
          </div>
          <h2>반별 통계</h2>
          <table>
            <thead><tr><th>반</th><th>인원</th><th>평균</th><th>중앙값</th><th>표준편차</th><th>최고</th><th>최저</th></tr></thead>
            <tbody>${classRows}</tbody>
          </table>
          ${
            adminStats.weakQuestions.length > 0
              ? `<h2>약점 문항(정답률 낮은 순)</h2>
          <table>
            <thead><tr><th>문항</th><th>정답</th><th>정답률</th><th>선택지 선택률</th></tr></thead>
            <tbody>${weakRows}</tbody>
          </table>`
              : `<h2>문항별 통계</h2><p>이 시험은 문항별 통계를 제공하지 않습니다.</p>`
          }
        </body>
      </html>
    `;

    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canLogin) return;

    setLoginError("");

    const res = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: studentName.trim(),
        phone: normalizePhone(phone),
        pin,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setLoginError(data.message || "로그인에 실패했습니다.");
      setLoginFailCount((prev) => prev + 1);
      return;
    }

    const user = data.user as SessionUser;
    if (user.role === "admin") {
      window.location.href = "/admin";
      return;
    }

    setSessionUser(user);
    setStudentName(user.name);
    setPhone(user.phone);
    setPin("");
    setLoginFailCount(0);
    applyProfile(data.profile as StudentProfile | undefined);
  };

  const dismissLoginIntro = useCallback(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(LOGIN_INTRO_SESSION_KEY, "1");
    }
    setShowLoginIntro(false);
  }, []);

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    if (isAdminMode) {
      window.location.href = "/";
      return;
    }

    setSessionUser(null);
    setSelectedSeason(null);
    setStudentName("");
    setPhone("");
    setPin("");
    setLoginError("");
    setLoginFailCount(0);
    setIsEditingProfile(false);
    setSaveMessage("");
    window.location.href = "/";
  };

  async function handleSaveProfile() {
    setSaveMessage("");
    const nextPin = newPin.trim();

    if (!isAdminMode && nextPin && !/^\d{4}$/.test(nextPin)) {
      setSaveMessage("비밀번호는 숫자 4자리여야 합니다.");
      return;
    }

    const endpoint = isAdminMode ? "/api/admin/student-profile" : "/api/profile";
    const body = isAdminMode
      ? {
          studentId: selectedStudent?.id,
          koreanSubject: selectedKorean,
          mathSubject: selectedMath,
          science1: selectedScience1,
          science2: selectedScience2,
          targetUniversity,
        }
      : {
          koreanSubject: selectedKorean,
          mathSubject: selectedMath,
          science1: selectedScience1,
          science2: selectedScience2,
          targetUniversity,
        };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      setSaveMessage(data.message || "저장 실패");
      return;
    }

    if (!isAdminMode && nextPin) {
      const pinRes = await fetch("/api/change-pin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          newPin: nextPin,
        }),
      });

      const pinData = await pinRes.json();
      if (!pinRes.ok) {
        setSaveMessage(pinData.message || "비밀번호 변경 실패");
        return;
      }

      setNewPin("");
      setSaveMessage("정보 저장 및 비밀번호 변경 완료");
      return;
    }

    setSaveMessage("저장 완료");
  }

  async function handleResetStudentPin() {
    if (!selectedStudent) return;

    setSaveMessage("");

    const res = await fetch("/api/admin/reset-pin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        studentId: selectedStudent.id,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setSaveMessage(data.message || "비밀번호 초기화 실패");
      return;
    }

    setSaveMessage("학생 비밀번호를 1111로 초기화했습니다.");
  }

  async function handleUnlockLoginGuard() {
    if (!selectedStudent) return;

    setSaveMessage("");

    const res = await fetch("/api/admin/unlock-login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        studentId: selectedStudent.id,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setSaveMessage(data.message || "로그인 잠금 해제 실패");
      return;
    }

    setSaveMessage("로그인 잠금/IP 제한을 해제했습니다.");
  }

  async function handleSelectStudent(student: ManagedStudent) {
    setIsLoadingStudent(true);
    setSaveMessage("");

    const res = await fetch(`/api/admin/student?studentId=${student.id}`, {
      cache: "no-store",
    });
    const data = await res.json();

    if (!res.ok) {
      setSaveMessage(data.message || "학생 정보를 불러오지 못했습니다.");
      setIsLoadingStudent(false);
      return;
    }

    studentProfileCacheRef.current[student.id] =
      (data.profile as StudentProfile | undefined) ?? null;
    pushPortalHistoryEntry();
    setSelectedStudent(student);
    applyProfile(data.profile as StudentProfile | undefined);
    setSelectedSeason(null);
    setAdminStep("search");
    setIsLoadingStudent(false);
  }

  async function handleCreateStudent() {
    const name = newStudentName.trim();
    const normalizedPhone = normalizePhone(newStudentPhone);
    const pinValue = newStudentPin.trim();
    const className = newStudentClassName.trim();

    setNewStudentMessage("");

    if (!name) {
      setNewStudentMessage("학생 이름을 입력해주세요.");
      return;
    }
    if (normalizedPhone.length < 10 || normalizedPhone.length > 11) {
      setNewStudentMessage("전화번호를 정확히 입력해주세요.");
      return;
    }
    if (!/^\d{4}$/.test(pinValue)) {
      setNewStudentMessage("비밀번호는 숫자 4자리여야 합니다.");
      return;
    }

    setNewStudentLoading(true);
    try {
      const res = await fetch("/api/admin/students", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          phone: normalizedPhone,
          pin: pinValue,
          className,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok || !data.student) {
        setNewStudentMessage(data.message || "학생 추가에 실패했습니다.");
        return;
      }

      const created = data.student as ManagedStudent;
      setAdminStudents((prev) =>
        [...prev, created]
          .filter(
            (student, index, arr) =>
              arr.findIndex((target) => target.id === student.id) === index
          )
          .sort((a, b) => a.name.localeCompare(b.name, "ko-KR"))
      );
      setNewStudentMessage("학생 추가 완료");
      setStudentSearch(created.name);
      setNewStudentName("");
      setNewStudentPhone("");
      setNewStudentPin("1111");
      setNewStudentClassName("");
    } catch {
      setNewStudentMessage("학생 추가 중 오류가 발생했습니다.");
    } finally {
      setNewStudentLoading(false);
    }
  }

  function closeProfileModal() {
    setIsEditingProfile(false);
    setSaveMessage("");
    setNewPin("");
  }

  function renderSeasonNoteCard(title: string) {
    if (!currentNoteTarget || !visibleUser?.id) return null;

    return (
      <Card className="rounded-[2rem] border border-white/10 bg-white/5 text-white shadow-2xl">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-2xl">{title}</CardTitle>
              <CardDescription className="text-white/55">
                시험을 마친 뒤 느낀 점, 부족했던 점, 다음 회차에서 보완할 점을 자유롭게 적을 수 있습니다.
              </CardDescription>
            </div>
            <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
              상태: {seasonNote?.status ?? "미댓글"}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {seasonNoteLoading ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-8 text-center text-white/65">
              메모를 불러오는 중...
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-white/75">셀프 피드백</Label>
                <textarea
                  value={studentNoteDraft}
                  onChange={(e) => setStudentNoteDraft(e.target.value)}
                  placeholder="이번 시험에서 아쉬웠던 점, 시간 관리, 개념 실수, 다음 회차 목표 등을 적어주세요."
                  className="min-h-[160px] w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/40"
                />
                <p className="text-xs text-white/45">
                  최근 메모 수정: {formatKst(seasonNote?.noteUpdatedAt ?? null)}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-white/75">관리자 댓글</Label>
                {isAdminMode ? (
                  <textarea
                    value={adminCommentDraft}
                    onChange={(e) => setAdminCommentDraft(e.target.value)}
                    placeholder="학생 메모에 대한 피드백을 댓글처럼 남길 수 있습니다."
                    className="min-h-[120px] w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300/40"
                  />
                ) : (
                  <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-4 text-sm text-emerald-50/90">
                    {seasonNote?.adminComment?.trim() ? seasonNote.adminComment : "아직 등록된 댓글이 없습니다."}
                  </div>
                )}
                <p className="text-xs text-white/45">
                  최근 댓글 수정: {formatKst(seasonNote?.adminCommentUpdatedAt ?? null)}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  className="rounded-2xl bg-white text-black hover:bg-white/90"
                  onClick={handleSaveSeasonNote}
                >
                  메모 저장
                </Button>
              </div>
              {seasonNoteMessage && <p className="text-sm text-white/65">{seasonNoteMessage}</p>}
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#06070a] text-white">
        로딩 중...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06070a] text-white">
      <div className="relative overflow-hidden">
        <AnimatePresence>
          {!isLoggedIn && showLoginIntro && (
            <AnimatedLoginIntro onComplete={dismissLoginIntro} />
          )}
        </AnimatePresence>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.15),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_20%)]" />
        <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-4 py-2 lg:flex-row lg:items-start lg:justify-between">
            {!canShowStudentPortal ? (
              <div className="text-sm uppercase tracking-[0.28em] text-white/45">
                {isAdminMode ? "Admin Portal" : "Student Portal"}
              </div>
            ) : (
              <div className="flex w-full min-w-0 items-center gap-3 rounded-[1.5rem] border border-white/10 bg-white/5 px-3 py-3 backdrop-blur lg:w-auto lg:max-w-3xl">
                <Image
                  src={profile.image}
                  alt={profile.label}
                  width={64}
                  height={64}
                  className="h-14 w-14 shrink-0 rounded-2xl bg-white p-2 object-contain sm:h-16 sm:w-16"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm text-white/45">
                    {profile.label} 지망
                    {isAdminMode && sessionUser ? ` · 관리자 로그인: ${sessionUser.name}` : ""}
                  </p>
                  <p className="truncate text-lg font-semibold">{visibleUser?.name}</p>
                  <p className="line-clamp-2 text-sm text-white/55">
                    선택과목: {selectedKorean} / {selectedMath} / {selectedScience1},{" "}
                    {selectedScience2}
                  </p>
                </div>
              </div>
            )}

            {isLoggedIn && (
              <div className="flex w-full flex-wrap items-center justify-end gap-2 lg:w-auto lg:gap-3">
                {isAdminMode && selectedStudent && (
                  <Button
                    variant="secondary"
                    className="h-10 rounded-2xl bg-white/10 px-3 text-sm text-white hover:bg-white/20"
                    onClick={() => {
                      setSelectedStudent(null);
                      setSelectedSeason(null);
                      setAdminStep("search");
                      setSaveMessage("");
                    }}
                  >
                    <Search className="mr-2 h-4 w-4" />
                    다른 학생으로 바꾸기
                  </Button>
                )}
                {canShowStudentPortal && (
                  <Button
                    variant="secondary"
                    className="h-10 rounded-2xl bg-white/10 px-3 text-sm text-white hover:bg-white/20"
                    onClick={() => setIsEditingProfile(true)}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    {isAdminMode ? "학생 정보 수정" : "학생 정보 수정"}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  className="h-10 rounded-2xl bg-white/10 px-3 text-sm text-white hover:bg-white/20"
                  onClick={handleLogout}
                >
                  로그아웃
                </Button>
              </div>
            )}
          </header>

          <AnimatePresence mode="wait">
            {!isLoggedIn ? (
              <motion.div
                key="landing"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.28 }}
                className="grid flex-1 items-center gap-10 py-8 lg:grid-cols-[1.15fr_0.85fr]"
              >
                <div className="flex flex-col justify-center gap-8 pt-10 sm:pt-16">
                  <div className="space-y-5">
                    <ScriptLogo />
                    <p className="max-w-2xl text-base leading-8 text-white/65 sm:text-lg">
                      실력이 만드는 결과의 차이, 프리미엄 물리학2 서비스
                    </p>
                  </div>
                </div>

                <Card className="rounded-[2rem] border border-white/10 bg-white/6 text-white shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-2xl">학생 로그인</CardTitle>
                    <CardDescription className="text-white/55">
                      이름, 전화번호, 비밀번호 4자리를 입력하면 시즌 선택 화면으로
                      이동합니다.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleLogin} className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="studentName" className="text-white/80">
                          이름
                        </Label>
                        <div className="relative">
                          <UserRound className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-white/35" />
                          <Input
                            id="studentName"
                            value={studentName}
                            onChange={(e) => setStudentName(e.target.value)}
                            placeholder="예: 이재욱"
                            className="h-12 rounded-2xl border-white/10 bg-black/30 pl-11 text-white placeholder:text-white/30"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-white/80">
                          전화번호
                        </Label>
                        <div className="relative">
                          <Phone className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-white/35" />
                          <Input
                            id="phone"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="예: 01012345678"
                            className="h-12 rounded-2xl border-white/10 bg-black/30 pl-11 text-white placeholder:text-white/30"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="pin" className="text-white/80">
                          비밀번호 (숫자 4자리)
                        </Label>
                        <Input
                          id="pin"
                          type="password"
                          value={pin}
                          onChange={(e) =>
                            setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                          }
                          placeholder="예: 1111"
                          className="h-12 rounded-2xl border-white/10 bg-black/30 text-white placeholder:text-white/30"
                        />
                      </div>

                      {loginError && (
                        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                          {loginError}
                        </div>
                      )}

                      {loginFailCount >= 5 && (
                        <div className="rounded-2xl border border-amber-300/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                          비밀번호 초기화 및 로그인 문의는 카카오톡 아이디
                          `jwlee2670` 또는 `010-3676-2670`으로 연락 주시면 빠르게
                          조치 후 연락드리겠습니다.
                        </div>
                      )}

                      <Button
                        type="submit"
                        disabled={!canLogin}
                        className="h-12 w-full rounded-2xl bg-white text-black hover:bg-white/90"
                      >
                        로그인
                      </Button>
                    </form>
                  </CardContent>
                </Card>

	                <div className="lg:col-span-2">
	                  <div className="flex justify-center">
	                    <div className="grid w-full max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {quickLinks.map((link) => {
                        const Icon = link.icon;
                        return (
                          <a
                            key={link.title}
                            href={link.href}
                            target={link.href.startsWith("http") ? "_blank" : undefined}
                            rel={link.href.startsWith("http") ? "noreferrer" : undefined}
                            className="group rounded-[1.4rem] border border-white/10 bg-white/5 p-4 text-left transition-all duration-200 hover:-translate-y-1 hover:bg-white/10"
                          >
                            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white/80">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-medium text-white">{link.title}</p>
                                <p className="mt-1 text-sm leading-6 text-white/45">
                                  {link.description}
                                </p>
                              </div>
                              <ArrowRight className="mt-1 h-4 w-4 text-white/40 transition-transform duration-200 group-hover:translate-x-1" />
                            </div>
                          </a>
                        );
                      })}
	                    </div>
	                  </div>
	                </div>

	              </motion.div>
	            ) : isAdminMode && !selectedStudent ? (
              <motion.div
                key={`admin-${adminStep}`}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.28 }}
                className="flex flex-1 flex-col justify-center py-10"
              >
                {adminStep === "home" ? (
                  <div className="space-y-8">
                    <div className="space-y-3 text-center">
                      <p className="text-sm uppercase tracking-[0.3em] text-white/40">
                        Admin Dashboard
                      </p>
                      <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                        관리자 페이지
                      </h2>
                      <p className="text-base text-white/55 sm:text-lg">
                        학생 검색 또는 점수 입력 작업을 선택하세요.
                      </p>
                    </div>

                    <div className="mx-auto grid w-full max-w-6xl gap-5 md:grid-cols-2 xl:grid-cols-5">
                      <button
                        type="button"
                        onClick={() => {
                          pushPortalHistoryEntry();
                          setAdminStep("search");
                        }}
                        className="group text-left"
                      >
                        <Card className="h-full rounded-[2rem] border border-white/10 bg-white/5 text-white shadow-2xl transition-all duration-200 group-hover:-translate-y-1 group-hover:bg-white/10">
                          <CardHeader>
                            <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-[1.2rem] bg-sky-400/10 text-sky-300 ring-1 ring-sky-300/20">
                              <Search className="h-6 w-6" />
                            </div>
                            <CardTitle className="flex items-center justify-between text-2xl">
                              학생 검색
                              <ArrowRight className="h-5 w-5 text-white/45 transition-transform duration-200 group-hover:translate-x-1" />
                            </CardTitle>
                            <CardDescription className="text-base text-white/50">
                              학생 이름으로 검색한 뒤 선택해서 학생 화면처럼
                              확인합니다.
                            </CardDescription>
                          </CardHeader>
                        </Card>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          pushPortalHistoryEntry();
                          setAdminStep("scores");
                          setAdminCutSeason(null);
                          setNCutSaveMessage("");
                        }}
                        className="group text-left"
                      >
                        <Card className="h-full rounded-[2rem] border border-white/10 bg-white/5 text-white shadow-2xl transition-all duration-200 group-hover:-translate-y-1 group-hover:bg-white/10">
                          <CardHeader>
                            <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-[1.2rem] bg-white/10 text-white ring-1 ring-white/20">
                              <Shield className="h-6 w-6" />
                            </div>
                            <CardTitle className="flex items-center justify-between text-2xl">
                              점수 입력하기
                              <ArrowRight className="h-5 w-5 text-white/45 transition-transform duration-200 group-hover:translate-x-1" />
                            </CardTitle>
                            <CardDescription className="text-base text-white/50">
                              시즌 선택 후 회차별 1컷, 2컷, 3컷을 입력합니다.
                            </CardDescription>
                          </CardHeader>
                        </Card>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          pushPortalHistoryEntry();
                          setAdminStep("create");
                          setNewStudentMessage("");
                        }}
                        className="group text-left"
                      >
                        <Card className="h-full rounded-[2rem] border border-white/10 bg-white/5 text-white shadow-2xl transition-all duration-200 group-hover:-translate-y-1 group-hover:bg-white/10">
                          <CardHeader>
                            <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-[1.2rem] bg-fuchsia-400/10 text-fuchsia-200 ring-1 ring-fuchsia-300/20">
                              <UserPlus className="h-6 w-6" />
                            </div>
                            <CardTitle className="flex items-center justify-between text-2xl">
                              학생 추가
                              <ArrowRight className="h-5 w-5 text-white/45 transition-transform duration-200 group-hover:translate-x-1" />
                            </CardTitle>
                            <CardDescription className="text-base text-white/50">
                              이름/전화번호/비밀번호/반을 입력해 학생 계정을 생성합니다.
                            </CardDescription>
                          </CardHeader>
                        </Card>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          pushPortalHistoryEntry();
                          setAdminStep("stats");
                        }}
                        className="group text-left"
                      >
                        <Card className="h-full rounded-[2rem] border border-white/10 bg-white/5 text-white shadow-2xl transition-all duration-200 group-hover:-translate-y-1 group-hover:bg-white/10">
                          <CardHeader>
                            <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-[1.2rem] bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-300/20">
                              <BookOpen className="h-6 w-6" />
                            </div>
                            <CardTitle className="flex items-center justify-between text-2xl">
                              통계 뽑기
                              <ArrowRight className="h-5 w-5 text-white/45 transition-transform duration-200 group-hover:translate-x-1" />
                            </CardTitle>
                            <CardDescription className="text-base text-white/50">
                              시즌/회차별 전체 통계와 반별 통계를 확인하고 PDF로 저장합니다.
                            </CardDescription>
                          </CardHeader>
                        </Card>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          pushPortalHistoryEntry();
                          setAdminStep("notes");
                          setAdminNotesMessage("");
                        }}
                        className="group text-left"
                      >
                        <Card className="h-full rounded-[2rem] border border-white/10 bg-white/5 text-white shadow-2xl transition-all duration-200 group-hover:-translate-y-1 group-hover:bg-white/10">
                          <CardHeader>
                            <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-[1.2rem] bg-cyan-400/10 text-cyan-200 ring-1 ring-cyan-300/20">
                              <MessageCircleMore className="h-6 w-6" />
                            </div>
                            <CardTitle className="flex items-center justify-between text-2xl">
                              메모 관리
                              <ArrowRight className="h-5 w-5 text-white/45 transition-transform duration-200 group-hover:translate-x-1" />
                            </CardTitle>
                            <CardDescription className="text-base text-white/50">
                              학생 메모를 최신 갱신 순으로 확인하고 댓글 상태를 관리합니다.
                            </CardDescription>
                          </CardHeader>
                        </Card>
                      </button>

                      <a
                        href="/shop"
                        className="group text-left"
                      >
                        <Card className="h-full rounded-[2rem] border border-amber-200/25 bg-amber-400/10 text-white shadow-2xl transition-all duration-200 group-hover:-translate-y-1 group-hover:bg-amber-400/15">
                          <CardHeader>
                            <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-[1.2rem] bg-amber-300/20 text-amber-100 ring-1 ring-amber-200/30">
                              <Gift className="h-6 w-6" />
                            </div>
                            <CardTitle className="flex items-center justify-between text-2xl">
                              상점 관리
                              <ArrowRight className="h-5 w-5 text-white/45 transition-transform duration-200 group-hover:translate-x-1" />
                            </CardTitle>
                            <CardDescription className="text-base text-white/50">
                              상자 재고/학생 로그/주차별 당첨/코인 조정을 관리합니다.
                            </CardDescription>
                          </CardHeader>
                        </Card>
                      </a>
                    </div>
                  </div>
                ) : adminStep === "scores" ? (
                  <div className="mx-auto w-full max-w-3xl">
                    <Card className="rounded-[2rem] border border-white/10 bg-white/5 text-white shadow-2xl">
                      <CardHeader>
                        <CardTitle className="text-3xl">점수 입력하기</CardTitle>
                        <CardDescription className="text-white/55">
                          시즌을 선택한 뒤 회차별 전역 컷을 입력합니다.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {!adminCutSeason ? (
                          <div className="space-y-4">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <Button
                                className="h-14 rounded-2xl bg-white text-black hover:bg-white/90"
                                onClick={() => {
                                  setAdminCutSeason("N");
                                  setAdminNInputRound(1);
                                }}
                              >
                                시즌 N
                              </Button>
                              <Button
                                variant="secondary"
                                className="h-14 rounded-2xl bg-white/10 text-white hover:bg-white/20"
                                onClick={() => {
                                  setAdminCutSeason("M");
                                  setAdminNInputRound(1);
                                }}
                              >
                                시즌 M
                              </Button>
                            </div>
                            <div className="flex flex-wrap gap-3">
                              <Button
                                variant="secondary"
                                className="rounded-2xl bg-white/10 text-white hover:bg-white/20"
                                onClick={() => setAdminStep("home")}
                              >
                                관리자 홈
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-white/70">
                                선택 시즌: <span className="font-semibold">{adminCutSeason} 시즌</span>
                              </p>
                              <Button
                                variant="secondary"
                                className="rounded-xl bg-white/10 text-white hover:bg-white/20"
                                onClick={() => {
                                  setAdminCutSeason(null);
                                  setNCutSaveMessage("");
                                }}
                              >
                                시즌 다시 선택
                              </Button>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-4">
                              <div className="space-y-2 sm:col-span-1">
                                <Label className="text-white/75">회차</Label>
                                <select
                                  value={adminNInputRound}
                                  onChange={(e) => setAdminNInputRound(Number(e.target.value))}
                                  className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-white"
                                >
                                  {Array.from({ length: 12 }, (_, i) => i + 1).map((round) => (
                                    <option key={`cut-round-${round}`} value={round}>
                                      {round}회
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-white/75">1컷</Label>
                                <Input
                                  value={nCutInputs.cut1}
                                  onChange={(e) =>
                                    setNCutInputs((prev) => ({
                                      ...prev,
                                      cut1: e.target.value.replace(/[^\d]/g, "").slice(0, 3),
                                    }))
                                  }
                                  placeholder="0~100"
                                  className="h-11 rounded-xl border-white/10 bg-black/30 text-white"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-white/75">2컷</Label>
                                <Input
                                  value={nCutInputs.cut2}
                                  onChange={(e) =>
                                    setNCutInputs((prev) => ({
                                      ...prev,
                                      cut2: e.target.value.replace(/[^\d]/g, "").slice(0, 3),
                                    }))
                                  }
                                  placeholder="0~100"
                                  className="h-11 rounded-xl border-white/10 bg-black/30 text-white"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-white/75">3컷</Label>
                                <Input
                                  value={nCutInputs.cut3}
                                  onChange={(e) =>
                                    setNCutInputs((prev) => ({
                                      ...prev,
                                      cut3: e.target.value.replace(/[^\d]/g, "").slice(0, 3),
                                    }))
                                  }
                                  placeholder="0~100"
                                  className="h-11 rounded-xl border-white/10 bg-black/30 text-white"
                                />
                              </div>
                            </div>
                            <div className="rounded-[1.2rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/65">
                              저장 위치: {adminCutSeason} 시즌 {adminNInputRound}회 전역 컷
                            </div>
                            <div className="flex flex-wrap gap-3">
                              <Button
                                className="rounded-2xl bg-white text-black hover:bg-white/90"
                                onClick={handleSaveNCutoffs}
                                disabled={nCutLoading}
                              >
                                {nCutLoading ? "불러오는 중..." : "컷 저장"}
                              </Button>
                              <Button
                                variant="secondary"
                                className="rounded-2xl bg-white/10 text-white hover:bg-white/20"
                                onClick={() => setAdminStep("home")}
                              >
                                관리자 홈
                              </Button>
                            </div>
                          </>
                        )}
                        {nCutSaveMessage && (
                          <p className="text-sm text-white/65">{nCutSaveMessage}</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ) : adminStep === "create" ? (
                  <div className="mx-auto w-full max-w-3xl">
                    <Card className="rounded-[2rem] border border-white/10 bg-white/5 text-white shadow-2xl">
                      <CardHeader>
                        <CardTitle className="text-3xl">학생 추가</CardTitle>
                        <CardDescription className="text-white/55">
                          이름/전화번호/비밀번호/반을 입력하면 즉시 계정이 생성됩니다.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label className="text-white/75">이름</Label>
                            <Input
                              value={newStudentName}
                              onChange={(e) => setNewStudentName(e.target.value)}
                              placeholder="학생 이름"
                              className="h-11 rounded-xl border-white/10 bg-black/30 text-white"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white/75">전화번호</Label>
                            <Input
                              value={newStudentPhone}
                              onChange={(e) =>
                                setNewStudentPhone(e.target.value.replace(/[^\d]/g, "").slice(0, 11))
                              }
                              placeholder="01012345678"
                              className="h-11 rounded-xl border-white/10 bg-black/30 text-white"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white/75">비밀번호 (숫자 4자리)</Label>
                            <Input
                              value={newStudentPin}
                              onChange={(e) =>
                                setNewStudentPin(e.target.value.replace(/[^\d]/g, "").slice(0, 4))
                              }
                              placeholder="1111"
                              className="h-11 rounded-xl border-white/10 bg-black/30 text-white"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white/75">반</Label>
                            <Input
                              value={newStudentClassName}
                              onChange={(e) => setNewStudentClassName(e.target.value)}
                              placeholder="토요반 / 금요반 / 영상반"
                              className="h-11 rounded-xl border-white/10 bg-black/30 text-white"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Button
                            className="rounded-2xl bg-white text-black hover:bg-white/90"
                            onClick={handleCreateStudent}
                            disabled={newStudentLoading}
                          >
                            {newStudentLoading ? "생성 중..." : "학생 생성"}
                          </Button>
                          <Button
                            variant="secondary"
                            className="rounded-2xl bg-white/10 text-white hover:bg-white/20"
                            onClick={() => setAdminStep("search")}
                          >
                            학생 검색으로 이동
                          </Button>
                          <Button
                            variant="secondary"
                            className="rounded-2xl bg-white/10 text-white hover:bg-white/20"
                            onClick={() => setAdminStep("home")}
                          >
                            관리자 홈
                          </Button>
                        </div>

                        {newStudentMessage && (
                          <p className="text-sm text-white/65">{newStudentMessage}</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ) : adminStep === "notes" ? (
                  <div className="mx-auto w-full max-w-7xl space-y-5">
                    <Card className="rounded-[2rem] border border-white/10 bg-white/5 text-white shadow-2xl">
                      <CardHeader>
                        <CardTitle className="text-3xl">메모 관리</CardTitle>
                        <CardDescription className="text-white/55">
                          학생 메모를 최신 갱신 순으로 확인하고 댓글 여부를 관리합니다.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        <div className="flex flex-wrap gap-3">
                          <div className="min-w-[260px] flex-1">
                            <Input
                              value={adminNotesQuery}
                              onChange={(e) => setAdminNotesQuery(e.target.value)}
                              placeholder="학생 이름 / 전화번호 / 시즌 검색"
                              className="h-11 rounded-xl border-white/10 bg-black/30 text-white"
                            />
                          </div>
                          <Button
                            variant="secondary"
                            className="rounded-2xl bg-white/10 text-white hover:bg-white/20"
                            onClick={() => setAdminStep("home")}
                          >
                            관리자 홈
                          </Button>
                        </div>

                        {adminNotesMessage && (
                          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">
                            {adminNotesMessage}
                          </div>
                        )}

                        <div className="grid gap-5 xl:grid-cols-[1.12fr_0.88fr]">
                          <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/20">
                            <div className="border-b border-white/10 px-4 py-3 text-sm text-white/55">
                              최신 메모 목록
                            </div>
                            <div className="max-h-[720px] overflow-auto">
                              {adminNotesLoading ? (
                                <div className="px-4 py-8 text-center text-sm text-white/60">
                                  메모 목록을 불러오는 중...
                                </div>
                              ) : adminNotes.length === 0 ? (
                                <div className="px-4 py-8 text-center text-sm text-white/60">
                                  표시할 메모가 없습니다.
                                </div>
                              ) : (
                                <table className="w-full min-w-[760px] text-sm">
                                  <thead className="sticky top-0 bg-[#0b0d12] text-white/55">
                                    <tr>
                                      <th className="px-4 py-3 text-left">갱신 시각</th>
                                      <th className="px-4 py-3 text-left">학생</th>
                                      <th className="px-4 py-3 text-left">시험</th>
                                      <th className="px-4 py-3 text-left">상태</th>
                                      <th className="px-4 py-3 text-left">메모</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {adminNotes.map((item) => (
                                      <tr
                                        key={item.id}
                                        className={`cursor-pointer border-t border-white/10 transition hover:bg-white/5 ${
                                          selectedAdminNoteId === item.id ? "bg-white/10" : ""
                                        }`}
                                        onClick={() => setSelectedAdminNoteId(item.id)}
                                      >
                                        <td className="px-4 py-3">{formatKst(item.noteUpdatedAt)}</td>
                                        <td className="px-4 py-3">
                                          {item.studentName}
                                          <span className="ml-2 text-xs text-white/45">
                                            {item.studentPhone}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3">
                                          {formatSeasonRoundLabel(item.season, item.round)}
                                        </td>
                                        <td className="px-4 py-3">
                                          <span
                                            className={`rounded-full px-2.5 py-1 text-xs ${
                                              item.status === "미댓글"
                                                ? "bg-amber-300/15 text-amber-100"
                                                : item.status === "갱신됨"
                                                  ? "bg-cyan-300/15 text-cyan-100"
                                                  : "bg-emerald-300/15 text-emerald-100"
                                            }`}
                                          >
                                            {item.status}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3 text-white/75">
                                          {item.studentNote.slice(0, 72) || "-"}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </div>

                          <Card className="rounded-[1.5rem] border border-white/10 bg-black/20 text-white shadow-none">
                            <CardHeader>
                              <CardTitle className="text-2xl">선택 메모</CardTitle>
                              <CardDescription className="text-white/55">
                                학생 메모와 관리자 댓글을 같은 화면에서 수정할 수 있습니다.
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              {!selectedAdminNote ? (
                                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-10 text-center text-white/60">
                                  왼쪽 목록에서 메모를 선택해 주세요.
                                </div>
                              ) : (
                                <>
                                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                                    <p className="text-lg font-semibold text-white">
                                      {selectedAdminNote.studentName}
                                    </p>
                                    <p className="mt-1 text-sm text-white/55">
                                      {selectedAdminNote.studentPhone}
                                      {selectedAdminNote.className
                                        ? ` · ${normalizeClassNameLabel(selectedAdminNote.className)}`
                                        : ""}
                                    </p>
                                    <p className="mt-2 text-sm text-white/70">
                                      {formatSeasonRoundLabel(
                                        selectedAdminNote.season,
                                        selectedAdminNote.round,
                                        { longPremium: true }
                                      )}
                                    </p>
                                  </div>

                                  <div className="space-y-2">
                                    <Label className="text-white/75">학생 메모</Label>
                                    <textarea
                                      value={adminManagedNoteDraft}
                                      onChange={(e) => setAdminManagedNoteDraft(e.target.value)}
                                      className="min-h-[180px] w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/40"
                                    />
                                    <p className="text-xs text-white/45">
                                      최근 메모 갱신: {formatKst(selectedAdminNote.noteUpdatedAt)}
                                    </p>
                                  </div>

                                  <div className="space-y-2">
                                    <Label className="text-white/75">관리자 댓글</Label>
                                    <textarea
                                      value={adminManagedCommentDraft}
                                      onChange={(e) => setAdminManagedCommentDraft(e.target.value)}
                                      className="min-h-[140px] w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300/40"
                                    />
                                    <p className="text-xs text-white/45">
                                      최근 댓글 수정: {formatKst(selectedAdminNote.adminCommentUpdatedAt)}
                                    </p>
                                  </div>

                                  <div className="flex flex-wrap gap-3">
                                    <Button
                                      className="rounded-2xl bg-white text-black hover:bg-white/90"
                                      onClick={handleSaveAdminManagedNote}
                                    >
                                      메모/댓글 저장
                                    </Button>
                                  </div>
                                </>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : adminStep === "stats" ? (
                  <div className="mx-auto w-full max-w-6xl space-y-5">
                    <Card className="rounded-[2rem] border border-white/10 bg-white/5 text-white shadow-2xl">
                      <CardHeader>
                        <CardTitle className="text-3xl">통계 뽑기</CardTitle>
                        <CardDescription className="text-white/55">
                          시즌/회차를 선택하면 전체 통계, 반별 통계를 확인할 수 있습니다.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        <div className="grid gap-4 sm:grid-cols-3">
                          <div className="space-y-2">
                            <Label className="text-white/75">시즌</Label>
                            <select
                              value={statsSeason}
                              onChange={(e) =>
                                setStatsSeason(e.target.value as "C" | "M" | "N" | PremiumSeasonCode)
                              }
                              className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-white"
                            >
                              <option value="C">C 시즌</option>
                              <option value="N">N 시즌</option>
                              <option value="M">M 시즌</option>
                              <option value="DP">{getPremiumSeasonMeta("DP").title}</option>
                              <option value="SP">{getPremiumSeasonMeta("SP").title}</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white/75">회차</Label>
                            <select
                              value={statsRound}
                              onChange={(e) => setStatsRound(Number(e.target.value))}
                              className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-white"
                            >
                              {statsRoundOptions.map((round) => (
                                <option key={round} value={round}>
                                  {isPremiumSeason(statsSeason) ? getPremiumRoundLabel(round) : `${round}회`}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-end">
                            <Button
                              className="h-11 rounded-xl bg-white text-black hover:bg-white/90"
                              onClick={handleDownloadStatsPdf}
                              disabled={!adminStats || adminStatsLoading}
                            >
                              PDF 다운로드
                            </Button>
                          </div>
                        </div>

                        {adminStatsLoading ? (
                          <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-6 text-white/70">
                            통계를 불러오는 중...
                          </div>
                        ) : adminStatsError ? (
                          <div className="rounded-[1.5rem] border border-amber-300/30 bg-amber-500/10 p-6 text-amber-100">
                            {adminStatsError}
                          </div>
                        ) : adminStats ? (
                          <div className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-4">
                              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <p className="text-sm text-white/45">응시 인원</p>
                                <p className="mt-2 text-3xl font-semibold">
                                  {adminStats.participantCount}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <p className="text-sm text-white/45">평균 점수</p>
                                <p className="mt-2 text-3xl font-semibold">
                                  {adminStats.averageScore}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <p className="text-sm text-white/45">최고 점수</p>
                                <p className="mt-2 text-3xl font-semibold">
                                  {adminStats.maxScore}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <p className="text-sm text-white/45">최저 점수</p>
                                <p className="mt-2 text-3xl font-semibold">
                                  {adminStats.minScore}
                                </p>
                              </div>
                            </div>

                            <div className="grid gap-4 xl:grid-cols-2">
                              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                                <div className="border-b border-white/10 px-4 py-3 text-sm text-white/55">
                                  반별 통계
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full min-w-[420px] text-sm">
                                    <thead className="text-white/55">
                                      <tr>
                                        <th className="px-3 py-3 text-left">반</th>
                                        <th className="px-3 py-3 text-left">인원</th>
                                        <th className="px-3 py-3 text-left">평균</th>
                                        <th className="px-3 py-3 text-left">중앙값</th>
                                        <th className="px-3 py-3 text-left">표준편차</th>
                                        <th className="px-3 py-3 text-left">최고</th>
                                        <th className="px-3 py-3 text-left">최저</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {sortClassStats(adminStats.classStats).map((row) => (
                                        <tr key={row.className} className="border-t border-white/10">
                                          <td className="px-3 py-3">{row.className}</td>
                                          <td className="px-3 py-3">{row.count}</td>
                                          <td className="px-3 py-3">{row.average}</td>
                                          <td className="px-3 py-3">{row.median}</td>
                                          <td className="px-3 py-3">{row.stdDev}</td>
                                          <td className="px-3 py-3">{row.max}</td>
                                          <td className="px-3 py-3">{row.min}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                                <div className="border-b border-white/10 px-4 py-3 text-sm text-white/55">
                                  {isPremiumSeason(adminStats.season)
                                    ? "문항별 통계"
                                    : "약점 문항 (정답률 낮은 순)"}
                                </div>
                                {isPremiumSeason(adminStats.season) ? (
                                  <div className="px-4 py-8 text-center text-sm text-white/60">
                                    {getPremiumSeasonMeta(adminStats.season).title}는 문항별 통계를 제공하지 않습니다.
                                  </div>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full min-w-[420px] text-sm">
                                      <thead className="text-white/55">
                                        <tr>
                                          <th className="px-3 py-3 text-left">문항</th>
                                          <th className="px-3 py-3 text-left">정답</th>
                                          <th className="px-3 py-3 text-left">정답률</th>
                                          <th className="px-3 py-3 text-left">1번</th>
                                          <th className="px-3 py-3 text-left">2번</th>
                                          <th className="px-3 py-3 text-left">3번</th>
                                          <th className="px-3 py-3 text-left">4번</th>
                                          <th className="px-3 py-3 text-left">5번</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {adminStats.weakQuestions.slice(0, 8).map((row) => (
                                          <tr key={row.question} className="border-t border-white/10">
                                            <td className="px-3 py-3">{row.question}번</td>
                                            <td className="px-3 py-3">{row.correctChoice ?? "-"}</td>
                                            <td className="px-3 py-3">{row.correctRate}%</td>
                                            {row.choiceRates.map((choice) => (
                                              <td
                                                key={`${row.question}-${choice.choice}`}
                                                className={`px-3 py-3 ${
                                                  choice.choice === row.correctChoice
                                                    ? "font-semibold text-emerald-300"
                                                    : ""
                                                }`}
                                              >
                                                {choice.rate}%
                                              </td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : null}

                        <div className="flex gap-3">
                          <Button
                            variant="secondary"
                            className="rounded-2xl bg-white/10 text-white hover:bg-white/20"
                            onClick={() => setAdminStep("home")}
                          >
                            관리자 홈
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="mx-auto w-full max-w-5xl space-y-6">
                    <div className="space-y-3 text-center">
                      <p className="text-sm uppercase tracking-[0.3em] text-white/40">
                        Search Student
                      </p>
                      <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                        학생 이름 검색
                      </h2>
                      <p className="text-base text-white/55 sm:text-lg">
                        이름으로 학생을 찾고 선택하면 학생 화면과 동일하게 볼 수
                        있습니다.
                      </p>
                    </div>

                    <Card className="rounded-[2rem] border border-white/10 bg-white/5 text-white shadow-2xl">
                      <CardContent className="space-y-5 pt-6">
                        <div className="relative">
                          <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-white/35" />
                          <Input
                            value={studentSearch}
                            onChange={(e) => setStudentSearch(e.target.value)}
                            placeholder="학생 이름 입력"
                            className="h-12 rounded-2xl border-white/10 bg-black/30 pl-11 text-white placeholder:text-white/30"
                          />
                        </div>

                        <div className="grid gap-3">
                          {filteredStudents.map((student) => (
                            <button
                              key={student.id}
                              type="button"
                              onClick={() => handleSelectStudent(student)}
                              className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10"
                            >
                              <div className="flex items-center justify-between gap-4">
                                <div>
                                  <p className="text-lg font-semibold">{student.name}</p>
                                  <p className="text-sm text-white/55">
                                    {student.phone}
                                    {student.className
                                      ? ` · ${normalizeClassNameLabel(student.className)}`
                                      : ""}
                                  </p>
                                </div>
                                <ArrowRight className="h-5 w-5 text-white/40" />
                              </div>
                            </button>
                          ))}
                          {!filteredStudents.length && (
                            <div className="rounded-[1.5rem] border border-dashed border-white/15 bg-black/20 p-6 text-center text-white/55">
                              검색 결과가 없습니다.
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Button
                            variant="secondary"
                            className="rounded-2xl bg-white/10 text-white hover:bg-white/20"
                            onClick={() => setAdminStep("home")}
                          >
                            뒤로 가기
                          </Button>
                        </div>

                        {isLoadingStudent && (
                          <p className="text-sm text-white/60">학생 정보를 불러오는 중...</p>
                        )}
                        {saveMessage && (
                          <p className="text-sm text-white/60">{saveMessage}</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key={isAdminMode ? `admin-student-${selectedStudent?.id}` : "season-select"}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.28 }}
                className="flex flex-1 flex-col justify-center py-10"
              >
                {isEditingProfile && (
                  <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 px-4 py-4 backdrop-blur-sm sm:py-8">
                    <Card className="mx-auto w-full max-w-2xl rounded-[2rem] border border-white/10 bg-[#0b0d12] text-white shadow-2xl">
                      <CardHeader className="flex flex-row items-start justify-between space-y-0">
                        <div>
                          <CardTitle className="text-2xl">
                            {isAdminMode ? "학생 정보 수정" : "학생 정보 수정"}
                          </CardTitle>
                          <CardDescription className="mt-2 text-white/55">
                            이름과 전화번호는 고정입니다.
                            {isAdminMode
                              ? " 관리자는 학생의 선택과목 / 희망 대학 수정, 비밀번호 1111 초기화, 로그인 잠금 해제를 할 수 있습니다."
                              : " 선택과목 / 희망 대학 / 비밀번호만 수정할 수 있습니다."}
                          </CardDescription>
                        </div>
                        <button
                          onClick={closeProfileModal}
                          className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/70 transition hover:bg-white/10"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </CardHeader>

                      <CardContent className="space-y-5 pb-6">
                        <div className="grid gap-5 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label className="text-white/75">이름</Label>
                            <Input
                              value={visibleUser?.name ?? ""}
                              disabled
                              className="h-12 rounded-2xl border-white/10 bg-white/5 text-white/55 disabled:opacity-100"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white/75">전화번호</Label>
                            <Input
                              value={visibleUser?.phone ?? ""}
                              disabled
                              className="h-12 rounded-2xl border-white/10 bg-white/5 text-white/55 disabled:opacity-100"
                            />
                          </div>
                        </div>

                        <div className="grid gap-5 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="korean" className="text-white/80">
                              국어 선택과목
                            </Label>
                            <select
                              id="korean"
                              value={selectedKorean}
                              onChange={(e) => setSelectedKorean(e.target.value)}
                              className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none"
                            >
                              {subjectOptions.korean.map((subject) => (
                                <option
                                  key={subject}
                                  value={subject}
                                  className="bg-slate-900 text-white"
                                >
                                  {subject}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="math" className="text-white/80">
                              수학 선택과목
                            </Label>
                            <select
                              id="math"
                              value={selectedMath}
                              onChange={(e) => setSelectedMath(e.target.value)}
                              className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none"
                            >
                              {subjectOptions.math.map((subject) => (
                                <option
                                  key={subject}
                                  value={subject}
                                  className="bg-slate-900 text-white"
                                >
                                  {subject}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid gap-5 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="science1" className="text-white/80">
                              과탐 선택과목 1
                            </Label>
                            <select
                              id="science1"
                              value={selectedScience1}
                              onChange={(e) => setSelectedScience1(e.target.value)}
                              className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none"
                            >
                              {subjectOptions.science.map((subject) => (
                                <option
                                  key={subject}
                                  value={subject}
                                  className="bg-slate-900 text-white"
                                >
                                  {subject}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="science2" className="text-white/80">
                              과탐 선택과목 2
                            </Label>
                            <select
                              id="science2"
                              value={selectedScience2}
                              onChange={(e) => setSelectedScience2(e.target.value)}
                              className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none"
                            >
                              {subjectOptions.science.map((subject) => (
                                <option
                                  key={subject}
                                  value={subject}
                                  className="bg-slate-900 text-white"
                                >
                                  {subject}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="university" className="text-white/80">
                            희망 대학
                          </Label>
                          <select
                            id="university"
                            value={targetUniversity}
                            onChange={(e) =>
                              setTargetUniversity(
                                e.target.value as keyof typeof universityProfiles
                              )
                            }
                            className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none"
                          >
                            {Object.entries(universityProfiles).map(([key, value]) => (
                              <option
                                key={key}
                                value={key}
                                className="bg-slate-900 text-white"
                              >
                                {value.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {!isAdminMode && (
                          <div className="space-y-2">
                            <Label htmlFor="newPin" className="text-white/80">
                              새 비밀번호 (숫자 4자리, 선택 입력)
                            </Label>
                            <Input
                              id="newPin"
                              type="password"
                              value={newPin}
                              onChange={(e) =>
                                setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                              }
                              placeholder="예: 4821"
                              className="h-12 rounded-2xl border-white/10 bg-black/30 text-white placeholder:text-white/30"
                            />
                            <p className="text-xs text-white/45">
                              비밀번호를 비워두면 기존 비밀번호가 유지됩니다.
                            </p>
                          </div>
                        )}

                        <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/5">
                          <div className="flex h-44 items-center justify-center bg-white p-6">
                            <Image
                              src={profile.image}
                              alt={profile.label}
                              width={240}
                              height={176}
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                          <div className="p-4">
                            <p className="text-sm text-white/45">현재 프로필</p>
                            <p className="text-lg font-semibold">{profile.label}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap justify-end gap-3">
                          <Button
                            variant="secondary"
                            className="rounded-2xl bg-white/10 text-white hover:bg-white/20"
                            onClick={closeProfileModal}
                          >
                            닫기
                          </Button>

                          {isAdminMode ? (
                            <Button
                              variant="secondary"
                              className="rounded-2xl bg-white/10 text-white hover:bg-white/20"
                              onClick={handleResetStudentPin}
                            >
                              비밀번호 1111로 초기화
                            </Button>
                          ) : null}

                          {isAdminMode ? (
                            <Button
                              variant="secondary"
                              className="rounded-2xl bg-white/10 text-white hover:bg-white/20"
                              onClick={handleUnlockLoginGuard}
                            >
                              로그인 잠금 해제
                            </Button>
                          ) : null}

                          <Button
                            className="rounded-2xl bg-white text-black hover:bg-white/90"
                            onClick={handleSaveProfile}
                          >
                            정보 저장
                          </Button>
                        </div>

                        {saveMessage && (
                          <p className="text-sm text-white/60">{saveMessage}</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}

                {!selectedSeason ? (
                  <div className="space-y-8">
                    <div className="space-y-3 text-center">
                      <p className="text-sm uppercase tracking-[0.3em] text-white/40">
                        Welcome
                      </p>
                      <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                        {visibleUser?.name} {isAdminMode ? "학생 화면" : "학생, 시즌을 선택하세요"}
                      </h2>
                      <p className="text-base text-white/55 sm:text-lg">
                        {isAdminMode
                          ? "관리자 로그인 상태로 학생 화면과 동일하게 확인할 수 있습니다."
                          : "C 시즌 / N 시즌 / M 시즌 / 더프리미엄 모의고사 / 서바이벌 프로 중 원하는 항목을 눌러 성적 화면으로 이동할 수 있습니다."}
                      </p>
                    </div>

                    <div className="mx-auto w-full max-w-5xl">
                      <a
                        href="/shop"
                        className="group block w-full text-left"
                      >
                        <Card className="rounded-[2rem] border border-amber-200/25 bg-amber-400/10 text-white transition duration-300 group-hover:-translate-y-0.5 group-hover:border-amber-200/40 group-hover:bg-amber-400/15">
                          <CardHeader className="space-y-3">
                            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-200/35 bg-amber-400/20 px-3 py-1 text-xs text-amber-100">
                              <Gift className="h-3.5 w-3.5" />
                              Treasure Shop
                            </div>
                            <CardTitle className="flex items-center justify-between text-2xl">
                              상점 입장하기
                              <ArrowRight className="h-5 w-5 text-white/50 transition-transform duration-200 group-hover:translate-x-1" />
                            </CardTitle>
                            <CardDescription className="text-base text-white/65">
                              코인으로 브론즈/실버/골드/다이아 상자를 열고 당첨 기록을
                              확인할 수 있습니다.
                            </CardDescription>
                          </CardHeader>
                        </Card>
                      </a>
                    </div>

                    <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-2 xl:grid-cols-4">
                      {seasons.map((season, index) => (
                        <motion.button
                          type="button"
                          key={season.id}
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.08 }}
                          onClick={() => {
                            pushPortalHistoryEntry();
                            setSelectedSeason(season.id);
                          }}
                          className="group text-left"
                        >
                          <Card className="h-full rounded-[2rem] border border-white/10 bg-white/5 text-white shadow-2xl transition-all duration-200 group-hover:-translate-y-1 group-hover:bg-white/10">
                            <CardHeader>
                              <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-[1.2rem] bg-sky-400/10 text-xl font-semibold text-sky-300 ring-1 ring-sky-300/20">
                                {season.badge}
                              </div>
                              <CardTitle className="flex items-center justify-between text-2xl">
                                {season.title}
                                <ArrowRight className="h-5 w-5 text-white/45 transition-transform duration-200 group-hover:translate-x-1" />
                              </CardTitle>
                              <CardDescription className="text-base text-white/50">
                                {season.subtitle}
                              </CardDescription>
                            </CardHeader>
                          </Card>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                ) : (
                  selectedSeason === "C" ? (
                    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
                      <div className="self-start">
                        <Button
                          variant="secondary"
                          className="rounded-2xl bg-white/10 text-white hover:bg-white/20"
                          onClick={() => setSelectedSeason(null)}
                        >
                          시즌 선택으로 돌아가기
                        </Button>
                      </div>
                      <Card className="rounded-[2rem] border border-white/10 bg-white/5 text-white shadow-2xl">
                        <CardHeader>
                          <CardTitle className="text-3xl">C 시즌 (1~10회)</CardTitle>
                          <CardDescription className="text-white/55">
                            회차를 누르면 해당 회차 통계를 확인할 수 있습니다. 회색
                            막대는 평균, 빨간 점과 선은 내 점수입니다.
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {seasonCLoading ? (
                            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-6 text-white/70">
                              시즌 C 데이터를 불러오는 중...
                            </div>
                          ) : seasonCError ? (
                            <div className="rounded-[1.5rem] border border-red-400/20 bg-red-500/10 p-6 text-red-200">
                              {seasonCError}
                            </div>
                          ) : seasonCData ? (
                            <div className="space-y-6">
                              <div className="relative overflow-x-auto">
                                <div className="relative h-[390px] min-w-[700px] rounded-[1.5rem] border border-white/10 bg-black/20 px-6 py-6">
                                  <div className="pointer-events-none absolute inset-x-6 top-6 bottom-14">
                                    <div className="absolute inset-x-0 top-0 border-t border-white/10" />
                                    <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-white/10" />
                                    <div className="absolute inset-x-0 bottom-0 border-t border-white/20" />
                                    <div className="absolute inset-y-0 left-0 border-l border-white/20" />
                                  </div>

                                  <div className="absolute left-0 top-5 w-10 text-right text-xs text-white/50 sm:w-12">
                                    100
                                  </div>
                                  <div className="absolute left-0 top-[48%] w-10 -translate-y-1/2 text-right text-xs text-white/50 sm:w-12">
                                    50
                                  </div>
                                  <div className="absolute left-0 bottom-11 w-10 text-right text-xs text-white/50 sm:w-12">
                                    0
                                  </div>

                                  {myPlotPoints.length > 0 && (
                                    <svg
                                      viewBox="0 0 100 100"
                                      className="pointer-events-none absolute left-12 right-6 top-6 bottom-14 h-[calc(100%-80px)] w-[calc(100%-72px)]"
                                      preserveAspectRatio="none"
                                    >
                                      {smoothLinePath && (
                                        <path
                                          d={smoothLinePath}
                                          fill="none"
                                          stroke={SCORE_LINE_COLOR}
                                          strokeWidth="1.6"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeOpacity="0.92"
                                        />
                                      )}
                                      {myPlotPoints.map((point, index) => (
                                        <g key={`my-point-${index}`}>
                                          <circle
                                            cx={point.x}
                                            cy={point.y}
                                            fill={SCORE_POINT_COLOR}
                                            fillOpacity="0.28"
                                            r="1.9"
                                          />
                                          <circle
                                            cx={point.x}
                                            cy={point.y}
                                            fill={SCORE_POINT_COLOR}
                                            stroke={SCORE_POINT_RING}
                                            strokeWidth="0.42"
                                            r="1.32"
                                          />
                                        </g>
                                      ))}
                                    </svg>
                                  )}

                                  <div className="absolute left-12 right-6 top-6 bottom-14 grid grid-cols-10 gap-2">
                                    {seasonCData.rounds.map((round) => {
                                      const averageHeight = `${round.averageScore}%`;
                                      const isSelected = selectedRound === round.round;

                                      return (
                                        <button
                                          key={round.round}
                                          type="button"
                                          onClick={() => setSelectedRound(round.round)}
                                          className={`relative flex h-full items-end justify-center transition ${
                                            isSelected ? "scale-[1.02]" : "opacity-90 hover:opacity-100"
                                          }`}
                                        >
                                          <div
                                            className={`w-8 rounded-t-xl bg-white/30 transition sm:w-9 ${
                                              isSelected ? "ring-2 ring-sky-300/60" : ""
                                            }`}
                                            style={{ height: averageHeight }}
                                          />
                                        </button>
                                      );
                                    })}
                                  </div>

                                  <div className="absolute left-12 right-6 bottom-4 grid grid-cols-10 gap-2">
                                    {seasonCData.rounds.map((round) => (
                                      <button
                                        key={`label-${round.round}`}
                                        type="button"
                                        onClick={() => setSelectedRound(round.round)}
                                        className={`rounded-md py-1 text-center transition ${
                                          selectedRound === round.round
                                            ? "bg-white/10"
                                            : "hover:bg-white/5"
                                        }`}
                                      >
                                        <p className="text-sm font-medium text-white/90">
                                          {round.round}회
                                        </p>
                                        <p className="text-[11px] text-white/45">
                                          평균 {round.averageScore}
                                        </p>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {!seasonCData.rounds.some((round) => round.myScore !== null) && (
                                <p className="text-sm text-amber-200/90">
                                  현재 업로드된 C 시즌 응답에서 본인 데이터가 없어 빨간
                                  점은 표시되지 않습니다.
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-6 text-white/70">
                              시즌 C 데이터가 없습니다.
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {selectedRoundDetail && (
                        <Card className="rounded-[2rem] border border-white/10 bg-white/5 text-white shadow-2xl">
                          <CardHeader>
                            <CardTitle className="text-2xl">
                              C시즌 {selectedRoundDetail.round}회 상세 통계
                            </CardTitle>
                            <CardDescription className="text-white/55">
                              내 점수와 분포, 반별 통계, 오답률 탑 5, 문항별 선지 선택률을
                              확인할 수 있습니다.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <p className="text-sm text-white/45">내 점수</p>
                                <p className="mt-2 text-3xl font-semibold text-red-300">
                                  {selectedRoundDetail.myScore ?? "-"}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <p className="text-sm text-white/45">평균 점수</p>
                                <p className="mt-2 text-3xl font-semibold">
                                  {selectedRoundDetail.averageScore}
                                </p>
                              </div>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                              <p className="mb-4 text-sm text-white/55">점수 분포 (5점 단위)</p>
                              <div className="grid grid-cols-5 gap-3 sm:grid-cols-11">
                                {selectedRoundDetail.histogram.map((bin) => {
                                  const maxCount = Math.max(
                                    ...selectedRoundDetail.histogram.map((item) => item.count),
                                    1
                                  );
                                  const height = Math.max((bin.count / maxCount) * 100, 4);

                                  return (
                                    <div key={bin.label} className="flex flex-col items-center gap-2">
                                      <div className="text-xs text-white/50">{bin.count}</div>
                                      <div className="flex h-28 items-end">
                                        <div
                                          className="w-4 rounded-t bg-sky-300/70"
                                          style={{ height: `${height}%` }}
                                        />
                                      </div>
                                      <div className="text-[11px] text-white/45">{bin.label}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="grid gap-4 xl:grid-cols-2">
                              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                                <div className="border-b border-white/10 px-4 py-3">
                                  <p className="text-sm text-white/55">반별 통계</p>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full min-w-[440px] text-sm">
                                    <thead className="text-white/55">
                                      <tr>
                                        <th className="px-4 py-3 text-left">반</th>
                                        <th className="px-4 py-3 text-left">인원</th>
                                        <th className="px-4 py-3 text-left">평균</th>
                                        <th className="px-4 py-3 text-left">중앙값</th>
                                        <th className="px-4 py-3 text-left">표준편차</th>
                                        <th className="px-4 py-3 text-left">최고</th>
                                        <th className="px-4 py-3 text-left">최저</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {sortClassStats(selectedRoundDetail.classStats).map((row) => (
                                        <tr key={row.className} className="border-t border-white/10">
                                          <td className="px-4 py-3">{row.className}</td>
                                          <td className="px-4 py-3">{row.count}</td>
                                          <td className="px-4 py-3">{row.average}</td>
                                          <td className="px-4 py-3">{row.median}</td>
                                          <td className="px-4 py-3">{row.stdDev}</td>
                                          <td className="px-4 py-3">{row.max}</td>
                                          <td className="px-4 py-3">{row.min}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                                <div className="border-b border-white/10 px-4 py-3">
                                  <p className="text-sm text-white/55">
                                    오답률 탑 5 (정답/내답 포함)
                                  </p>
                                </div>
                                <div className="max-h-[300px] overflow-auto">
                                  <table className="w-full min-w-[620px] text-sm">
                                    <thead className="sticky top-0 bg-[#0b0d12] text-white/55">
                                      <tr>
                                        <th className="px-3 py-3 text-left">문항</th>
                                        <th className="px-3 py-3 text-left">오답률</th>
                                        <th className="px-3 py-3 text-left">정답</th>
                                        <th className="px-3 py-3 text-left">내답</th>
                                        <th className="px-3 py-3 text-left">1</th>
                                        <th className="px-3 py-3 text-left">2</th>
                                        <th className="px-3 py-3 text-left">3</th>
                                        <th className="px-3 py-3 text-left">4</th>
                                        <th className="px-3 py-3 text-left">5</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {selectedRoundTopWrongQuestions.map((question) => (
                                        <tr
                                          key={`c-top-${question.question}`}
                                          className={`border-t border-white/10 ${
                                            question.isWrong ? "bg-red-500/10" : ""
                                          }`}
                                        >
                                          <td className="px-3 py-3">{question.question}번</td>
                                          <td className="px-3 py-3 font-semibold text-rose-200">
                                            {question.wrongRate}%
                                          </td>
                                          <td className="px-3 py-3 text-emerald-300">
                                            {question.correctChoice ?? "-"}
                                          </td>
                                          <td
                                            className={`px-3 py-3 ${
                                              question.isWrong
                                                ? "font-semibold text-red-300"
                                                : "text-white"
                                            }`}
                                          >
                                            {question.myChoice ?? "-"}
                                          </td>
                                          {question.choices.map((choice) => (
                                            <td
                                              key={`c-top-${question.question}-${choice.choice}`}
                                              className={`px-3 py-3 ${
                                                choice.choice === question.correctChoice
                                                  ? "font-semibold text-emerald-300"
                                                  : ""
                                              }`}
                                            >
                                              {choice.rate}%
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                      {selectedRoundTopWrongQuestions.length === 0 && (
                                        <tr>
                                          <td
                                            colSpan={9}
                                            className="px-3 py-6 text-center text-white/55"
                                          >
                                            표시할 오답률 데이터가 없습니다.
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>

                            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                              <div className="border-b border-white/10 px-4 py-3">
                                <p className="text-sm text-white/55">
                                  문항별 선지 선택률 (정답/내답 포함, 스크롤 가능)
                                </p>
                              </div>
                              <div className="max-h-[300px] overflow-auto">
                                <table className="w-full min-w-[560px] text-sm">
                                  <thead className="sticky top-0 bg-[#0b0d12] text-white/55">
                                    <tr>
                                      <th className="px-3 py-3 text-left">문항</th>
                                      <th className="px-3 py-3 text-left">정답</th>
                                      <th className="px-3 py-3 text-left">내답</th>
                                      <th className="px-3 py-3 text-left">1</th>
                                      <th className="px-3 py-3 text-left">2</th>
                                      <th className="px-3 py-3 text-left">3</th>
                                      <th className="px-3 py-3 text-left">4</th>
                                      <th className="px-3 py-3 text-left">5</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {selectedRoundDetail.questionStats.map((question) => (
                                      <tr
                                        key={question.question}
                                        className={`border-t border-white/10 ${
                                          question.isWrong ? "bg-red-500/10" : ""
                                        }`}
                                      >
                                        <td className="px-3 py-3">{question.question}번</td>
                                        <td className="px-3 py-3 text-emerald-300">
                                          {question.correctChoice ?? "-"}
                                        </td>
                                        <td
                                          className={`px-3 py-3 ${
                                            question.isWrong
                                              ? "font-semibold text-red-300"
                                              : "text-white"
                                          }`}
                                        >
                                          {question.myChoice ?? "-"}
                                        </td>
                                        {question.choices.map((choice) => (
                                          <td
                                            key={choice.choice}
                                            className={`px-3 py-3 ${
                                              choice.choice === question.correctChoice
                                                ? "font-semibold text-emerald-300"
                                                : ""
                                            }`}
                                          >
                                            {choice.rate}%
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            <p className="text-xs text-white/50">
                              빨간 줄은 내 오답 문항, 초록색은 정답 번호입니다.
                            </p>
                            <div className="rounded-xl border border-amber-300/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                              통계/점수 문의는 카카오톡 아이디 `jwlee2670` 또는
                              `010-3676-2670`으로 연락 주시면 빠르게 확인 후
                              안내드리겠습니다.
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {selectedRoundDetail &&
                        renderSeasonNoteCard(`C시즌 ${selectedRoundDetail.round}회 시험 셀프 피드백`)}

                      <div className="flex flex-wrap gap-3">
                        <Button
                          className="rounded-2xl bg-white text-black hover:bg-white/90"
                          onClick={() => setSelectedSeason(null)}
                        >
                          시즌 다시 선택
                        </Button>
                        <Button
                          variant="secondary"
                          className="rounded-2xl bg-white/10 text-white hover:bg-white/20"
                          onClick={handleReturnToPortalHome}
                        >
                          처음 화면으로
                        </Button>
                      </div>
                    </div>
                  ) : selectedSeason === "N" ? (
                    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
                      <div className="self-start">
                        <Button
                          variant="secondary"
                          className="rounded-2xl bg-white/10 text-white hover:bg-white/20"
                          onClick={() => setSelectedSeason(null)}
                        >
                          시즌 선택으로 돌아가기
                        </Button>
                      </div>
                      <Card className="rounded-[2rem] border border-white/10 bg-white/5 text-white shadow-2xl">
                        <CardHeader>
                          <CardTitle className="text-3xl">N 시즌 (1~12회)</CardTitle>
                          <CardDescription className="text-white/55">
                            회차를 누르면 해당 회차 통계를 확인할 수 있습니다. 회색
                            막대는 평균, 빨간 점과 선은 내 점수입니다.
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {seasonNLoading ? (
                            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-6 text-white/70">
                              시즌 N 데이터를 불러오는 중...
                            </div>
                          ) : seasonNError ? (
                            <div className="rounded-[1.5rem] border border-red-400/20 bg-red-500/10 p-6 text-red-200">
                              {seasonNError}
                            </div>
                          ) : seasonNData ? (
                            <div className="space-y-6">
                              <div className="relative overflow-x-auto">
                                <div className="relative h-[390px] min-w-[780px] rounded-[1.5rem] border border-white/10 bg-black/20 px-6 py-6">
                                  <div className="pointer-events-none absolute inset-x-6 top-6 bottom-14">
                                    <div className="absolute inset-x-0 top-0 border-t border-white/10" />
                                    <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-white/10" />
                                    <div className="absolute inset-x-0 bottom-0 border-t border-white/20" />
                                    <div className="absolute inset-y-0 left-0 border-l border-white/20" />
                                  </div>

                                  <div className="absolute left-0 top-5 w-10 text-right text-xs text-white/50 sm:w-12">
                                    50
                                  </div>
                                  <div className="absolute left-0 top-[48%] w-10 -translate-y-1/2 text-right text-xs text-white/50 sm:w-12">
                                    25
                                  </div>
                                  <div className="absolute left-0 bottom-11 w-10 text-right text-xs text-white/50 sm:w-12">
                                    0
                                  </div>

                                  {nPlotPoints.length > 0 && (
                                    <svg
                                      viewBox="0 0 100 100"
                                      className="pointer-events-none absolute left-12 right-6 top-6 bottom-14 h-[calc(100%-80px)] w-[calc(100%-72px)]"
                                      preserveAspectRatio="none"
                                    >
                                      {nSmoothLinePath && (
                                        <path
                                          d={nSmoothLinePath}
                                          fill="none"
                                          stroke={SCORE_LINE_COLOR}
                                          strokeWidth="1.6"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeOpacity="0.92"
                                        />
                                      )}
                                      {nPlotPoints.map((point, index) => (
                                        <g key={`n-point-${index}`}>
                                          <circle
                                            cx={point.x}
                                            cy={point.y}
                                            fill={SCORE_POINT_COLOR}
                                            fillOpacity="0.28"
                                            r="1.9"
                                          />
                                          <circle
                                            cx={point.x}
                                            cy={point.y}
                                            fill={SCORE_POINT_COLOR}
                                            stroke={SCORE_POINT_RING}
                                            strokeWidth="0.42"
                                            r="1.32"
                                          />
                                        </g>
                                      ))}
                                    </svg>
                                  )}

                                  <div className="absolute left-12 right-6 top-6 bottom-14 grid grid-cols-12 gap-2">
                                    {seasonNData.rounds.map((round) => {
                                      const averageHeight = `${round.averageScore * 2}%`;
                                      const isSelected = selectedNRound === round.round;
                                      return (
                                        <button
                                          key={round.round}
                                          type="button"
                                          onClick={() => setSelectedNRound(round.round)}
                                          className={`relative flex h-full items-end justify-center transition ${
                                            isSelected ? "scale-[1.02]" : "opacity-90 hover:opacity-100"
                                          }`}
                                        >
                                          <div
                                            className={`w-7 rounded-t-xl bg-white/30 transition sm:w-8 ${
                                              isSelected ? "ring-2 ring-sky-300/60" : ""
                                            }`}
                                            style={{ height: averageHeight }}
                                          />
                                        </button>
                                      );
                                    })}
                                  </div>

                                  <div className="absolute left-12 right-6 bottom-4 grid grid-cols-12 gap-2">
                                    {seasonNData.rounds.map((round) => (
                                      <button
                                        key={`n-label-${round.round}`}
                                        type="button"
                                        onClick={() => setSelectedNRound(round.round)}
                                        className={`rounded-md py-1 text-center transition ${
                                          selectedNRound === round.round
                                            ? "bg-white/10"
                                            : "hover:bg-white/5"
                                        }`}
                                      >
                                        <p className="text-sm font-medium text-white/90">
                                          {round.round}회
                                        </p>
                                        <p className="text-[11px] text-white/45">
                                          평균 {round.averageScore}
                                        </p>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {!seasonNData.rounds.some((round) => round.myScore !== null) && (
                                <p className="text-sm text-amber-200/90">
                                  현재 업로드된 N 시즌 응답에서 본인 데이터가 없어 빨간
                                  점은 표시되지 않습니다.
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-6 text-white/70">
                              시즌 N 데이터가 없습니다.
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {selectedNRoundDetail && (
                        <Card className="rounded-[2rem] border border-white/10 bg-white/5 text-white shadow-2xl">
                          <CardHeader>
                            <CardTitle className="text-2xl">
                              N시즌 {selectedNRoundDetail.round}회 상세 통계
                            </CardTitle>
                            <CardDescription className="text-white/55">
                              내 점수, 비교(표준점수/컷), 반별 통계, 오답률 탑 5,
                              문항별 선지 선택률 확인이 가능합니다.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <p className="text-sm text-white/45">내 점수</p>
                                <p className="mt-2 text-3xl font-semibold text-red-300">
                                  {selectedNRoundDetail.myScore ?? "-"}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <p className="text-sm text-white/45">평균 점수</p>
                                <p className="mt-2 text-3xl font-semibold">
                                  {selectedNRoundDetail.averageScore}
                                </p>
                              </div>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                              <p className="mb-3 text-sm text-white/55">비교</p>
                              <div className="grid gap-3 sm:grid-cols-4">
                                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                                  <p className="text-xs text-white/45">내 표준점수</p>
                                  <p className="mt-1 text-2xl font-semibold text-sky-200">
                                    {selectedNRoundDetail.myStdScore ?? "-"}
                                  </p>
                                </div>
                                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                                  <p className="text-xs text-white/45">1컷</p>
                                  <p className="mt-1 text-xl font-semibold">
                                    {selectedNRoundDetail.cut1 ?? "-"}
                                  </p>
                                </div>
                                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                                  <p className="text-xs text-white/45">2컷</p>
                                  <p className="mt-1 text-xl font-semibold">
                                    {selectedNRoundDetail.cut2 ?? "-"}
                                  </p>
                                </div>
                                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                                  <p className="text-xs text-white/45">3컷</p>
                                  <p className="mt-1 text-xl font-semibold">
                                    {selectedNRoundDetail.cut3 ?? "-"}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                              <p className="mb-4 text-sm text-white/55">점수 분포 (10점 단위)</p>
                              <div className="grid grid-cols-5 gap-3 sm:grid-cols-11">
                                {selectedNRoundDetail.histogram.map((bin) => {
                                  const maxCount = Math.max(
                                    ...selectedNRoundDetail.histogram.map((item) => item.count),
                                    1
                                  );
                                  const height = Math.max((bin.count / maxCount) * 100, 4);

                                  return (
                                    <div key={bin.label} className="flex flex-col items-center gap-2">
                                      <div className="text-xs text-white/50">{bin.count}</div>
                                      <div className="flex h-28 items-end">
                                        <div
                                          className="w-4 rounded-t bg-sky-300/70"
                                          style={{ height: `${height}%` }}
                                        />
                                      </div>
                                      <div className="text-[11px] text-white/45">{bin.label}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="grid gap-4 xl:grid-cols-2">
                              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                                <div className="border-b border-white/10 px-4 py-3">
                                  <p className="text-sm text-white/55">반별 통계</p>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full min-w-[440px] text-sm">
                                    <thead className="text-white/55">
                                      <tr>
                                        <th className="px-4 py-3 text-left">반</th>
                                        <th className="px-4 py-3 text-left">인원</th>
                                        <th className="px-4 py-3 text-left">평균</th>
                                        <th className="px-4 py-3 text-left">중앙값</th>
                                        <th className="px-4 py-3 text-left">표준편차</th>
                                        <th className="px-4 py-3 text-left">최고</th>
                                        <th className="px-4 py-3 text-left">최저</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {sortClassStats(selectedNRoundDetail.classStats).map((row) => (
                                        <tr key={row.className} className="border-t border-white/10">
                                          <td className="px-4 py-3">{row.className}</td>
                                          <td className="px-4 py-3">{row.count}</td>
                                          <td className="px-4 py-3">{row.average}</td>
                                          <td className="px-4 py-3">{row.median}</td>
                                          <td className="px-4 py-3">{row.stdDev}</td>
                                          <td className="px-4 py-3">{row.max}</td>
                                          <td className="px-4 py-3">{row.min}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                                <div className="border-b border-white/10 px-4 py-3">
                                  <p className="text-sm text-white/55">
                                    오답률 탑 5 (정답/내답 포함)
                                  </p>
                                </div>
                                <div className="max-h-[300px] overflow-auto">
                                  <table className="w-full min-w-[620px] text-sm">
                                    <thead className="sticky top-0 bg-[#0b0d12] text-white/55">
                                      <tr>
                                        <th className="px-3 py-3 text-left">문항</th>
                                        <th className="px-3 py-3 text-left">오답률</th>
                                        <th className="px-3 py-3 text-left">정답</th>
                                        <th className="px-3 py-3 text-left">내답</th>
                                        <th className="px-3 py-3 text-left">1</th>
                                        <th className="px-3 py-3 text-left">2</th>
                                        <th className="px-3 py-3 text-left">3</th>
                                        <th className="px-3 py-3 text-left">4</th>
                                        <th className="px-3 py-3 text-left">5</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {selectedNRoundTopWrongQuestions.map((question) => (
                                        <tr
                                          key={`n-top-${question.question}`}
                                          className={`border-t border-white/10 ${
                                            question.isWrong ? "bg-red-500/10" : ""
                                          }`}
                                        >
                                          <td className="px-3 py-3">{question.question}번</td>
                                          <td className="px-3 py-3 font-semibold text-rose-200">
                                            {question.wrongRate}%
                                          </td>
                                          <td className="px-3 py-3 text-emerald-300">
                                            {question.correctChoice ?? "-"}
                                          </td>
                                          <td
                                            className={`px-3 py-3 ${
                                              question.isWrong
                                                ? "font-semibold text-red-300"
                                                : "text-white"
                                            }`}
                                          >
                                            {question.myChoice ?? "-"}
                                          </td>
                                          {question.choices.map((choice) => (
                                            <td
                                              key={`n-top-${question.question}-${choice.choice}`}
                                              className={`px-3 py-3 ${
                                                choice.choice === question.correctChoice
                                                  ? "font-semibold text-emerald-300"
                                                  : ""
                                              }`}
                                            >
                                              {choice.rate}%
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                      {selectedNRoundTopWrongQuestions.length === 0 && (
                                        <tr>
                                          <td
                                            colSpan={9}
                                            className="px-3 py-6 text-center text-white/55"
                                          >
                                            표시할 오답률 데이터가 없습니다.
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>

                            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                              <div className="border-b border-white/10 px-4 py-3">
                                <p className="text-sm text-white/55">
                                  문항별 선지 선택률 (정답/내답 포함, 스크롤 가능)
                                </p>
                              </div>
                              <div className="max-h-[300px] overflow-auto">
                                <table className="w-full min-w-[560px] text-sm">
                                  <thead className="sticky top-0 bg-[#0b0d12] text-white/55">
                                    <tr>
                                      <th className="px-3 py-3 text-left">문항</th>
                                      <th className="px-3 py-3 text-left">정답</th>
                                      <th className="px-3 py-3 text-left">내답</th>
                                      <th className="px-3 py-3 text-left">1</th>
                                      <th className="px-3 py-3 text-left">2</th>
                                      <th className="px-3 py-3 text-left">3</th>
                                      <th className="px-3 py-3 text-left">4</th>
                                      <th className="px-3 py-3 text-left">5</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {selectedNRoundDetail.questionStats.map((question) => (
                                      <tr
                                        key={question.question}
                                        className={`border-t border-white/10 ${
                                          question.isWrong ? "bg-red-500/10" : ""
                                        }`}
                                      >
                                        <td className="px-3 py-3">{question.question}번</td>
                                        <td className="px-3 py-3 text-emerald-300">
                                          {question.correctChoice ?? "-"}
                                        </td>
                                        <td
                                          className={`px-3 py-3 ${
                                            question.isWrong
                                              ? "font-semibold text-red-300"
                                              : "text-white"
                                          }`}
                                        >
                                          {question.myChoice ?? "-"}
                                        </td>
                                        {question.choices.map((choice) => (
                                          <td
                                            key={choice.choice}
                                            className={`px-3 py-3 ${
                                              choice.choice === question.correctChoice
                                                ? "font-semibold text-emerald-300"
                                                : ""
                                            }`}
                                          >
                                            {choice.rate}%
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            <p className="text-xs text-white/50">
                              빨간 줄은 내 오답 문항, 초록색은 정답 번호입니다.
                            </p>
                            <div className="rounded-xl border border-amber-300/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                              통계/점수 문의는 카카오톡 아이디 `jwlee2670` 또는
                              `010-3676-2670`으로 연락 주시면 빠르게 확인 후
                              안내드리겠습니다.
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {selectedNRoundDetail &&
                        renderSeasonNoteCard(`N시즌 ${selectedNRoundDetail.round}회 시험 셀프 피드백`)}

                      <div className="flex flex-wrap gap-3">
                        <Button
                          className="rounded-2xl bg-white text-black hover:bg-white/90"
                          onClick={() => setSelectedSeason(null)}
                        >
                          시즌 다시 선택
                        </Button>
                        <Button
                          variant="secondary"
                          className="rounded-2xl bg-white/10 text-white hover:bg-white/20"
                          onClick={handleReturnToPortalHome}
                        >
                          처음 화면으로
                        </Button>
                      </div>
                    </div>
                  ) : selectedPremiumSeason ? (
                    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
                      <div className="self-start">
                        <Button
                          variant="secondary"
                          className="rounded-2xl bg-white/10 text-white hover:bg-white/20"
                          onClick={() => setSelectedSeason(null)}
                        >
                          시즌 선택으로 돌아가기
                        </Button>
                      </div>
                      <Card className="rounded-[2rem] border border-white/10 bg-white/5 text-white shadow-2xl">
                        <CardHeader>
                          <CardTitle className="text-3xl">{selectedPremiumMeta?.title}</CardTitle>
                          <CardDescription className="text-white/55">
                            3월, 4월, 5월, 7월, 8월, 9월, 10월, 11월 {selectedPremiumMeta?.shortTitle} 물리학 II 통계를 확인할 수 있습니다.
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {premiumLoading ? (
                            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-6 text-white/70">
                              {selectedPremiumMeta?.title} 데이터를 불러오는 중...
                            </div>
                          ) : premiumError ? (
                            <div className="rounded-[1.5rem] border border-red-400/20 bg-red-500/10 p-6 text-red-200">
                              {premiumError}
                            </div>
                          ) : activePremiumData ? (
                            <div className="space-y-6">
                              <div className="relative overflow-x-auto">
                                <div className="relative h-[390px] min-w-[760px] rounded-[1.5rem] border border-white/10 bg-black/20 px-6 py-6">
                                  <div className="pointer-events-none absolute inset-x-6 top-6 bottom-14">
                                    <div className="absolute inset-x-0 top-0 border-t border-white/10" />
                                    <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-white/10" />
                                    <div className="absolute inset-x-0 bottom-0 border-t border-white/20" />
                                    <div className="absolute inset-y-0 left-0 border-l border-white/20" />
                                  </div>

                                  <div className="absolute left-0 top-5 w-10 text-right text-xs text-white/50 sm:w-12">
                                    50
                                  </div>
                                  <div className="absolute left-0 top-[48%] w-10 -translate-y-1/2 text-right text-xs text-white/50 sm:w-12">
                                    25
                                  </div>
                                  <div className="absolute left-0 bottom-11 w-10 text-right text-xs text-white/50 sm:w-12">
                                    0
                                  </div>

                                  {premiumPlotPoints.length > 0 && (
                                    <svg
                                      viewBox="0 0 100 100"
                                      className="pointer-events-none absolute left-12 right-6 top-6 bottom-14 h-[calc(100%-80px)] w-[calc(100%-72px)]"
                                      preserveAspectRatio="none"
                                    >
                                      {premiumSmoothLinePath && (
                                        <path
                                          d={premiumSmoothLinePath}
                                          fill="none"
                                          stroke={SCORE_LINE_COLOR}
                                          strokeWidth="1.6"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeOpacity="0.92"
                                        />
                                      )}
                                      {premiumPlotPoints.map((point, index) => (
                                        <g key={`premium-point-${index}`}>
                                          <circle
                                            cx={point.x}
                                            cy={point.y}
                                            fill={SCORE_POINT_COLOR}
                                            fillOpacity="0.28"
                                            r="1.9"
                                          />
                                          <circle
                                            cx={point.x}
                                            cy={point.y}
                                            fill={SCORE_POINT_COLOR}
                                            stroke={SCORE_POINT_RING}
                                            strokeWidth="0.42"
                                            r="1.32"
                                          />
                                        </g>
                                      ))}
                                    </svg>
                                  )}

                                  <div className="absolute left-12 right-6 top-6 bottom-14 grid grid-cols-8 gap-2">
                                    {activePremiumData.rounds.map((round) => {
                                      const averageHeight = `${round.averageScore * 2}%`;
                                      const isSelected = selectedPremiumRound === round.round;
                                      return (
                                        <button
                                          key={round.round}
                                          type="button"
                                          onClick={() => setSelectedPremiumRound(round.round)}
                                          className={`relative flex h-full items-end justify-center transition ${
                                            isSelected ? "scale-[1.02]" : "opacity-90 hover:opacity-100"
                                          }`}
                                        >
                                          <div
                                            className={`w-8 rounded-t-xl bg-white/30 transition sm:w-10 ${
                                              isSelected ? "ring-2 ring-sky-300/60" : ""
                                            }`}
                                            style={{ height: averageHeight }}
                                          />
                                        </button>
                                      );
                                    })}
                                  </div>

                                  <div className="absolute left-12 right-6 bottom-4 grid grid-cols-8 gap-2">
                                    {activePremiumData.rounds.map((round) => (
                                      <button
                                        key={`premium-label-${round.round}`}
                                        type="button"
                                        onClick={() => setSelectedPremiumRound(round.round)}
                                        className={`rounded-md py-1 text-center transition ${
                                          selectedPremiumRound === round.round
                                            ? "bg-white/10"
                                            : "hover:bg-white/5"
                                        }`}
                                      >
                                        <p className="text-sm font-medium text-white/90">
                                          {round.label}
                                        </p>
                                        <p className="text-[11px] text-white/45">
                                          평균 {round.averageScore}
                                        </p>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {!activePremiumData.rounds.some((round) => round.myScore !== null) && (
                                <p className="text-sm text-amber-200/90">
                                  등록된 {selectedPremiumMeta?.title} 점수가 없어 빨간 점은 표시되지 않습니다.
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-6 text-white/70">
                              {selectedPremiumMeta?.title} 데이터가 없습니다.
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {selectedPremiumRoundDetail && (
                        <Card className="rounded-[2rem] border border-white/10 bg-white/5 text-white shadow-2xl">
                          <CardHeader>
                            <CardTitle className="text-2xl">
                              {selectedPremiumMeta?.title} {selectedPremiumRoundDetail.label} 상세 통계
                            </CardTitle>
                            <CardDescription className="text-white/55">
                              원점수와 반별 통계만 확인할 수 있습니다.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <p className="text-sm text-white/45">내 원점수</p>
                                <p className="mt-2 text-3xl font-semibold text-red-300">
                                  {selectedPremiumRoundDetail.myScore ?? "-"}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <p className="text-sm text-white/45">평균 점수</p>
                                <p className="mt-2 text-3xl font-semibold">
                                  {selectedPremiumRoundDetail.averageScore}
                                </p>
                              </div>
                            </div>

                            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                              <div className="border-b border-white/10 px-4 py-3">
                                <p className="text-sm text-white/55">반별 통계</p>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full min-w-[440px] text-sm">
                                  <thead className="text-white/55">
                                    <tr>
                                      <th className="px-4 py-3 text-left">반</th>
                                      <th className="px-4 py-3 text-left">인원</th>
                                      <th className="px-4 py-3 text-left">평균</th>
                                      <th className="px-4 py-3 text-left">중앙값</th>
                                      <th className="px-4 py-3 text-left">표준편차</th>
                                      <th className="px-4 py-3 text-left">최고</th>
                                      <th className="px-4 py-3 text-left">최저</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sortClassStats(selectedPremiumRoundDetail.classStats).map((row) => (
                                      <tr key={row.className} className="border-t border-white/10">
                                        <td className="px-4 py-3">{row.className}</td>
                                        <td className="px-4 py-3">{row.count}</td>
                                        <td className="px-4 py-3">{row.average}</td>
                                        <td className="px-4 py-3">{row.median}</td>
                                        <td className="px-4 py-3">{row.stdDev}</td>
                                        <td className="px-4 py-3">{row.max}</td>
                                        <td className="px-4 py-3">{row.min}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            <div className="rounded-xl border border-amber-300/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                              통계/점수 문의는 카카오톡 아이디 `jwlee2670` 또는 `010-3676-2670`으로 연락 주시면 빠르게 확인 후 안내드리겠습니다.
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {selectedPremiumRoundDetail &&
                        renderSeasonNoteCard(
                          `${selectedPremiumMeta?.title} ${selectedPremiumRoundDetail.label} 셀프 피드백`
                        )}

                      <div className="flex flex-wrap gap-3">
                        <Button
                          className="rounded-2xl bg-white text-black hover:bg-white/90"
                          onClick={() => setSelectedSeason(null)}
                        >
                          시즌 다시 선택
                        </Button>
                        <Button
                          variant="secondary"
                          className="rounded-2xl bg-white/10 text-white hover:bg-white/20"
                          onClick={handleReturnToPortalHome}
                        >
                          처음 화면으로
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mx-auto w-full max-w-3xl">
                      <div className="mb-3">
                        <Button
                          variant="secondary"
                          className="rounded-2xl bg-white/10 text-white hover:bg-white/20"
                          onClick={() => setSelectedSeason(null)}
                        >
                          시즌 선택으로 돌아가기
                        </Button>
                      </div>
                      <Card className="rounded-[2rem] border border-white/10 bg-white/5 text-white shadow-2xl">
                        <CardHeader>
                          <CardTitle className="text-3xl">{selectedSeason} 시즌</CardTitle>
                          <CardDescription className="text-white/55">
                            {selectedSeason === "M"
                              ? "M 시즌은 개강 전 입니다."
                              : selectedSeason === "N"
                                ? "N 시즌은 현재 업데이트 예정입니다."
                              : "이 시즌은 아직 연결 전입니다. 먼저 시즌 C 화면을 완성해둔 상태입니다."}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="rounded-[1.5rem] border border-dashed border-white/15 bg-black/20 p-6 text-white/70">
                            {selectedSeason === "M"
                              ? "M 시즌은 개강 전 입니다."
                              : selectedSeason === "N"
                                ? "업데이트 예정입니다. 조금만 기다려 주세요."
                              : `다음 연결 대상: /season/${selectedSeason.toLowerCase()}`}
                          </div>
                          <div className="flex flex-wrap gap-3">
                            <Button
                              className="rounded-2xl bg-white text-black hover:bg-white/90"
                              onClick={() => setSelectedSeason(null)}
                            >
                              시즌 다시 선택
                            </Button>
                            <Button
                              variant="secondary"
                              className="rounded-2xl bg-white/10 text-white hover:bg-white/20"
                              onClick={handleReturnToPortalHome}
                            >
                              처음 화면으로
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
