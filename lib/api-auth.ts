import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, SessionUser, verifySessionToken } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export type StudentProfileRow = {
  korean_subject: string | null;
  math_subject: string | null;
  science_1: string | null;
  science_2: string | null;
  target_university: string | null;
  study_year: string | null;
  study_place: string | null;
};

async function getSignedSessionUserFromCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export async function getSessionUserFromCookies() {
  const signedUser = await getSignedSessionUserFromCookies();
  if (!signedUser) return null;

  const supabase = createAdminClient();
  return resolveSessionUser(supabase, signedUser);
}

export function unauthorizedResponse() {
  return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
}

export function requireAdmin(user: SessionUser | null) {
  if (!user || user.role !== "admin") {
    return unauthorizedResponse();
  }
  return null;
}

type SupabaseClientLike = ReturnType<typeof createAdminClient>;

type StudentRow = {
  id: string;
  name: string;
  phone: string;
  role: string;
};

export async function resolveSessionUser(
  supabase: SupabaseClientLike,
  user: SessionUser
): Promise<SessionUser | null> {
  const { data: byId } = await supabase
    .from("students")
    .select("id, name, phone, role")
    .eq("id", user.id)
    .maybeSingle<StudentRow>();

  if (!byId) return null;

  return {
    id: byId.id,
    name: byId.name || user.name,
    phone: byId.phone || user.phone,
    role: byId.role === "admin" ? "admin" : "student",
  };
}

export async function getStudentProfileById(
  supabase: SupabaseClientLike,
  studentId: string
): Promise<StudentProfileRow | null> {
  const { data, error } = await supabase
    .from("students")
    .select(
      `
        korean_subject,
        math_subject,
        science_1,
        science_2,
        target_university,
        study_year,
        study_place
      `
    )
    .eq("id", studentId)
    .maybeSingle<StudentProfileRow>();

  if (error || !data) return null;
  return data;
}

export async function getSessionContextFromCookies() {
  const signedUser = await getSignedSessionUserFromCookies();
  if (!signedUser) {
    return {
      user: null,
      profile: null,
    };
  }

  const supabase = createAdminClient();
  const user = await resolveSessionUser(supabase, signedUser);
  if (!user) {
    return {
      user: null,
      profile: null,
    };
  }

  const profile = await getStudentProfileById(supabase, user.id);
  return {
    user,
    profile,
  };
}
