import { cookies } from "next/headers";
import { z } from "zod";
import { getConfig } from "@/lib/config";
import { requireAuth, getRepository } from "@/lib/auth/context";
import { DEMO_COOKIE, DEMO_COOKIE_MAX_AGE, decodeDemoSession, encodeDemoSession } from "@/lib/auth/demo-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HttpError, json, parseBody, route } from "@/lib/http";

const ConsentSchema = z.object({
  authorized: z.literal(true),
  adultsOnly: z.literal(true),
  aiProcessing: z.literal(true),
});

/** Records the operator's authorization, adults-only and AI-processing confirmations. */
export const POST = route(async (req: Request) => {
  await parseBody(req, ConsentSchema);
  const ctx = await requireAuth({ access: "read", consent: false });
  const config = getConfig();

  if (ctx.mode === "demo") {
    const store = await cookies();
    const session = decodeDemoSession(store.get(DEMO_COOKIE)?.value, config.demoSessionSecret);
    if (!session) throw new HttpError(401, "unauthenticated", "Please sign in.");
    store.set(DEMO_COOKIE, encodeDemoSession({ ...session, consent: true }, config.demoSessionSecret), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" && process.env.SWIZZRIZZ_INSECURE_COOKIES !== "1",
      path: "/",
      maxAge: DEMO_COOKIE_MAX_AGE,
    });
  } else {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("confirm_authorization", { org: ctx.orgId });
    if (error) throw new HttpError(500, "consent_failed", "Couldn't save your confirmation.");
  }

  const repo = await getRepository({ ...ctx, authorizationConfirmed: true });
  await repo.audit("authorization.confirmed", "organization_member", ctx.userId);
  return json({ ok: true });
});
