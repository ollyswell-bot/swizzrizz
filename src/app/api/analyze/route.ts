import { requireAuth, getRepository } from "@/lib/auth/context";
import { AnalyzeRequestSchema } from "@/lib/domain/schemas";
import { HttpError, json, parseBody, route } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getAIProvider } from "@/lib/ai/provider";
import { runAnalysis } from "@/lib/ai/pipeline";
import { selectVoice } from "@/lib/voices";

export const maxDuration = 60;

/** STEPS B–E. Loads only this org's creator, fan, voice and offers, then drafts replies. */
export const POST = route(async (req: Request) => {
  const ctx = await requireAuth();
  enforceRateLimit(`analyze:${ctx.userId}`, 30);
  const body = await parseBody(req, AnalyzeRequestSchema);
  const repo = await getRepository(ctx);

  const creators = await repo.listCreators();
  if (!creators.some((c) => c.id === body.creatorId)) throw new HttpError(404, "creator_not_found", "Creator not found.");

  const voice = selectVoice(await repo.listVoices(), body.voiceId);
  if (!voice) throw new HttpError(400, "no_voice", "Create a creator voice first.");

  const fan = body.fanId ? await repo.getFan(body.fanId) : null;
  // Demo data is per server instance, so a fan added on another instance may be missing here.
  // In demo mode, analyse without fan context instead of failing.
  if (body.fanId && ctx.mode !== "demo" && (!fan || fan.creatorId !== body.creatorId)) {
    throw new HttpError(404, "fan_not_found", "Fan not found for this creator.");
  }

  const offers = await repo.listOffers(body.creatorId);
  const result = await runAnalysis(getAIProvider(), {
    messages: body.messages,
    tone: body.tone,
    voice,
    creatorId: body.creatorId,
    fan,
    offers,
  });

  await repo.recordEvent({ type: "analysis_run", metadata: { messages: body.messages.length, mode: result.mode } });
  await repo.recordEvent({ type: "reply_generated", metadata: { drafts: 3 } });
  if (result.offer) await repo.recordEvent({ type: "offer_recommended", offerId: result.offer.id });

  return json({ ...result, voiceId: voice.id });
});
