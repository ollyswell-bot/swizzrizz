import { requireAuth } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HttpError, json, route } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

/** Issues a 60-second signed URL for a stored screenshot the caller's org owns. */
export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const ctx = await requireAuth({ access: "read" });
  if (ctx.mode !== "supabase") throw new HttpError(404, "not_found", "Screenshots aren't stored in demo mode.");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("screenshots")
    .select("storage_path, expires_at, deleted_at")
    .eq("id", id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!data || data.deleted_at || new Date(data.expires_at) <= new Date() || data.storage_path === "not-stored") {
    throw new HttpError(404, "not_found", "Screenshot not found or expired.");
  }
  const signed = await supabase.storage.from("screenshots").createSignedUrl(data.storage_path, 60);
  if (signed.error) throw new HttpError(500, "sign_failed", "Couldn't create a link.");
  return json({ url: signed.data.signedUrl, expiresIn: 60 });
});
