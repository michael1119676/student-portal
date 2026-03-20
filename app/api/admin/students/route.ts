import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { getSessionUserFromCookies, requireAdmin } from "@/lib/api-auth";
import {
  normalizeStudyPlace,
  normalizeStudyYear,
} from "@/lib/student-profile-options";
import { rejectIfCrossOrigin } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export async function POST(request: Request) {
  const originError = rejectIfCrossOrigin(request);
  if (originError) return originError;

  const user = await getSessionUserFromCookies();
  const adminError = requireAdmin(user);
  if (adminError) return adminError;

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    body =
      typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {};
  } catch {
    return NextResponse.json(
      { ok: false, message: "요청 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const name = String(body.name || "").trim();
  const phone = normalizePhone(String(body.phone || ""));
  const pin = String(body.pin || "").trim();
  const classNameRaw = String(body.className || "").trim();
  const studyYear = normalizeStudyYear(body.studyYear);
  const studyPlace = normalizeStudyPlace(body.studyPlace);

  if (!name) {
    return NextResponse.json(
      { ok: false, message: "학생 이름을 입력해주세요." },
      { status: 400 }
    );
  }

  if (phone.length < 10 || phone.length > 11) {
    return NextResponse.json(
      { ok: false, message: "전화번호를 정확히 입력해주세요." },
      { status: 400 }
    );
  }

  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json(
      { ok: false, message: "비밀번호는 숫자 4자리여야 합니다." },
      { status: 400 }
    );
  }

  const className = classNameRaw || null;
  const pinHash = await bcrypt.hash(pin, 10);
  const supabase = createAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from("students")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  if (existingError) {
    console.error("[admin/students] failed to check existing phone:", existingError.message);
    return NextResponse.json(
      { ok: false, message: "학생 추가 전에 중복 확인에 실패했습니다." },
      { status: 500 }
    );
  }

  if (existing) {
    return NextResponse.json(
      { ok: false, message: "이미 등록된 전화번호입니다." },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("students")
    .insert({
      name,
      phone,
      role: "student",
      class_name: className,
      pin_hash: pinHash,
      must_change_pin: false,
      korean_subject: null,
      math_subject: null,
      science_1: null,
      science_2: null,
      target_university: "seoul",
      study_year: studyYear,
      study_place: studyPlace,
      updated_at: new Date().toISOString(),
    })
    .select("id, name, phone, role, class_name")
    .single();

  if (error || !data) {
    console.error("[admin/students] failed to create student:", error?.message || "unknown");
    return NextResponse.json(
      { ok: false, message: "학생 추가에 실패했습니다." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    student: {
      id: data.id,
      name: data.name,
      phone: data.phone,
      role: data.role === "admin" ? "admin" : "student",
      className: data.class_name,
    },
  });
}
