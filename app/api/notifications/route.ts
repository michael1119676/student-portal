import { NextResponse } from "next/server";
import { getSessionUserFromCookies, unauthorizedResponse } from "@/lib/api-auth";
import { rejectIfCrossOrigin } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";

type NotificationRow = {
  id: number;
  type: string;
  audience: string;
  target_user_id: string | null;
  title: string;
  body: string;
  is_important: boolean;
  season: string | null;
  round: number | null;
  related_path: string | null;
  created_at: string;
};

async function fetchVisibleNotifications(
  user: { id: string; role: "student" | "admin" },
  options?: { limit?: number; ids?: number[] }
) {
  const supabase = createAdminClient();
  const limit = options?.limit ?? 50;
  const audienceList = user.role === "admin" ? ["all", "admins"] : ["all", "students"];

  let targetedQuery = supabase
    .from("portal_notifications")
    .select(
      "id, type, audience, target_user_id, title, body, is_important, season, round, related_path, created_at"
    )
    .eq("target_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  let audienceQuery = supabase
    .from("portal_notifications")
    .select(
      "id, type, audience, target_user_id, title, body, is_important, season, round, related_path, created_at"
    )
    .is("target_user_id", null)
    .in("audience", audienceList)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options?.ids?.length) {
    targetedQuery = targetedQuery.in("id", options.ids);
    audienceQuery = audienceQuery.in("id", options.ids);
  }

  const [{ data: targetedRows, error: targetedError }, { data: audienceRows, error: audienceError }] =
    await Promise.all([targetedQuery, audienceQuery]);

  if (targetedError || audienceError) {
    throw new Error(targetedError?.message || audienceError?.message || "알림을 불러오지 못했습니다.");
  }

  const deduped = new Map<number, NotificationRow>();
  for (const row of [...(targetedRows ?? []), ...(audienceRows ?? [])] as NotificationRow[]) {
    deduped.set(Number(row.id), row);
  }

  return [...deduped.values()].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
  );
}

export async function GET() {
  const user = await getSessionUserFromCookies();
  if (!user) return unauthorizedResponse();

  try {
    const supabase = createAdminClient();
    const items = await fetchVisibleNotifications(user, { limit: 80 });
    const notificationIds = items.map((item) => Number(item.id));

    let readSet = new Set<number>();
    if (notificationIds.length > 0) {
      const { data: reads, error: readError } = await supabase
        .from("portal_notification_reads")
        .select("notification_id")
        .eq("user_id", user.id)
        .in("notification_id", notificationIds);

      if (readError) {
        return NextResponse.json(
          { ok: false, message: "읽음 상태를 불러오지 못했습니다." },
          { status: 500 }
        );
      }

      readSet = new Set((reads ?? []).map((row) => Number(row.notification_id)));
    }

    const payload = items.map((item) => ({
      id: Number(item.id),
      type: item.type,
      audience: item.audience,
      title: item.title,
      body: item.body,
      isImportant: item.is_important,
      season: item.season,
      round: item.round,
      relatedPath: item.related_path,
      createdAt: item.created_at,
      read: readSet.has(Number(item.id)),
    }));

    return NextResponse.json({
      ok: true,
      unreadCount: payload.filter((item) => !item.read).length,
      items: payload,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "알림을 불러오지 못했습니다.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const originError = rejectIfCrossOrigin(request);
  if (originError) return originError;

  const user = await getSessionUserFromCookies();
  if (!user) return unauthorizedResponse();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, message: "요청 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const markAll = body.markAll === true;
  const requestedIds = Array.isArray(body.notificationIds)
    ? body.notificationIds
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
    : body.notificationId !== undefined
      ? [Number(body.notificationId)].filter((value) => Number.isFinite(value) && value > 0)
      : [];

  if (!markAll && requestedIds.length === 0) {
    return NextResponse.json(
      { ok: false, message: "읽음 처리할 알림이 없습니다." },
      { status: 400 }
    );
  }

  try {
    const visibleItems = await fetchVisibleNotifications(user, {
      limit: markAll ? 200 : requestedIds.length,
      ids: markAll ? undefined : requestedIds,
    });
    const targetIds = visibleItems.map((item) => Number(item.id));

    if (targetIds.length === 0) {
      return NextResponse.json({ ok: true, readIds: [] });
    }

    const now = new Date().toISOString();
    const supabase = createAdminClient();
    const { error } = await supabase.from("portal_notification_reads").upsert(
      targetIds.map((notificationId) => ({
        notification_id: notificationId,
        user_id: user.id,
        read_at: now,
      })),
      {
        onConflict: "notification_id,user_id",
      }
    );

    if (error) {
      return NextResponse.json(
        { ok: false, message: `읽음 처리 실패: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      readIds: targetIds,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "읽음 처리에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}
