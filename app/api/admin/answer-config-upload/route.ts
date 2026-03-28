import { NextResponse } from "next/server";
import { getSessionUserFromCookies, requireAdmin } from "@/lib/api-auth";
import { rejectIfCrossOrigin } from "@/lib/security";
import {
  applyAdminAnswerConfigUpload,
  buildAdminAnswerConfigPreview,
} from "@/lib/admin-answer-config-upload";

const SUPPORTED_SEASONS = ["C", "N"] as const;

export async function POST(request: Request) {
  const originError = rejectIfCrossOrigin(request);
  if (originError) return originError;

  const user = await getSessionUserFromCookies();
  const adminError = requireAdmin(user);
  if (adminError) return adminError;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, message: "업로드 요청 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const mode = String(formData.get("mode") || "preview").trim().toLowerCase();
  const seasonRaw = String(formData.get("season") || "").trim().toUpperCase();
  const round = Number(formData.get("round") || "");
  const file = formData.get("file");

  if (!SUPPORTED_SEASONS.includes(seasonRaw as (typeof SUPPORTED_SEASONS)[number])) {
    return NextResponse.json(
      { ok: false, message: "정답/배점을 업로드할 시즌 정보가 올바르지 않습니다." },
      { status: 400 }
    );
  }

  if (!Number.isFinite(round) || round < 1 || round > 30) {
    return NextResponse.json(
      { ok: false, message: "업로드할 회차 정보가 올바르지 않습니다." },
      { status: 400 }
    );
  }

  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, message: "업로드할 파일을 선택해 주세요." },
      { status: 400 }
    );
  }

  try {
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const season = seasonRaw as (typeof SUPPORTED_SEASONS)[number];
    const safeRound = Math.round(round);

    if (mode === "apply") {
      const result = await applyAdminAnswerConfigUpload({
        season,
        round: safeRound,
        fileName: file.name,
        fileBuffer,
        adminId: user?.id ?? "",
      });

      return NextResponse.json({
        ok: true,
        mode: "apply",
        result,
        message: `정답/배점 적용이 완료되었습니다. ${result.questionCount}문항이 저장되었습니다.`,
      });
    }

    const preview = await buildAdminAnswerConfigPreview({
      season,
      round: safeRound,
      fileName: file.name,
      fileBuffer,
    });

    return NextResponse.json({
      ok: true,
      mode: "preview",
      preview,
      message: `미리보기를 불러왔습니다. 유효 ${preview.validCount}행, 오류 ${preview.invalidCount}행입니다.`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "정답/배점 업로드 처리 중 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
