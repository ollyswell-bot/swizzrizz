import { requireAuth, getRepository } from "@/lib/auth/context";
import { CreateFanSchema } from "@/lib/domain/schemas";
import { HttpError, json, parseBody, route } from "@/lib/http";

export const GET = route(async (req: Request) => {
  const ctx = await requireAuth({ access: "read" });
  const creatorId = new URL(req.url).searchParams.get("creatorId") ?? undefined;
  return json({ fans: await (await getRepository(ctx)).listFans(creatorId) });
});

/** Creates a fan alias, or returns the existing one with the same alias. Never matches by guesswork. */
export const POST = route(async (req: Request) => {
  const ctx = await requireAuth();
  const body = await parseBody(req, CreateFanSchema);
  const repo = await getRepository(ctx);
  if (!(await repo.listCreators()).some((c) => c.id === body.creatorId)) {
    throw new HttpError(404, "creator_not_found", "Creator not found.");
  }
  const fan = await repo.createFan(body.creatorId, body.alias);
  await repo.audit("fan.created", "fan", fan.id);
  return json({ fan }, 201);
});
