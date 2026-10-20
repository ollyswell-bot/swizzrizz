import { requireAuth, getRepository } from "@/lib/auth/context";
import { SaveConversationSchema } from "@/lib/domain/schemas";
import { HttpError, json, parseBody, route } from "@/lib/http";

export const GET = route(async () => {
  const ctx = await requireAuth({ access: "read" });
  return json({ conversations: await (await getRepository(ctx)).listConversations() });
});

export const POST = route(async (req: Request) => {
  const ctx = await requireAuth();
  const body = await parseBody(req, SaveConversationSchema, 1024 * 1024);
  const repo = await getRepository(ctx);
  if (!(await repo.listCreators()).some((c) => c.id === body.creatorId)) {
    throw new HttpError(404, "creator_not_found", "Creator not found.");
  }
  let fanId = body.fanId;
  if (fanId) {
    const fan = await repo.getFan(fanId);
    if (!fan || fan.creatorId !== body.creatorId) {
      // Demo data is per server instance; save without the link rather than lose the work.
      if (ctx.mode !== "demo") throw new HttpError(404, "fan_not_found", "Fan not found.");
      fanId = null;
    }
  }
  const conversation = await repo.saveConversation({ ...body, fanId });
  await repo.recordEvent({ type: "conversation_saved", conversationId: conversation.id });
  await repo.audit("conversation.saved", "conversation", conversation.id, { messages: body.messages.length });
  return json({ conversation }, 201);
});
