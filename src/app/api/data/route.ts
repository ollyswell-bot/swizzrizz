import { z } from "zod";
import { requireAuth, getRepository } from "@/lib/auth/context";
import { json, parseBody, route } from "@/lib/http";

const Body = z.object({ confirm: z.literal("DELETE") });

/** Permanently deletes every conversation, message, screenshot, fan and activity event. */
export const DELETE = route(async (req: Request) => {
  await parseBody(req, Body);
  const ctx = await requireAuth({ access: "admin", consent: false });
  const repo = await getRepository(ctx);
  await repo.deleteAllConversationData();
  await repo.audit("data.deleted_all", "organization", ctx.orgId);
  return json({ ok: true });
});
