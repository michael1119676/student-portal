"use client";
import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogIn, GraduationCap, ArrowRight, CalendarRange } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const seasons = [
  { id: "C", title: "Season C", subtitle: "성적 조회 / 시험 결과" },
  { id: "N", title: "Season N", subtitle: "성적 추이 / 문항 분석" },
  { id: "M", title: "Season M", subtitle: "학생 대시보드" },
];

export default function SeasonPortal() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");

  const canLogin = useMemo(() => studentId.trim().length > 0 && password.trim().length > 0, [studentId, password]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canLogin) return;
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setSelectedSeason(null);
    setIsLoggedIn(false);
    setStudentId("");
    setPassword("");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 shadow-lg ring-1 ring-white/10">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-slate-300">Student Portal</p>
              <h1 className="text-2xl font-semibold tracking-tight">시즌 성적 조회 사이트</h1>
            </div>
          </div>
          {isLoggedIn && (
            <Button variant="secondary" className="rounded-2xl" onClick={handleLogout}>
              로그아웃
            </Button>
          )}
        </header>

        <AnimatePresence mode="wait">
          {!isLoggedIn ? (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.25 }}
              className="grid flex-1 items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]"
            >
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300">
                  <CalendarRange className="h-4 w-4" />
                  시즌별 성적 조회 포털
                </div>
                <div className="space-y-3">
                  <h2 className="text-4xl font-semibold leading-tight sm:text-5xl">
                    로그인 후 <span className="text-sky-300">Season C / N / M</span> 으로 이동
                  </h2>
                  <p className="max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
                    학생은 로그인 후 자신에게 필요한 시즌을 선택해 시험 결과, 성적 추이, 분석 페이지로 들어갈 수 있습니다.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  {seasons.map((season) => (
                    <Card key={season.id} className="rounded-3xl border-white/10 bg-white/5 text-slate-50 shadow-xl backdrop-blur">
                      <CardHeader>
                        <CardTitle className="text-lg">{season.title}</CardTitle>
                        <CardDescription className="text-slate-300">{season.subtitle}</CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </div>

              <Card className="rounded-[2rem] border-white/10 bg-white/5 shadow-2xl backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-2xl text-slate-50">
                    <LogIn className="h-5 w-5" />
                    학생 로그인
                  </CardTitle>
                  <CardDescription className="text-slate-300">
                    학번 또는 아이디와 비밀번호를 입력하세요.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="studentId" className="text-slate-200">아이디</Label>
                      <Input
                        id="studentId"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        placeholder="예: 2023009670"
                        className="h-12 rounded-2xl border-white/10 bg-slate-900/70 text-slate-50 placeholder:text-slate-400"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-slate-200">비밀번호</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="비밀번호 입력"
                        className="h-12 rounded-2xl border-white/10 bg-slate-900/70 text-slate-50 placeholder:text-slate-400"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={!canLogin}
                      className="h-12 w-full rounded-2xl text-base font-medium"
                    >
                      로그인
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.25 }}
              className="flex flex-1 flex-col justify-center"
            >
              {!selectedSeason ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Welcome</p>
                    <h2 className="text-4xl font-semibold">시즌을 선택하세요</h2>
                    <p className="text-slate-300">원하는 시즌으로 이동해서 성적과 분석 정보를 확인할 수 있습니다.</p>
                  </div>

                  <div className="grid gap-5 md:grid-cols-3">
                    {seasons.map((season, index) => (
                      <motion.button
                        key={season.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.08 }}
                        onClick={() => setSelectedSeason(season.id)}
                        className="group text-left"
                      >
                        <Card className="h-full rounded-[2rem] border-white/10 bg-white/5 text-slate-50 shadow-xl transition-all duration-200 group-hover:-translate-y-1 group-hover:bg-white/10">
                          <CardHeader>
                            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-400/10 text-sky-300 ring-1 ring-sky-300/20">
                              <span className="text-lg font-semibold">{season.id}</span>
                            </div>
                            <CardTitle className="flex items-center justify-between text-2xl">
                              {season.title}
                              <ArrowRight className="h-5 w-5 text-slate-300 transition-transform duration-200 group-hover:translate-x-1" />
                            </CardTitle>
                            <CardDescription className="text-base text-slate-300">
                              {season.subtitle}
                            </CardDescription>
                          </CardHeader>
                        </Card>
                      </motion.button>
                    ))}
                  </div>
                </div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto w-full max-w-3xl">
                  <Card className="rounded-[2rem] border-white/10 bg-white/5 text-slate-50 shadow-2xl">
                    <CardHeader>
                      <CardTitle className="text-3xl">Season {selectedSeason}</CardTitle>
                      <CardDescription className="text-slate-300">
                        지금은 이동 흐름만 만든 초기 버전입니다. 다음 단계에서 이 시즌 전용 성적 페이지를 연결하면 됩니다.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="rounded-3xl border border-dashed border-white/15 bg-slate-900/50 p-6 text-slate-300">
                        예시 연결 경로: <span className="font-medium text-slate-100">/season/{selectedSeason.toLowerCase()}</span>
                      </div>
                      <div className="flex gap-3">
                        <Button className="rounded-2xl" onClick={() => setSelectedSeason(null)}>
                          시즌 다시 선택
                        </Button>
                        <Button variant="secondary" className="rounded-2xl">
                          상세 페이지 연결하기
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
