import { describe, it, expect } from "vitest";
import { DemoRepository } from "@/lib/data/demo-repository";
import { DEFAULT_VOICE, selectVoice } from "@/lib/voices";
import type { AuthContext } from "@/lib/domain/types";

const ctx = (): AuthContext => ({
  userId: crypto.randomUUID(), orgId: crypto.randomUUID(), role: "owner", email: null, authorizationConfirmed: true, mode: "demo",
});

describe("demo repository", () => {
  it("seeds labelled sample data per organization", async () => {
    const repo = new DemoRepository(ctx());
    expect((await repo.listOffers()).every((o) => o.isSample)).toBe(true);
    expect((await repo.listFans()).every((f) => f.isSample)).toBe(true);
    expect((await repo.listVoices())[0]).toMatchObject({ name: "Playful Creator", isDefault: true });
  });

  it("does not create duplicate fans for the same alias", async () => {
    const repo = new DemoRepository(ctx());
    const creator = (await repo.listCreators())[0];
    const a = await repo.createFan(creator.id, "Night_Owl");
    const b = await repo.createFan(creator.id, "night_owl");
    expect(a.id).toBe(b.id);
  });

  it("keeps exactly one default voice", async () => {
    const repo = new DemoRepository(ctx());
    const v = await repo.saveVoice(null, { ...DEFAULT_VOICE, name: "Sweet", isDefault: true });
    const voices = await repo.listVoices();
    expect(voices.filter((x) => x.isDefault).map((x) => x.id)).toEqual([v.id]);
  });

  it("returns copies so callers can't mutate stored data", async () => {
    const repo = new DemoRepository(ctx());
    const fans = await repo.listFans();
    fans[0].alias = "hacked";
    expect((await repo.listFans())[0].alias).not.toBe("hacked");
  });
});

describe("creator voice selection", () => {
  const v = (id: string, isDefault = false) => ({ ...DEFAULT_VOICE, id, isDefault, updatedAt: "" });
  it("uses the requested voice, then the default, then the first", () => {
    const list = [v("a"), v("b", true), v("c")];
    expect(selectVoice(list, "c")?.id).toBe("c");
    expect(selectVoice(list, "missing")?.id).toBe("b");
    expect(selectVoice([v("a"), v("c")], null)?.id).toBe("a");
    expect(selectVoice([], "a")).toBeNull();
  });
});

describe("demo mode on serverless hosts", () => {
  it("seeds identical sample ids on every server instance", async () => {
    const { resetDemoStore } = await import("@/lib/data/demo-repository");
    const c = ctx();
    const first = new DemoRepository(c);
    const ids = [(await first.listCreators())[0].id, (await first.listVoices())[0].id, (await first.listOffers())[0].id];
    resetDemoStore(); // simulates a request landing on a fresh instance
    const second = new DemoRepository(c);
    expect([(await second.listCreators())[0].id, (await second.listVoices())[0].id, (await second.listOffers())[0].id]).toEqual(ids);
    expect(ids[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const other = new DemoRepository(ctx());
    expect((await other.listCreators())[0].id).not.toBe(ids[0]);
  });
});
