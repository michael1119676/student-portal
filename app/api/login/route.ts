import bcrypt from "bcrypt";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buildAccountGuardKey,
  buildIpGuardKey,
  clearLoginFailuresOnSuccess,
  formatRetryAfterMessage,
  getActiveLoginLock,
  recordFailedLoginAttempt,
} from "@/lib/login-guard";
import { getClientIp, rejectIfCrossOrigin } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function buildFailedLoginMessage(remainingAttempts: number) {
  if (remainingAttempts <= 0) {
    return "로그인 정보가 일치하지 않습니다. 5회 실패 시 10분간 잠금됩니다.";
  }
  return `로그인 정보가 일치하지 않습니다. 남은 로그인 시도 ${remainingAttempts}회. 5회 실패 시 10분간 잠금됩니다.`;
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
    const originError = rejectIfCrossOrigin(request);
    if (originError) return originError;

    const missingEnv = getMissingEnvVars();
    if (missingEnv.length > 0) {
      console.error("[login] missing environment variables:", missingEnv.join(", "));
      return NextResponse.json(
        {
          ok: false,
          message: "서버 설정 오류로 로그인에 실패했습니다.",
        },
        { status: 500 }
      );
    }

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
    const clientIp = getClientIp(request);
    const accountKey = buildAccountGuardKey(name, phone);
    const ipKey = buildIpGuardKey(clientIp);

    let activeLock: Awaited<ReturnType<typeof getActiveLoginLock>> = null;
    try {
      activeLock = await getActiveLoginLock(supabase, {
        accountKey,
        ipKey,
      });
    } catch (guardError) {
      console.error("[login] login guard check failed:", guardError);
      activeLock = null;
    }

    if (activeLock) {
      return NextResponse.json(
        {
          ok: false,
          message: formatRetryAfterMessage(activeLock.retryAfterSeconds),
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(activeLock.retryAfterSeconds),
          },
        }
      );
    }

    const { data: students, error } = await supabase
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
      .limit(2);

    if (error) {
      console.error("[login] supabase query error:", error.message);
      return NextResponse.json(
        { ok: false, message: "서버 설정 오류로 로그인에 실패했습니다." },
        { status: 500 }
      );
    }

    if ((students?.length ?? 0) > 1) {
      console.warn("[login] duplicate student rows found for same name+phone:", {
        name,
        phone,
        count: students?.length ?? 0,
      });
    }

    const student = students?.[0];

    if (!student) {
      let failure: Awaited<ReturnType<typeof recordFailedLoginAttempt>>;
      try {
        failure = await recordFailedLoginAttempt(supabase, {
          accountKey,
          ipKey,
          studentId: null,
          name,
          phone,
          ip: clientIp,
        });
      } catch (guardError) {
        console.error("[login] login guard record failed (missing student):", guardError);
        failure = { lock: null, remainingAttempts: 0 };
      }

      if (failure.lock) {
        return NextResponse.json(
          {
            ok: false,
            message: formatRetryAfterMessage(failure.lock.retryAfterSeconds),
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(failure.lock.retryAfterSeconds),
            },
          }
        );
      }

      return NextResponse.json(
        {
          ok: false,
          remainingAttempts: failure.remainingAttempts,
          message: buildFailedLoginMessage(failure.remainingAttempts),
        },
        { status: 401 }
      );
    }

    if (!student.pin_hash) {
      console.error("[login] missing pin_hash for student:", student.id);
      try {
        await recordFailedLoginAttempt(supabase, {
          accountKey,
          ipKey,
          studentId: student.id,
          name,
          phone,
          ip: clientIp,
        });
      } catch (guardError) {
        console.error("[login] login guard record failed (missing pin_hash):", guardError);
      }
      return NextResponse.json(
        { ok: false, message: "계정 초기화가 필요합니다. 관리자에게 문의하세요." },
        { status: 500 }
      );
    }

    const ok = await bcrypt.compare(pin, student.pin_hash);
    if (!ok) {
      let failure: Awaited<ReturnType<typeof recordFailedLoginAttempt>>;
      try {
        failure = await recordFailedLoginAttempt(supabase, {
          accountKey,
          ipKey,
          studentId: student.id,
          name,
          phone,
          ip: clientIp,
        });
      } catch (guardError) {
        console.error("[login] login guard record failed (wrong pin):", guardError);
        failure = { lock: null, remainingAttempts: 0 };
      }

      if (failure.lock) {
        return NextResponse.json(
          {
            ok: false,
            message: formatRetryAfterMessage(failure.lock.retryAfterSeconds),
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(failure.lock.retryAfterSeconds),
            },
          }
        );
      }

      return NextResponse.json(
        {
          ok: false,
          remainingAttempts: failure.remainingAttempts,
          message: buildFailedLoginMessage(failure.remainingAttempts),
        },
        { status: 401 }
      );
    }

    try {
      await clearLoginFailuresOnSuccess(supabase, {
        accountKey,
        ipKey,
      });
    } catch (guardError) {
      console.error("[login] login guard clear failed:", guardError);
    }

    const safeRole = student.role === "admin" ? "admin" : "student";
    const safePhone = String(student.phone || phone);

    const token = createSessionToken({
      id: student.id,
      name: student.name,
      phone: safePhone,
      role: safeRole,
    });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
      priority: "high",
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: student.id,
        name: student.name,
        phone: safePhone,
        role: safeRole,
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
