import bcrypt from "bcrypt";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
} from "@/lib/session";

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function getMissingEnvVars() {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SESSION_SECRET",
  ] as const;

  return required.filter((key) => !process.env[key] || process.env[key]?.trim() === "");
}

export async function POST(request: Request) {
  try {
    const missingEnv = getMissingEnvVars();
    if (missingEnv.length > 0) {
      console.error("[login] missing environment variables:", missingEnv.join(", "));
      return NextResponse.json(
        {
          ok: false,
          message: `서버 환경변수 설정 오류: ${missingEnv.join(", ")}`,
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const name = String(body?.name || "").trim();
    const phone = normalizePhone(String(body?.phone || ""));
    const pin = String(body?.pin || "").trim();

    if (!name || !phone || !/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { ok: false, message: "이름, 전화번호, 4자리 비밀번호를 확인하세요." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: student, error } = await supabase
      .from("students")
      .select(`
    id,
    name,
    phone,
    role,
    pin_hash,
    korean_subject,
    math_subject,
    science_1,
    science_2,
    target_university
        `)
      .eq("name", name)
      .eq("phone", phone)
      .maybeSingle();

    if (error) {
      console.error("[login] supabase query error:", error.message);
      return NextResponse.json(
        { ok: false, message: "서버 설정 오류로 로그인에 실패했습니다." },
        { status: 500 }
      );
    }

    if (!student) {
      return NextResponse.json(
        { ok: false, message: "로그인 정보가 일치하지 않습니다." },
        { status: 401 }
      );
    }

    if (!student.pin_hash) {
      console.error("[login] missing pin_hash for student:", student.id);
      return NextResponse.json(
        { ok: false, message: "계정 초기화가 필요합니다. 관리자에게 문의하세요." },
        { status: 500 }
      );
    }

    const ok = await bcrypt.compare(pin, student.pin_hash);
    if (!ok) {
      return NextResponse.json(
        { ok: false, message: "로그인 정보가 일치하지 않습니다." },
        { status: 401 }
      );
    }

    const token = createSessionToken({
      id: student.id,
      name: student.name,
      phone: student.phone,
      role: student.role,
    });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: student.id,
        name: student.name,
        phone: student.phone,
        role: student.role,
      },
      profile: {
        korean_subject: student.korean_subject,
        math_subject: student.math_subject,
        science_1: student.science_1,
        science_2: student.science_2,
        target_university: student.target_university,
      },
    });
  } catch (error) {
    console.error("[login] unexpected error:", error);
    return NextResponse.json(
      { ok: false, message: "서버 오류로 로그인에 실패했습니다." },
      { status: 500 }
    );
  }
}
