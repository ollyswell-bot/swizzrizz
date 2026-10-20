import "server-only";
import { createHash } from "node:crypto";

export type DataMode = "demo" | "supabase";
export type AIMode = "live" | "mock";

export interface AppConfig {
  dataMode: DataMode;
  aiMode: AIMode;
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  supabaseServiceRoleKey: string | null;
  anthropicApiKey: string | null;
  aiModel: string;
  demoSessionSecret: string;
  demoSecretIsFallback: boolean;
  maxUploadBytes: number;
  maxImagesPerRequest: number;
  defaultRetentionHours: number;
  cronSecret: string | null;
  fanIdPepper: string | null;
}

function intEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Reads configuration at request time. Missing credentials switch the app into demo
 * mode (in-memory data, mocked AI) instead of failing. SWIZZRIZZ_FORCE_DEMO=1 forces it
 * for tests.
 */
export function getConfig(): AppConfig {
  const force = process.env.SWIZZRIZZ_FORCE_DEMO === "1";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || null;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || null;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY || null;
  const isProd = process.env.NODE_ENV === "production";

  const dataMode: DataMode = !force && supabaseUrl && supabaseAnonKey ? "supabase" : "demo";
  const aiMode: AIMode = !force && anthropicApiKey ? "live" : "mock";

  // Demo sessions are signed with DEMO_SESSION_SECRET when it's set (whitespace from
  // copy-paste is ignored). Without it, a key derived from the site is used so demo mode
  // still starts. Demo workspaces hold only sample data, and each one has a random,
  // unguessable id, so this fallback is acceptable for demos only. Settings shows a notice.
  const rawSecret = (process.env.DEMO_SESSION_SECRET ?? "").trim();
  const demoSecretIsFallback = rawSecret.length === 0;
  const demoSessionSecret = demoSecretIsFallback
    ? createHash("sha256")
        .update(`swizzrizz-demo:${process.env.SITE_ID ?? process.env.URL ?? (isProd ? "production" : "local")}`)
        .digest("hex")
    : rawSecret.length >= 32
      ? rawSecret
      : createHash("sha256").update(`swizzrizz-demo-short:${rawSecret}`).digest("hex");

  return {
    dataMode,
    aiMode,
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || null,
    anthropicApiKey: aiMode === "live" ? anthropicApiKey : null,
    aiModel: process.env.AI_MODEL || "claude-sonnet-5-5",
    demoSessionSecret,
    demoSecretIsFallback,
    maxUploadBytes: intEnv("MAX_UPLOAD_MB", 10, 1, 20) * 1024 * 1024,
    maxImagesPerRequest: intEnv("MAX_IMAGES_PER_REQUEST", 8, 1, 20),
    defaultRetentionHours: intEnv("SCREENSHOT_RETENTION_HOURS", 24, 0, 720),
    cronSecret: process.env.CRON_SECRET || null,
    fanIdPepper: process.env.FAN_ID_PEPPER || null,
  };
}
