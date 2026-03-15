import type { SupabaseClient } from "@supabase/supabase-js";

const LOGIN_GUARD_STATE_TABLE = "login_guard_state";
const LOGIN_GUARD_EVENT_TABLE = "login_guard_events";

const MAX_FAILED_ATTEMPTS = 5;
const FAILURE_WINDOW_MS = 10 * 60 * 1000;
const LOCK_DURATION_MS = 10 * 60 * 1000;

export type LoginGuardScope = "account" | "ip";

type LoginGuardStateRow = {
  scope: LoginGuardScope;
  key: string;
  student_id: string | null;
  failed_count: number | null;
  first_failed_at: string | null;
  last_failed_at: string | null;
  locked_until: string | null;
  lock_reason: string | null;
};

type LoginGuardStatus = {
  scope: LoginGuardScope;
  lockedUntil: string;
  retryAfterSeconds: number;
};

type FailureScopeResult = {
  justLocked: boolean;
  lockedUntil: string | null;
  failedCountAfterAttempt: number;
};

export type FailedLoginAttemptResult = {
  lock: LoginGuardStatus | null;
  remainingAttempts: number;
};

function normalizePhone(phone: string) {
  return String(phone).replace(/\D/g, "");
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function retryAfterSeconds(lockedUntil: Date, now: Date) {
  return Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000));
}

async function appendLockEvent(
  supabase: SupabaseClient,
  payload: {
    scope: LoginGuardScope;
    key: string;
    studentId?: string | null;
    ip?: string | null;
    name?: string | null;
    phone?: string | null;
    lockedUntil?: string | null;
  }
) {
  const { error } = await supabase.from(LOGIN_GUARD_EVENT_TABLE).insert({
    event_type: "locked",
    scope: payload.scope,
    key: payload.key,
    student_id: payload.studentId ?? null,
    ip: payload.ip ?? null,
    name: payload.name ?? null,
    phone: payload.phone ?? null,
    reason: "too_many_failed_attempts",
    locked_until: payload.lockedUntil ?? null,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[login-guard] failed to append lock event:", error.message);
  }
}

async function getStateRow(
  supabase: SupabaseClient,
  scope: LoginGuardScope,
  key: string
) {
  const { data, error } = await supabase
    .from(LOGIN_GUARD_STATE_TABLE)
    .select(
      "scope, key, student_id, failed_count, first_failed_at, last_failed_at, locked_until, lock_reason"
    )
    .eq("scope", scope)
    .eq("key", key)
    .maybeSingle();

  if (error) throw error;
  return data as LoginGuardStateRow | null;
}

async function upsertStateRow(
  supabase: SupabaseClient,
  row: {
    scope: LoginGuardScope;
    key: string;
    student_id: string | null;
    failed_count: number;
    first_failed_at: string | null;
    last_failed_at: string | null;
    locked_until: string | null;
    lock_reason: string | null;
    unlocked_by?: string | null;
    unlocked_at?: string | null;
  }
) {
  const { error } = await supabase
    .from(LOGIN_GUARD_STATE_TABLE)
    .upsert(
      {
        scope: row.scope,
        key: row.key,
        student_id: row.student_id,
        failed_count: row.failed_count,
        first_failed_at: row.first_failed_at,
        last_failed_at: row.last_failed_at,
        locked_until: row.locked_until,
        lock_reason: row.lock_reason,
        unlocked_by: row.unlocked_by ?? null,
        unlocked_at: row.unlocked_at ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "scope,key" }
    );

  if (error) throw error;
}

async function applyFailureToScope(
  supabase: SupabaseClient,
  scope: LoginGuardScope,
  key: string,
  studentId: string | null,
  now: Date
): Promise<FailureScopeResult> {
  const existing = await getStateRow(supabase, scope, key);

  const existingLockUntil = parseDate(existing?.locked_until);
  if (existingLockUntil && existingLockUntil.getTime() > now.getTime()) {
    return {
      justLocked: false,
      lockedUntil: existingLockUntil.toISOString(),
      failedCountAfterAttempt: existing?.failed_count ?? 0,
    };
  }

  const firstFailedAt = parseDate(existing?.first_failed_at);
  let failedCount = existing?.failed_count ?? 0;
  let nextFirstFailedAt = firstFailedAt;

  if (!firstFailedAt || now.getTime() - firstFailedAt.getTime() > FAILURE_WINDOW_MS) {
    failedCount = 0;
    nextFirstFailedAt = now;
  }

  failedCount += 1;

  let lockedUntil: Date | null = null;
  if (failedCount >= MAX_FAILED_ATTEMPTS) {
    lockedUntil = new Date(now.getTime() + LOCK_DURATION_MS);
    failedCount = 0;
    nextFirstFailedAt = null;
  }

  await upsertStateRow(supabase, {
    scope,
    key,
    student_id: studentId ?? existing?.student_id ?? null,
    failed_count: failedCount,
    first_failed_at: nextFirstFailedAt ? nextFirstFailedAt.toISOString() : null,
    last_failed_at: now.toISOString(),
    locked_until: lockedUntil ? lockedUntil.toISOString() : null,
    lock_reason: lockedUntil ? "too_many_failed_attempts" : existing?.lock_reason ?? null,
  });

  return {
    justLocked: !!lockedUntil,
    lockedUntil: lockedUntil ? lockedUntil.toISOString() : null,
    failedCountAfterAttempt: failedCount,
  };
}

function pickMostRestrictiveLock(
  locks: Array<{ scope: LoginGuardScope; lockedUntil: string; retryAfterSeconds: number }>
) {
  return locks.sort((a, b) => b.retryAfterSeconds - a.retryAfterSeconds)[0];
}

export function buildAccountGuardKey(name: string, phone: string) {
  return `${String(name).trim().toLowerCase()}|${normalizePhone(phone)}`;
}

export function buildIpGuardKey(ip: string) {
  const normalized = String(ip || "").trim();
  return normalized || "unknown";
}

export function formatRetryAfterMessage(retryAfterSec: number) {
  const minutes = Math.ceil(retryAfterSec / 60);
  return `로그인 5회 실패로 10분간 잠금되었습니다. 약 ${minutes}분 후 다시 시도해 주세요.`;
}

export async function getActiveLoginLock(
  supabase: SupabaseClient,
  input: {
    accountKey: string;
    ipKey: string;
  }
) {
  const now = new Date();
  const [account, ip] = await Promise.all([
    getStateRow(supabase, "account", input.accountKey),
    getStateRow(supabase, "ip", input.ipKey),
  ]);

  const activeLocks: LoginGuardStatus[] = [];

  const accountLockedUntil = parseDate(account?.locked_until);
  if (accountLockedUntil && accountLockedUntil.getTime() > now.getTime()) {
    activeLocks.push({
      scope: "account",
      lockedUntil: accountLockedUntil.toISOString(),
      retryAfterSeconds: retryAfterSeconds(accountLockedUntil, now),
    });
  }

  const ipLockedUntil = parseDate(ip?.locked_until);
  if (ipLockedUntil && ipLockedUntil.getTime() > now.getTime()) {
    activeLocks.push({
      scope: "ip",
      lockedUntil: ipLockedUntil.toISOString(),
      retryAfterSeconds: retryAfterSeconds(ipLockedUntil, now),
    });
  }

  if (!activeLocks.length) return null;
  return pickMostRestrictiveLock(activeLocks);
}

export async function recordFailedLoginAttempt(
  supabase: SupabaseClient,
  input: {
    accountKey: string;
    ipKey: string;
    studentId?: string | null;
    name?: string | null;
    phone?: string | null;
    ip?: string | null;
  }
): Promise<FailedLoginAttemptResult> {
  const now = new Date();
  const studentId = input.studentId ?? null;

  const [accountResult, ipResult] = await Promise.all([
    applyFailureToScope(supabase, "account", input.accountKey, studentId, now),
    applyFailureToScope(supabase, "ip", input.ipKey, studentId, now),
  ]);

  if (accountResult.justLocked && accountResult.lockedUntil) {
    await appendLockEvent(supabase, {
      scope: "account",
      key: input.accountKey,
      studentId,
      ip: input.ip ?? null,
      name: input.name ?? null,
      phone: input.phone ?? null,
      lockedUntil: accountResult.lockedUntil,
    });
  }

  if (ipResult.justLocked && ipResult.lockedUntil) {
    await appendLockEvent(supabase, {
      scope: "ip",
      key: input.ipKey,
      studentId,
      ip: input.ip ?? null,
      name: input.name ?? null,
      phone: input.phone ?? null,
      lockedUntil: ipResult.lockedUntil,
    });
  }

  const lockCandidates: LoginGuardStatus[] = [];

  const accountLockDate = parseDate(accountResult.lockedUntil);
  if (accountLockDate && accountLockDate.getTime() > now.getTime()) {
    lockCandidates.push({
      scope: "account",
      lockedUntil: accountLockDate.toISOString(),
      retryAfterSeconds: retryAfterSeconds(accountLockDate, now),
    });
  }

  const ipLockDate = parseDate(ipResult.lockedUntil);
  if (ipLockDate && ipLockDate.getTime() > now.getTime()) {
    lockCandidates.push({
      scope: "ip",
      lockedUntil: ipLockDate.toISOString(),
      retryAfterSeconds: retryAfterSeconds(ipLockDate, now),
    });
  }

  const lock = lockCandidates.length
    ? pickMostRestrictiveLock(lockCandidates)
    : null;

  const remainingAttempts = Math.max(
    0,
    MAX_FAILED_ATTEMPTS - accountResult.failedCountAfterAttempt
  );

  return { lock, remainingAttempts };
}

export async function clearLoginFailuresOnSuccess(
  supabase: SupabaseClient,
  input: {
    accountKey: string;
    ipKey: string;
  }
) {
  const now = new Date().toISOString();
  const basePayload = {
    failed_count: 0,
    first_failed_at: null,
    last_failed_at: null,
    locked_until: null,
    lock_reason: null,
    updated_at: now,
  };

  const [accountRes, ipRes] = await Promise.all([
    supabase
      .from(LOGIN_GUARD_STATE_TABLE)
      .update(basePayload)
      .eq("scope", "account")
      .eq("key", input.accountKey),
    supabase
      .from(LOGIN_GUARD_STATE_TABLE)
      .update(basePayload)
      .eq("scope", "ip")
      .eq("key", input.ipKey),
  ]);

  if (accountRes.error) throw accountRes.error;
  if (ipRes.error) throw ipRes.error;
}

export async function unlockLoginGuardByAdmin(
  supabase: SupabaseClient,
  input: {
    studentId: string;
    accountKey: string;
    adminId: string;
    adminIp?: string | null;
  }
) {
  const now = new Date().toISOString();
  const unlockPayload = {
    failed_count: 0,
    first_failed_at: null,
    last_failed_at: null,
    locked_until: null,
    lock_reason: null,
    unlocked_by: input.adminId,
    unlocked_at: now,
    updated_at: now,
  };

  const [byStudent, byAccount] = await Promise.all([
    supabase
      .from(LOGIN_GUARD_STATE_TABLE)
      .update(unlockPayload)
      .eq("student_id", input.studentId)
      .select("scope,key"),
    supabase
      .from(LOGIN_GUARD_STATE_TABLE)
      .update(unlockPayload)
      .eq("scope", "account")
      .eq("key", input.accountKey)
      .select("scope,key"),
  ]);

  if (byStudent.error) throw byStudent.error;
  if (byAccount.error) throw byAccount.error;

  const unlockedRows = (byStudent.data?.length ?? 0) + (byAccount.data?.length ?? 0);

  void input.adminIp;
  return { unlockedRows };
}
