import { requireAuth, getRepository } from "@/lib/auth/context";
import { SettingsSchema } from "@/lib/domain/schemas";
import { json, parseBody, route } from "@/lib/http";

export const PATCH = route(async (req: Request) => {
  const ctx = await requireAuth({ access: "admin", consent: false });
  const body = await parseBody(req, SettingsSchema);
  const repo = await getRepository(ctx);
  const settings = await repo.updateSettings(body);
  await repo.audit("settings.updated", "organization", ctx.orgId, { retentionHours: body.retentionHours });
  return json({ settings });
});
