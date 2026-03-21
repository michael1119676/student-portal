import { NextResponse } from "next/server";
import { getSessionUserFromCookies, requireAdmin } from "@/lib/api-auth";
import { rejectIfCrossOrigin } from "@/lib/security";
import {
  applyAdminScoreUpload,
  buildAdminScoreUploadPreview,
} from "@/lib/admin-score-upload";

const SUPPORTED_SEASONS = ["C", "N", "DP", "SP", "EA"] as const;

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
  const seasonRaw = String(formData.get("season") || "")
    .trim()
    .toUpperCase();
  const round = Number(formData.get("round") || "");
  const file = formData.get("file");

  if (!SUPPORTED_SEASONS.includes(seasonRaw as (typeof SUPPORTED_SEASONS)[number])) {
    return NextResponse.json(
      { ok: false, message: "업로드할 시즌 정보가 올바르지 않습니다." },
      { status: 400 }
    );
  }
  const season = seasonRaw as (typeof SUPPORTED_SEASONS)[number];

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
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    if (mode === "apply") {
      const result = await applyAdminScoreUpload({
        season,
        round: Math.round(round),
        fileName: file.name,
        fileBuffer,
        adminId: user?.id ?? "",
      });

      return NextResponse.json({
        ok: true,
        mode: "apply",
        result,
        message: `파일 적용이 완료되었습니다. 신규 ${result.insertedCount}건, 수정 ${result.updatedCountApplied}건입니다.`,
      });
    }

    const preview = await buildAdminScoreUploadPreview({
      season,
      round: Math.round(round),
      fileName: file.name,
      fileBuffer,
    });

    return NextResponse.json({
      ok: true,
      mode: "preview",
      preview,
      message: `미리보기를 불러왔습니다. 신규 ${preview.newCount}건, 수정 ${preview.updateCount}건, 매칭 실패 ${preview.matchFailedCount}건입니다.`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "파일 업로드 처리 중 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
