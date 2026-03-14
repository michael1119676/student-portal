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

export async function POST(request: Request) {
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

  if (error || !student) {
    return NextResponse.json(
      { ok: false, message: "로그인 정보가 일치하지 않습니다." },
      { status: 401 }
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
}