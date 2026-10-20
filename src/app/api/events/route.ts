import { requireAuth, getRepository } from "@/lib/auth/context";
import { EventSchema } from "@/lib/domain/schemas";
import { json, parseBody, route } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

/** Observed UI activity (a reply was copied, an offer was presented). Never a sale. */
export const POST = route(async (req: Request) => {
  const ctx = await requireAuth();
  enforceRateLimit(`events:${ctx.userId}`, 120);
  const body = await parseBody(req, EventSchema, 4096);
  await (await getRepository(ctx)).recordEvent({
    type: body.type,
    conversationId: body.conversationId ?? null,
    offerId: body.offerId ?? null,
    metadata: body.suggestionKind ? { kind: body.suggestionKind } : {},
  });
  return json({ ok: true });
});
