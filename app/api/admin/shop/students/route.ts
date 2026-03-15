import { NextResponse } from "next/server";
import {
  getSessionUserFromCookies,
  requireAdmin,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const user = await getSessionUserFromCookies();
  if (!user) return unauthorizedResponse();

  const adminError = requireAdmin(user);
  if (adminError) return adminError;

  const url = new URL(request.url);
  const q = String(url.searchParams.get("q") || "")
    .trim()
    .toLowerCase();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("students")
    .select("id, name, phone, class_name, coin_balance")
    .eq("role", "student")
    .order("name", { ascending: true })
    .limit(500);

  if (error) {
    return NextResponse.json(
      { ok: false, message: "학생 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }

  const filtered = (data ?? []).filter((student) => {
    if (!q) return true;
    const target = `${student.name ?? ""} ${student.phone ?? ""}`.toLowerCase();
    return target.includes(q);
  });

  return NextResponse.json({
    ok: true,
    students: filtered.map((student) => ({
      id: student.id,
      name: student.name,
      phone: student.phone,
      className: student.class_name,
      coinBalance: Number(student.coin_balance ?? 0),
    })),
  });
}

