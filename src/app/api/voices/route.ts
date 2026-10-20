import { requireAuth, getRepository } from "@/lib/auth/context";
import { VoiceInputSchema } from "@/lib/domain/schemas";
import { json, parseBody, route } from "@/lib/http";

export const GET = route(async () => {
  const ctx = await requireAuth({ access: "read", consent: false });
  return json({ voices: await (await getRepository(ctx)).listVoices() });
});

export const POST = route(async (req: Request) => {
  const ctx = await requireAuth({ access: "admin" });
  const input = await parseBody(req, VoiceInputSchema);
  const repo = await getRepository(ctx);
  const voice = await repo.saveVoice(null, input);
  await repo.audit("voice.created", "creator_voice", voice.id);
  return json({ voice }, 201);
});
