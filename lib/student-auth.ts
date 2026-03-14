import fs from "fs";
import path from "path";
import crypto from "crypto";
import { parse } from "csv-parse/sync";

export const SESSION_COOKIE_NAME = "hp_session";

export type UserRole = "student" | "admin";

export type AuthUser = {
  name: string;
  phone: string;
  className: string;
  role: UserRole;
};

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set.");
  }
  return secret;
}

export function normalizePhone(phone: string) {
  return String(phone).replace(/\D/g, "");
}

function getCsvPath() {
  return path.join(process.cwd(), "data", "student_profile.csv");
}

export function getAllUsers(): AuthUser[] {
  const csvPath = getCsvPath();
  const raw = fs.readFileSync(csvPath, "utf-8");

  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  return rows
  .map((row) => {
    const name = (row["이름"] || "").trim();
    const phone = normalizePhone(row["전화번호"] || "");
    const className = (row["반"] || "").trim();

    if (!name || !phone) return null;

    const isAdmin = normalizePhone(phone) === "01011111111";

    return {
      name,
      phone,
      className,
      role: isAdmin ? "admin" : "student",
    } satisfies AuthUser;
  })
  .filter(Boolean) as AuthUser[];
    
}

export function findUserByNameAndPhone(name: string, phone: string): AuthUser | null {
  const normalizedName = name.trim();
  const normalizedPhone = normalizePhone(phone);

  const users = getAllUsers();

  return (
    users.find(
      (user) =>
        user.name === normalizedName &&
        user.phone === normalizedPhone
    ) || null
  );
}

function sign(value: string) {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("hex");
}

export function createSessionToken(user: AuthUser) {
  const payload = Buffer.from(JSON.stringify(user)).toString("base64url");
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function verifySessionToken(token?: string | null): AuthUser | null {
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  if (signature !== expected) return null;

  try {
    const decoded = Buffer.from(payload, "base64url").toString("utf-8");
    const user = JSON.parse(decoded) as AuthUser;

    if (!user?.name || !user?.phone || !user?.role) return null;

    return user;
  } catch {
    return null;
  }
}