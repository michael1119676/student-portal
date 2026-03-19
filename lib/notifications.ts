import { createAdminClient } from "@/lib/supabase/admin";
import {
  getPremiumRoundLabel,
  getPremiumSeasonMeta,
  isPremiumSeason,
} from "@/lib/season-premium";

export type PortalNotificationType =
  | "score_input"
  | "admin_comment"
  | "delivery_complete"
  | "announcement";

export type PortalNotificationAudience = "single" | "all" | "students" | "admins";

type SupabaseClientLike = ReturnType<typeof createAdminClient>;

export type CreatePortalNotificationInput = {
  type: PortalNotificationType;
  title: string;
  body: string;
  audience?: PortalNotificationAudience;
  targetUserId?: string | null;
  isImportant?: boolean;
  season?: string | null;
  round?: number | null;
  relatedPath?: string | null;
  createdBy?: string | null;
};

export function formatNotificationSeasonRoundLabel(season: string, round: number) {
  const normalizedSeason = String(season || "")
    .trim()
    .toUpperCase();

  if (isPremiumSeason(normalizedSeason)) {
    const meta = getPremiumSeasonMeta(normalizedSeason);
    return `${meta.shortTitle} ${getPremiumRoundLabel(round)}`;
  }

  return `${normalizedSeason} 시즌 ${round}회`;
}

export async function createPortalNotification(
  supabase: SupabaseClientLike,
  input: CreatePortalNotificationInput
) {
  const audience = input.audience ?? (input.targetUserId ? "single" : "all");

  const payload = {
    type: input.type,
    audience,
    target_user_id: audience === "single" ? input.targetUserId ?? null : null,
    title: input.title.trim(),
    body: input.body.trim(),
    is_important: input.isImportant ?? false,
    season: input.season ? String(input.season).trim().toUpperCase() : null,
    round:
      input.round === null || input.round === undefined || !Number.isFinite(input.round)
        ? null
        : Math.round(input.round),
    related_path: input.relatedPath?.trim() || null,
    created_by: input.createdBy ?? null,
  };

  return supabase.from("portal_notifications").insert(payload);
}

export async function createStudentScoreNotification(
  supabase: SupabaseClientLike,
  options: {
    studentId: string;
    season: string;
    round: number;
    score: number | null;
    createdBy: string;
  }
) {
  const label = formatNotificationSeasonRoundLabel(options.season, options.round);
  const scoreText = options.score === null ? "미입력" : `${Math.round(options.score)}점`;

  return createPortalNotification(supabase, {
    type: "score_input",
    targetUserId: options.studentId,
    title: `${label} 성적이 입력되었습니다.`,
    body: `새 성적이 등록되었습니다. 현재 점수는 ${scoreText}입니다.`,
    season: options.season,
    round: options.round,
    relatedPath: "/",
    createdBy: options.createdBy,
  });
}

export async function createAdminCommentNotification(
  supabase: SupabaseClientLike,
  options: {
    studentId: string;
    season: string;
    round: number;
    comment: string;
    createdBy: string;
  }
) {
  const label = formatNotificationSeasonRoundLabel(options.season, options.round);
  const excerpt = options.comment.trim().slice(0, 120);

  return createPortalNotification(supabase, {
    type: "admin_comment",
    targetUserId: options.studentId,
    title: `${label} 메모에 관리자 댓글이 등록되었습니다.`,
    body: excerpt || "관리자 댓글이 등록되었습니다. 확인해 주세요.",
    season: options.season,
    round: options.round,
    relatedPath: "/",
    createdBy: options.createdBy,
  });
}

export async function createDeliveryCompleteNotification(
  supabase: SupabaseClientLike,
  options: {
    studentId: string;
    productName: string;
    createdBy: string;
  }
) {
  return createPortalNotification(supabase, {
    type: "delivery_complete",
    targetUserId: options.studentId,
    title: "상품 지급이 완료되었습니다.",
    body: `${options.productName} 지급 처리가 완료되었습니다. 상점 기록에서 다시 확인할 수 있습니다.`,
    relatedPath: "/shop",
    createdBy: options.createdBy,
  });
}
