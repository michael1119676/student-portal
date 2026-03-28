import { NextResponse } from "next/server";
import { getSessionUserFromCookies, requireAdmin } from "@/lib/api-auth";
import { buildAnswerConfigTemplateFile } from "@/lib/admin-answer-config-upload";

export async function GET(request: Request) {
  const user = await getSessionUserFromCookies();
  const adminError = requireAdmin(user);
  if (adminError) return adminError;

  const url = new URL(request.url);
  const season = String(url.searchParams.get("season") || "")
    .trim()
    .toUpperCase();
  const round = Number(url.searchParams.get("round") || "");
  const format = String(url.searchParams.get("format") || "xlsx")
    .trim()
    .toLowerCase();

  if (!["C", "N"].includes(season)) {
    return NextResponse.json(
      { ok: false, message: "템플릿은 C/N 시즌만 지원합니다." },
      { status: 400 }
    );
  }

  if (!Number.isFinite(round) || round < 1 || round > 30) {
    return NextResponse.json(
      { ok: false, message: "회차 정보가 올바르지 않습니다." },
      { status: 400 }
    );
  }

  if (format !== "csv" && format !== "xlsx") {
    return NextResponse.json(
      { ok: false, message: "지원하지 않는 템플릿 형식입니다." },
      { status: 400 }
    );
  }

  try {
    const file = await buildAnswerConfigTemplateFile({
      season: season as "C" | "N",
      round: Math.round(round),
      format,
    });

    return new NextResponse(file.body, {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "템플릿 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
