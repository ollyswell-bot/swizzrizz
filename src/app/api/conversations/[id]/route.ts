import { requireAuth, getRepository } from "@/lib/auth/context";
import { HttpError, json, route } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const ctx = await requireAuth({ access: "read" });
  const conversation = await (await getRepository(ctx)).getConversation(id);
  if (!conversation) throw new HttpError(404, "not_found", "Conversation not found.");
  return json({ conversation });
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const ctx = await requireAuth();
  const repo = await getRepository(ctx);
  if (!(await repo.deleteConversation(id))) throw new HttpError(404, "not_found", "Conversation not found.");
  await repo.audit("conversation.deleted", "conversation", id);
  return json({ ok: true });
});
