"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  Instagram,
  MessageCircleMore,
  Phone,
  Search,
  Settings,
  Shield,
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
  managedStudents?: ManagedStudent[];
};

const seasons = [
  { id: "C", title: "Season C", subtitle: "시즌 C 성적 확인" },
  { id: "M", title: "Season M", subtitle: "시즌 M 성적 확인" },
  { id: "N", title: "Season N", subtitle: "시즌 N 성적 확인" },
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
    href: "#teacher",
    icon: GraduationCap,
  },
];

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
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

function getTargetUniversity(value?: string | null) {
  if (value && value in universityProfiles) {
    return value as keyof typeof universityProfiles;
  }
  return "seoul";
}

export default function PortalClient({
  mode = "student",
  initialSessionUser = null,
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

  const [selectedKorean, setSelectedKorean] = useState("언어와 매체");
  const [selectedMath, setSelectedMath] = useState("미적분");
  const [selectedScience1, setSelectedScience1] = useState("물리학 I");
  const [selectedScience2, setSelectedScience2] = useState("화학 I");
  const [targetUniversity, setTargetUniversity] =
    useState<keyof typeof universityProfiles>("seoul");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const [adminStep, setAdminStep] = useState<"home" | "search" | "scores">("home");
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<ManagedStudent | null>(null);
  const [isLoadingStudent, setIsLoadingStudent] = useState(false);

  const isLoggedIn = !!sessionUser;
  const visibleUser = isAdminMode ? selectedStudent : sessionUser;
  const canShowStudentPortal = isAdminMode ? !!sessionUser && !!selectedStudent : isLoggedIn;
  const profile = universityProfiles[targetUniversity];

  const canLogin = useMemo(() => {
    return (
      studentName.trim().length > 0 &&
      normalizePhone(phone).length >= 8 &&
      /^\d{4}$/.test(pin)
    );
  }, [studentName, phone, pin]);

  const filteredStudents = useMemo(() => {
    const keyword = studentSearch.trim().toLowerCase();
    if (!keyword) return managedStudents;

    return managedStudents.filter((student) =>
      student.name.toLowerCase().includes(keyword)
    );
  }, [managedStudents, studentSearch]);

  function applyProfile(profileData?: StudentProfile | null) {
    setSelectedKorean(profileData?.korean_subject || "언어와 매체");
    setSelectedMath(profileData?.math_subject || "미적분");
    setSelectedScience1(profileData?.science_1 || "물리학 I");
    setSelectedScience2(profileData?.science_2 || "화학 I");
    setTargetUniversity(getTargetUniversity(profileData?.target_university));
  }

  useEffect(() => {
    if (isAdminMode) {
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
  }, [isAdminMode]);

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
    applyProfile(data.profile as StudentProfile | undefined);
  };

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
    setIsEditingProfile(false);
    setSaveMessage("");
    window.location.href = "/";
  };

  async function handleSaveProfile() {
    setSaveMessage("");

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

  async function handleChangePin() {
    setSaveMessage("");

    const res = await fetch("/api/change-pin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        newPin,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setSaveMessage(data.message || "비밀번호 변경 실패");
      return;
    }

    setSaveMessage("비밀번호 변경 완료");
    setNewPin("");
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

    setSelectedStudent(student);
    applyProfile(data.profile as StudentProfile | undefined);
    setSelectedSeason(null);
    setAdminStep("search");
    setIsLoadingStudent(false);
  }

  function closeProfileModal() {
    setIsEditingProfile(false);
    setSaveMessage("");
    setNewPin("");
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
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.15),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_20%)]" />
        <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
          <header className="flex items-center justify-between py-2">
            {!canShowStudentPortal ? (
              <div className="text-sm uppercase tracking-[0.28em] text-white/45">
                {isAdminMode ? "Admin Portal" : "Student Portal"}
              </div>
            ) : (
              <div className="flex items-center gap-4 rounded-[1.5rem] border border-white/10 bg-white/5 px-3 py-3 backdrop-blur">
                <Image
                  src={profile.image}
                  alt={profile.label}
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-2xl bg-white p-2 object-contain"
                />
                <div>
                  <p className="text-sm text-white/45">
                    {profile.label} 지망
                    {isAdminMode && sessionUser ? ` · 관리자 로그인: ${sessionUser.name}` : ""}
                  </p>
                  <p className="text-lg font-semibold">{visibleUser?.name}</p>
                  <p className="text-sm text-white/55">
                    선택과목: {selectedKorean} / {selectedMath} / {selectedScience1},{" "}
                    {selectedScience2}
                  </p>
                </div>
              </div>
            )}

            {isLoggedIn && (
              <div className="flex items-center gap-3">
                {isAdminMode && selectedStudent && (
                  <Button
                    variant="secondary"
                    className="rounded-2xl bg-white/10 text-white hover:bg-white/20"
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
                    className="rounded-2xl bg-white/10 text-white hover:bg-white/20"
                    onClick={() => setIsEditingProfile(true)}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    {isAdminMode ? "학생 정보 수정" : "학생 정보 수정"}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  className="rounded-2xl bg-white/10 text-white hover:bg-white/20"
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

                    <div className="mx-auto grid w-full max-w-4xl gap-5 md:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setAdminStep("search")}
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
                        onClick={() => setAdminStep("scores")}
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
                              점수 입력 전용 화면은 다음 단계에서 연결할 수 있도록
                              분리해 두었습니다.
                            </CardDescription>
                          </CardHeader>
                        </Card>
                      </button>
                    </div>
                  </div>
                ) : adminStep === "scores" ? (
                  <div className="mx-auto w-full max-w-3xl">
                    <Card className="rounded-[2rem] border border-white/10 bg-white/5 text-white shadow-2xl">
                      <CardHeader>
                        <CardTitle className="text-3xl">점수 입력하기</CardTitle>
                        <CardDescription className="text-white/55">
                          점수 입력 화면은 분리해 두었습니다. 지금은 학생 검색 흐름을
                          우선 바로 사용할 수 있습니다.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="rounded-[1.5rem] border border-dashed border-white/15 bg-black/20 p-6 text-white/70">
                          다음 단계로 점수 입력 폼과 저장 로직을 여기에 연결하면
                          됩니다.
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <Button
                            className="rounded-2xl bg-white text-black hover:bg-white/90"
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
                                    {student.className ? ` · ${student.className}` : ""}
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
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
                    <Card className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-[#0b0d12] text-white shadow-2xl">
                      <CardHeader className="flex flex-row items-start justify-between space-y-0">
                        <div>
                          <CardTitle className="text-2xl">
                            {isAdminMode ? "학생 정보 수정" : "학생 정보 수정"}
                          </CardTitle>
                          <CardDescription className="mt-2 text-white/55">
                            이름과 전화번호는 고정입니다.
                            {isAdminMode
                              ? " 관리자는 학생의 선택과목 / 희망 대학을 수정하고 비밀번호를 1111로 초기화할 수 있습니다."
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

                      <CardContent className="space-y-5">
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
                              새 비밀번호 (숫자 4자리)
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

                          {!isAdminMode ? (
                            <Button
                              variant="secondary"
                              className="rounded-2xl bg-white/10 text-white hover:bg-white/20"
                              onClick={handleChangePin}
                              disabled={!/^\d{4}$/.test(newPin)}
                            >
                              비밀번호 변경
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
                          : "Season C / M / N 중 원하는 시즌을 눌러 성적 화면으로 이동할 수 있습니다."}
                      </p>
                    </div>

                    <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3">
                      {seasons.map((season, index) => (
                        <motion.button
                          key={season.id}
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.08 }}
                          onClick={() => setSelectedSeason(season.id)}
                          className="group text-left"
                        >
                          <Card className="h-full rounded-[2rem] border border-white/10 bg-white/5 text-white shadow-2xl transition-all duration-200 group-hover:-translate-y-1 group-hover:bg-white/10">
                            <CardHeader>
                              <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-[1.2rem] bg-sky-400/10 text-xl font-semibold text-sky-300 ring-1 ring-sky-300/20">
                                {season.id}
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
                  <div className="mx-auto w-full max-w-3xl">
                    <Card className="rounded-[2rem] border border-white/10 bg-white/5 text-white shadow-2xl">
                      <CardHeader>
                        <CardTitle className="text-3xl">Season {selectedSeason}</CardTitle>
                        <CardDescription className="text-white/55">
                          여기에 각 시즌별 시험 목록, 성적 상세, 성적 추이 화면을
                          연결하면 됩니다.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="rounded-[1.5rem] border border-dashed border-white/15 bg-black/20 p-6 text-white/70">
                          예시 이동 경로:{" "}
                          <span className="font-medium text-white">
                            /season/{selectedSeason.toLowerCase()}
                          </span>
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
                            onClick={handleLogout}
                          >
                            처음 화면으로
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
