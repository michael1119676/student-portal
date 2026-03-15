import { NextResponse } from "next/server";

type LoginAttemptBucket = {
  failures: number;
  windowStart: number;
  blockedUntil: number;
};

const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_BLOCK_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 8;
const LOGIN_BUCKET_CLEANUP_MS = 60 * 1000;

const loginAttemptBuckets = new Map<string, LoginAttemptBucket>();
let lastLoginBucketCleanupAt = 0;

function normalizeRateLimitKey(key: string) {
  return key.trim().toLowerCase();
}

function cleanupLoginBuckets(now: number) {
  if (now - lastLoginBucketCleanupAt < LOGIN_BUCKET_CLEANUP_MS) return;

  for (const [key, bucket] of loginAttemptBuckets.entries()) {
    const isExpiredWindow = now - bucket.windowStart > LOGIN_WINDOW_MS * 2;
    const isUnblocked = bucket.blockedUntil <= now;
    if (isExpiredWindow && isUnblocked) {
      loginAttemptBuckets.delete(key);
    }
  }

  lastLoginBucketCleanupAt = now;
}

function getOrCreateLoginBucket(key: string, now: number) {
  const normalizedKey = normalizeRateLimitKey(key);
  const existing = loginAttemptBuckets.get(normalizedKey);

  if (!existing) {
    const created: LoginAttemptBucket = {
      failures: 0,
      windowStart: now,
      blockedUntil: 0,
    };
    loginAttemptBuckets.set(normalizedKey, created);
    return created;
  }

  if (now - existing.windowStart > LOGIN_WINDOW_MS) {
    existing.failures = 0;
    existing.windowStart = now;
    existing.blockedUntil = 0;
  }

  return existing;
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}

function getExpectedOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  if (!host) return null;

  const forwardedProto = request.headers.get("x-forwarded-proto")?.trim();
  const protocol = forwardedProto || (host.includes("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

function parseOriginLike(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function isSameOriginRequest(request: Request) {
  const expectedOrigin = getExpectedOrigin(request);
  if (!expectedOrigin) return false;

  const origin = parseOriginLike(request.headers.get("origin"));
  if (origin) return origin === expectedOrigin;

  const refererOrigin = parseOriginLike(request.headers.get("referer"));
  if (refererOrigin) return refererOrigin === expectedOrigin;

  return process.env.NODE_ENV !== "production";
}

export function rejectIfCrossOrigin(request: Request) {
  if (isSameOriginRequest(request)) return null;
  return NextResponse.json(
    { ok: false, message: "잘못된 요청입니다." },
    { status: 403 }
  );
}

export function buildLoginRateLimitKeys(request: Request, name: string, phone: string) {
  const ip = getClientIp(request);
  const keys = [`ip:${ip}`];

  const normalizedName = name.trim().toLowerCase();
  const normalizedPhone = phone.trim();
  if (normalizedName && normalizedPhone) {
    keys.push(`ipacct:${ip}|${normalizedName}|${normalizedPhone}`);
  }

  return keys;
}

export function checkLoginRateLimit(keys: string[]) {
  const now = Date.now();
  cleanupLoginBuckets(now);

  const normalizedKeys = [...new Set(keys.map(normalizeRateLimitKey).filter(Boolean))];
  let maxRetryAfterMs = 0;

  for (const key of normalizedKeys) {
    const bucket = loginAttemptBuckets.get(key);
    if (!bucket) continue;

    if (bucket.blockedUntil > now) {
      maxRetryAfterMs = Math.max(maxRetryAfterMs, bucket.blockedUntil - now);
    }
  }

  if (maxRetryAfterMs > 0) {
    return {
      limited: true,
      retryAfterSeconds: Math.max(1, Math.ceil(maxRetryAfterMs / 1000)),
    };
  }

  return { limited: false, retryAfterSeconds: 0 };
}

export function recordLoginFailure(keys: string[]) {
  const now = Date.now();
  cleanupLoginBuckets(now);

  const normalizedKeys = [...new Set(keys.map(normalizeRateLimitKey).filter(Boolean))];

  for (const key of normalizedKeys) {
    const bucket = getOrCreateLoginBucket(key, now);
    bucket.failures += 1;

    if (bucket.failures >= LOGIN_MAX_FAILURES) {
      bucket.blockedUntil = now + LOGIN_BLOCK_MS;
    }
  }
}

export function clearLoginFailures(keys: string[]) {
  const normalizedKeys = [...new Set(keys.map(normalizeRateLimitKey).filter(Boolean))];
  for (const key of normalizedKeys) {
    loginAttemptBuckets.delete(key);
  }
}
