"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";

const teacherCareer = [
  "서울과학고등학교 졸업",
  "가톨릭대학교 의예과 25학번 정시 입학",
  "연세대 의대 정시 합격",
  "23수능 물리1, 24~26수능 물리2 만점",
  "2025 수강생 60명",
];

type PreviewItem = {
  title: string;
  src: string;
};

const reviewPreviews: PreviewItem[] = [
  {
    title: "수강 후기 1",
    src: "/teacher/review-preview-1.png",
  },
  {
    title: "수강 후기 2",
    src: "/teacher/review-preview-2.png",
  },
];

const notePreviews: PreviewItem[] = [
  {
    title: "필기본 예시 1",
    src: "/teacher/note-preview-1.png",
  },
  {
    title: "필기본 예시 2",
    src: "/teacher/note-preview-2.png",
  },
];

export default function AboutPage() {
  const [selectedPreview, setSelectedPreview] = useState<PreviewItem | null>(null);

  useEffect(() => {
    if (!selectedPreview) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedPreview(null);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = originalOverflow;
    };
  }, [selectedPreview]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(244,114,182,0.1),transparent_36%),#03050b] px-6 py-10 text-white sm:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-200/75">
              About Han Seojun T
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              한서준 T 강사 소개
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
          >
            첫 화면으로 돌아가기
          </Link>
        </div>

        <section className="grid gap-6 rounded-[2rem] border border-cyan-300/20 bg-black/30 p-6 sm:p-8 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-5">
            <p className="text-sm leading-7 text-white/70 sm:text-base">
              물리2에서 필요한 개념 정리, 실전 스킬, 손필기 풀이를 한 흐름으로 연결해
              주는 수업을 목표로 합니다.
            </p>

            <div className="grid gap-2">
              {teacherCareer.map((item) => (
                <div
                  key={item}
                  className="rounded-xl border border-white/12 bg-black/20 px-4 py-2.5 text-sm text-white/88"
                >
                  {item}
                </div>
              ))}
            </div>

            <a
              href="/teacher/review-notes.pdf"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-xl border border-cyan-200/35 bg-cyan-300/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/20"
            >
              후기/필기본 PDF 보기
            </a>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/12 bg-black/20 p-4">
              <p className="mb-3 text-sm font-semibold text-white/85">수강 후기</p>
              <div className="space-y-3">
                {reviewPreviews.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => setSelectedPreview(item)}
                    className="group block w-full overflow-hidden rounded-xl border border-white/12 bg-black/20 text-left"
                  >
                    <Image
                      src={item.src}
                      alt={item.title}
                      width={900}
                      height={560}
                      className="h-auto w-full object-cover transition duration-300 group-hover:scale-[1.01]"
                    />
                    <p className="px-3 py-2 text-xs text-white/70">{item.title}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/12 bg-black/20 p-4">
              <p className="mb-3 text-sm font-semibold text-white/85">필기본 제공</p>
              <div className="grid grid-cols-2 gap-3">
                {notePreviews.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => setSelectedPreview(item)}
                    className="group w-full overflow-hidden rounded-xl border border-white/12 bg-black/20 text-left"
                  >
                    <Image
                      src={item.src}
                      alt={item.title}
                      width={420}
                      height={420}
                      className="h-36 w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                    <p className="px-3 py-2 text-xs text-white/70">{item.title}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {selectedPreview && (
        <div
          className="fixed inset-0 z-50 bg-black/80 px-3 py-6 backdrop-blur-sm sm:px-8"
          onClick={() => setSelectedPreview(null)}
        >
          <div className="mx-auto flex h-full w-full max-w-5xl flex-col">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-white/80">{selectedPreview.title}</p>
              <button
                type="button"
                onClick={() => setSelectedPreview(null)}
                className="inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/5 px-2.5 py-1.5 text-xs text-white/80 transition hover:bg-white/10"
              >
                닫기
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div
              className="relative flex-1 overflow-hidden rounded-2xl border border-white/15 bg-[#0b0d12]"
              onClick={(event) => event.stopPropagation()}
            >
              <Image
                src={selectedPreview.src}
                alt={selectedPreview.title}
                fill
                sizes="100vw"
                className="object-contain p-2"
                priority
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
