import { timingSafeEqual } from "node:crypto";
import { getConfig } from "@/lib/config";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { json, jsonError } from "@/lib/http";

/**
 * Retention job. Deletes screenshot files whose retention window has passed.
 * Called hourly by netlify/functions/purge-screenshots.mts; authenticated with CRON_SECRET.
 */
export async function GET(req: Request) {
  const config = getConfig();
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${config.cronSecret ?? ""}`);
  if (!config.cronSecret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return jsonError(401, "unauthorized", "Unauthorized.");
  }
  if (config.dataMode !== "supabase") return json({ purged: 0, note: "demo mode stores no files" });

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("screenshots")
    .select("id, storage_path")
    .lte("expires_at", new Date().toISOString())
    .is("deleted_at", null)
    .limit(500);
  if (error) return jsonError(500, "purge_failed", "Couldn't list expired screenshots.");

  const rows = (data ?? []) as { id: string; storage_path: string }[];
  const paths = rows.map((r) => r.storage_path).filter((p) => p !== "not-stored");
  if (paths.length) {
    const removed = await admin.storage.from("screenshots").remove(paths);
    if (removed.error) return jsonError(500, "purge_failed", "Couldn't delete expired files.");
  }
  if (rows.length) {
    await admin
      .from("screenshots")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", rows.map((r) => r.id));
  }
  return json({ purged: rows.length });
}
