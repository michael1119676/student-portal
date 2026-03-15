import crypto from "crypto";

export const SESSION_COOKIE_NAME = "hp_session";

export type SessionUser = {
  id: string;
  name: string;
  phone: string;
  role: "student" | "admin";
};

type SessionTokenPayload = {
  v: 1;
  iat: number;
  exp: number;
  user: SessionUser;
};

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET missing");
  return secret;
}

function sign(payload: string) {
  return crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest();
}

function isValidRole(role: unknown): role is SessionUser["role"] {
  return role === "student" || role === "admin";
}

function isValidSessionUser(value: unknown): value is SessionUser {
  if (!value || typeof value !== "object") return false;
  const user = value as Record<string, unknown>;
  return (
    typeof user.id === "string" &&
    user.id.length > 0 &&
    typeof user.name === "string" &&
    user.name.length > 0 &&
    typeof user.phone === "string" &&
    user.phone.length > 0 &&
    isValidRole(user.role)
  );
}

function hasValidTimingSafeSignature(payload: string, signature: string) {
  const expected = sign(payload);

  if (/^[a-f0-9]{64}$/i.test(signature)) {
    const providedHex = Buffer.from(signature, "hex");
    return (
      providedHex.length === expected.length &&
      crypto.timingSafeEqual(providedHex, expected)
    );
  }

  try {
    const provided = Buffer.from(signature, "base64url");
    return (
      provided.length === expected.length &&
      crypto.timingSafeEqual(provided, expected)
    );
  } catch {
    return false;
  }
}

export function createSessionToken(user: SessionUser) {
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload: SessionTokenPayload = {
    v: 1,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
    user,
  };
  const payload = Buffer.from(JSON.stringify(tokenPayload)).toString("base64url");
  return `${payload}.${sign(payload).toString("base64url")}`;
}

export function verifySessionToken(token?: string | null): SessionUser | null {
  if (!token || token.length > 4096) return null;
  const [payload, signature, extra] = token.split(".");
  if (extra) return null;
  if (!payload || !signature) return null;
  if (!hasValidTimingSafeSignature(payload, signature)) return null;

  try {
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf-8")
    ) as Partial<SessionTokenPayload>;

    if (decoded?.v !== 1) return null;
    if (!Number.isFinite(decoded.iat) || !Number.isFinite(decoded.exp)) return null;

    const now = Math.floor(Date.now() / 1000);
    if ((decoded.exp as number) <= now) return null;
    if ((decoded.iat as number) > now + 60) return null;

    if (!isValidSessionUser(decoded.user)) return null;
    return decoded.user;
  } catch {
    return null;
  }
}
