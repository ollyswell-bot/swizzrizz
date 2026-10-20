import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import type { Role } from "@/lib/domain/types";

export const DEMO_COOKIE = "swizzrizz_session";
const MAX_AGE_SECONDS = 60 * 60 * 12;

export interface DemoSession {
  uid: string;
  org: string;
  role: Role;
  consent: boolean;
  iat: number;
  exp: number;
}

function b64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/**
 * Every demo login gets its own random organization, so two people trying the demo
 * on the same deployment never see each other's data.
 */
export function newDemoSession(now = Date.now()): DemoSession {
  const iat = Math.floor(now / 1000);
  return { uid: randomUUID(), org: randomUUID(), role: "owner", consent: false, iat, exp: iat + MAX_AGE_SECONDS };
}

export function encodeDemoSession(session: DemoSession, secret: string): string {
  const payload = b64url(JSON.stringify(session));
  return `${payload}.${sign(payload, secret)}`;
}

export function decodeDemoSession(token: string | undefined | null, secret: string, now = Date.now()): DemoSession | null {
  if (!token || typeof token !== "string" || token.length > 2048) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as DemoSession;
    if (typeof data.uid !== "string" || typeof data.org !== "string") return null;
    if (typeof data.exp !== "number" || data.exp * 1000 <= now) return null;
    return data;
  } catch {
    return null;
  }
}

export const DEMO_COOKIE_MAX_AGE = MAX_AGE_SECONDS;
