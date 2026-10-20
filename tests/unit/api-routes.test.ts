import "./cookie-jar";
import { describe, it, expect, beforeEach } from "vitest";
import { jar } from "./cookie-jar";
import { DEMO_COOKIE, encodeDemoSession, newDemoSession } from "@/lib/auth/demo-session";
import { POST as extract } from "@/app/api/extract/route";
import { POST as analyze } from "@/app/api/analyze/route";
import { POST as saveConversation, GET as listConversations } from "@/app/api/conversations/route";
import { GET as getConversation, DELETE as deleteConversation } from "@/app/api/conversations/[id]/route";
import { POST as createFan } from "@/app/api/fans/route";
import { GET as listVoices } from "@/app/api/voices/route";
import { POST as recordEvent } from "@/app/api/events/route";
import { DELETE as deleteAll } from "@/app/api/data/route";
import { DemoRepository } from "@/lib/data/demo-repository";
import { pngBytes } from "../fixtures/images";
import type { TranscriptMessage } from "@/lib/domain/schemas";

const SECRET = process.env.DEMO_SESSION_SECRET!;

function signIn(consent = true) {
  const s = { ...newDemoSession(), consent };
  jar.set(DEMO_COOKIE, encodeDemoSession(s, SECRET));
  return s;
}
const post = (body: unknown) =>
  new Request("http://test/api", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

async function bootstrap() {
  const voices = (await (await listVoices()).json()).voices;
  const repoCtx = (s: ReturnType<typeof signIn>) =>
    new DemoRepository({ userId: s.uid, orgId: s.org, role: "owner", email: null, authorizationConfirmed: true, mode: "demo" });
  return { voices, repoCtx };
}

describe("API: screenshot → transcript → reply → save", () => {
  beforeEach(() => jar.clear());

  it("runs the full workflow in demo mode", async () => {
    const session = signIn();
    const { voices, repoCtx } = await bootstrap();
    const creators = await repoCtx(session).listCreators();

    const form = new FormData();
    form.append("images", new File([pngBytes(1170, 2532) as BlobPart], "a.png", { type: "image/png" }));
    form.append("images", new File([pngBytes(1170, 2533) as BlobPart], "b.png", { type: "image/png" }));
    const ex = await extract(new Request("http://test/api/extract", { method: "POST", body: form }));
    expect(ex.status).toBe(200);
    const extracted = await ex.json();
    expect(extracted.mode).toBe("mock");
    const messages: TranscriptMessage[] = extracted.messages;
    expect(messages.length).toBeGreaterThan(3);

    const fanRes = await createFan(post({ creatorId: creators[0].id, alias: "new_fan_01" }));
    const fan = (await fanRes.json()).fan;

    const an = await analyze(post({ creatorId: creators[0].id, fanId: fan.id, voiceId: voices[0].id, tone: "playful", messages }));
    expect(an.status).toBe(200);
    const result = await an.json();
    expect(result.alternatives).toHaveLength(2);

    const ev = await recordEvent(post({ type: "reply_copied", suggestionKind: "best" }));
    expect(ev.status).toBe(200);

    const saved = await saveConversation(
      post({
        creatorId: creators[0].id,
        fanId: fan.id,
        title: "Test chat",
        messages,
        analysis: { output: { ...result, warnings: undefined, mode: undefined, model: undefined, offer: undefined, voiceId: undefined }, mode: result.mode, model: result.model, chosenReply: result.best_reply },
      }),
    );
    expect(saved.status).toBe(201);
    const { conversation } = await saved.json();

    const stats = await repoCtx(session).getActivityStats();
    expect(stats).toMatchObject({ conversationsSaved: 1, analysesRun: 1, repliesCopied: 1 });

    const fetched = await getConversation(new Request("http://test"), params(conversation.id));
    expect((await fetched.json()).conversation.messages).toHaveLength(messages.length);
  });

  it("rejects a disguised non-image upload", async () => {
    signIn();
    const form = new FormData();
    form.append("images", new File(["<html><script>x</script></html>"], "shot.png", { type: "image/png" }));
    const res = await extract(new Request("http://test/api/extract", { method: "POST", body: form }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("unsupported_type");
  });

  it("skips an identical screenshot within the same batch with a warning", async () => {
    signIn();
    const form = new FormData();
    const bytes = pngBytes(1170, 2532);
    form.append("images", new File([bytes as BlobPart], "a.png", { type: "image/png" }));
    form.append("images", new File([bytes as BlobPart], "a-copy.png", { type: "image/png" }));
    const body = await (await extract(new Request("http://test/api/extract", { method: "POST", body: form }))).json();
    expect(body.warnings.join(" ")).toMatch(/identical/);
  });

  it("blocks processing until the operator confirms authorization", async () => {
    signIn(false);
    const form = new FormData();
    form.append("images", new File([pngBytes(500, 500) as BlobPart], "a.png", { type: "image/png" }));
    const res = await extract(new Request("http://test/api/extract", { method: "POST", body: form }));
    expect(res.status).toBe(403);
  });

  it("rejects malformed analysis requests", async () => {
    signIn();
    const res = await analyze(post({ creatorId: "x", voiceId: "y", tone: "aggressive", messages: [] }));
    expect(res.status).toBe(400);
  });
});

describe("API: tenant isolation", () => {
  beforeEach(() => jar.clear());

  it("never returns or deletes another organization's conversation", async () => {
    const alice = signIn();
    const { repoCtx } = await bootstrap();
    const aliceRepo = repoCtx(alice);
    const creator = (await aliceRepo.listCreators())[0];
    const saved = await aliceRepo.saveConversation({
      creatorId: creator.id, fanId: null, title: "alice private",
      messages: [{ id: "m1", sender: "fan", text: "secret", timestamp: null, uncertain: false, edited: false, sourceImage: 0 }],
      analysis: null,
    });

    signIn(); // bob, new org
    expect((await getConversation(new Request("http://test"), params(saved.id))).status).toBe(404);
    expect((await deleteConversation(new Request("http://test"), params(saved.id))).status).toBe(404);
    const list = await (await listConversations()).json();
    expect(list.conversations).toEqual([]);

    // Bob can't analyse against Alice's creator either.
    const voices = (await (await listVoices()).json()).voices;
    const res = await analyze(post({
      creatorId: creator.id, fanId: null, voiceId: voices[0].id, tone: "balanced",
      messages: [{ id: "m1", sender: "fan", text: "hi", timestamp: null, uncertain: false, edited: false, sourceImage: 0 }],
    }));
    expect(res.status).toBe(404);

    expect(await aliceRepo.getConversation(saved.id)).not.toBeNull();
  });
});

describe("API: data deletion", () => {
  beforeEach(() => jar.clear());

  it("deletes a single conversation", async () => {
    const s = signIn();
    const { repoCtx } = await bootstrap();
    const repo = repoCtx(s);
    const creator = (await repo.listCreators())[0];
    const saved = await repo.saveConversation({
      creatorId: creator.id, fanId: null, title: "", analysis: null,
      messages: [{ id: "m1", sender: "fan", text: "x", timestamp: null, uncertain: false, edited: false, sourceImage: 0 }],
    });
    expect((await deleteConversation(new Request("http://test"), params(saved.id))).status).toBe(200);
    expect(await repo.getConversation(saved.id)).toBeNull();
  });

  it("deletes all conversation data only with explicit confirmation", async () => {
    const s = signIn();
    const { repoCtx } = await bootstrap();
    const repo = repoCtx(s);
    const creator = (await repo.listCreators())[0];
    await repo.saveConversation({
      creatorId: creator.id, fanId: null, title: "", analysis: null,
      messages: [{ id: "m1", sender: "fan", text: "x", timestamp: null, uncertain: false, edited: false, sourceImage: 0 }],
    });
    const del = (body: unknown) => deleteAll(new Request("http://test", { method: "DELETE", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));
    expect((await del({ confirm: "yes" })).status).toBe(400);
    expect((await del({ confirm: "DELETE" })).status).toBe(200);
    expect(await repo.listConversations()).toEqual([]);
    expect(await repo.listFans()).toEqual([]);
    expect((await repo.getActivityStats()).repliesCopied).toBe(0);
  });
});
