import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, SessionUser, verifySessionToken } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getSessionUserFromCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const user = verifySessionToken(token);
  return user;
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
): Promise<SessionUser> {
  const { data: byId } = await supabase
    .from("students")
    .select("id, name, phone, role")
    .eq("id", user.id)
    .maybeSingle<StudentRow>();

  if (byId) {
    return {
      id: byId.id,
      name: byId.name || user.name,
      phone: byId.phone || user.phone,
      role: byId.role === "admin" ? "admin" : "student",
    };
  }

  const { data: byPhone } = await supabase
    .from("students")
    .select("id, name, phone, role")
    .eq("phone", user.phone)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<StudentRow>();

  if (!byPhone) return user;

  return {
    id: byPhone.id,
    name: byPhone.name || user.name,
    phone: byPhone.phone || user.phone,
    role: byPhone.role === "admin" ? "admin" : "student",
  };
}
