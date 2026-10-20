import { requireAuth, getRepository } from "@/lib/auth/context";
import { VoiceInputSchema } from "@/lib/domain/schemas";
import { HttpError, json, parseBody, route } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const ctx = await requireAuth({ access: "admin" });
  const input = await parseBody(req, VoiceInputSchema);
  const repo = await getRepository(ctx);
  if (!(await repo.listVoices()).some((v) => v.id === id)) throw new HttpError(404, "not_found", "Voice not found.");
  const voice = await repo.saveVoice(id, input);
  await repo.audit("voice.updated", "creator_voice", id);
  return json({ voice });
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const ctx = await requireAuth({ access: "admin" });
  const repo = await getRepository(ctx);
  const voices = await repo.listVoices();
  if (voices.length <= 1) throw new HttpError(400, "last_voice", "Keep at least one voice profile.");
  if (!(await repo.deleteVoice(id))) throw new HttpError(404, "not_found", "Voice not found.");
  await repo.audit("voice.deleted", "creator_voice", id);
  return json({ ok: true });
});
