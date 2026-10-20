import { z } from "zod";
import { getConfig } from "@/lib/config";
import { getSessionState } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HttpError, json, parseBody, route } from "@/lib/http";

const Body = z.object({
  organizationName: z.string().trim().min(1).max(120),
  creatorName: z.string().trim().min(1).max(120),
});

/** Creates the first workspace for a newly signed-up Supabase user. */
export const POST = route(async (req: Request) => {
  if (getConfig().dataMode !== "supabase") throw new HttpError(404, "not_found", "Not available in demo mode.");
  const body = await parseBody(req, Body);
  const state = await getSessionState();
  if (state.status === "anonymous") throw new HttpError(401, "unauthenticated", "Please sign in.");
  if (state.status === "ok") throw new HttpError(409, "already_member", "You already have a workspace.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_organization", {
    org_name: body.organizationName,
    creator_name: body.creatorName,
  });
  if (error) throw new HttpError(500, "create_failed", "Couldn't create the workspace.");
  return json({ organizationId: data });
});
