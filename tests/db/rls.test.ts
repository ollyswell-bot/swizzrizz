import { describe, it, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDatabase, createAuthUser, actAs } from "./pglite-helpers";

const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";

describe("database tenant isolation (Row Level Security)", () => {
  let db: PGlite;
  let aliceOrg: string;
  let bobOrg: string;
  let aliceCreator: string;
  let aliceConversation: string;

  beforeAll(async () => {
    db = await createDatabase();
    await createAuthUser(db, ALICE, "alice@example.com");
    await createAuthUser(db, BOB, "bob@example.com");

    await actAs(db, ALICE);
    aliceOrg = (await db.query<{ id: string }>("select public.create_organization('Alice Agency') as id")).rows[0].id;
    aliceCreator = (await db.query<{ id: string }>("select id from public.creators where organization_id = $1", [aliceOrg])).rows[0].id;
    const fan = await db.query<{ id: string }>(
      "insert into public.fans (organization_id, creator_id, alias) values ($1, $2, 'fan_one') returning id",
      [aliceOrg, aliceCreator],
    );
    const conv = await db.query<{ id: string }>(
      "insert into public.conversations (organization_id, creator_id, fan_id, operator_id, title) values ($1, $2, $3, $4, 'secret chat') returning id",
      [aliceOrg, aliceCreator, fan.rows[0].id, ALICE],
    );
    aliceConversation = conv.rows[0].id;
    await db.query(
      "insert into public.messages (organization_id, conversation_id, position, sender, body) values ($1, $2, 0, 'fan', 'hello there')",
      [aliceOrg, aliceConversation],
    );

    await actAs(db, BOB);
    bobOrg = (await db.query<{ id: string }>("select public.create_organization('Bob Agency') as id")).rows[0].id;
  });

  it("bootstraps an organization with an owner, a creator and the default voice", async () => {
    await actAs(db, ALICE);
    const voices = await db.query<{ name: string; is_default: boolean }>(
      "select name, is_default from public.creator_voices where organization_id = $1", [aliceOrg],
    );
    expect(voices.rows).toEqual([{ name: "Playful Creator", is_default: true }]);
    const role = await db.query<{ role: string }>("select role from public.organization_members where user_id = $1", [ALICE]);
    expect(role.rows[0].role).toBe("owner");
  });

  it("hides another organization's fans, conversations and messages", async () => {
    await actAs(db, BOB);
    for (const table of ["fans", "conversations", "messages", "creators", "creator_voices", "organizations"]) {
      const rows = await db.query<{ organization_id?: string; id: string }>(`select * from public.${table}`);
      const leaked = rows.rows.filter((r) => (r.organization_id ?? r.id) === aliceOrg);
      expect(leaked, `${table} leaked`).toHaveLength(0);
    }
  });

  it("rejects writes into another organization", async () => {
    await actAs(db, BOB);
    await expect(
      db.query("insert into public.fans (organization_id, creator_id, alias) values ($1, $2, 'intruder')", [aliceOrg, aliceCreator]),
    ).rejects.toThrow();
  });

  it("cannot point a row at another tenant's parent record", async () => {
    await actAs(db, BOB);
    await expect(
      db.query(
        "insert into public.messages (organization_id, conversation_id, position, body) values ($1, $2, 5, 'x')",
        [bobOrg, aliceConversation],
      ),
    ).rejects.toThrow();
  });

  it("silently affects zero rows when updating or deleting another tenant's data", async () => {
    await actAs(db, BOB);
    const upd = await db.query("update public.conversations set title = 'pwned' where id = $1", [aliceConversation]);
    expect(upd.affectedRows ?? 0).toBe(0);
    const del = await db.query("delete from public.messages where conversation_id = $1", [aliceConversation]);
    expect(del.affectedRows ?? 0).toBe(0);

    await actAs(db, ALICE);
    const still = await db.query<{ title: string }>("select title from public.conversations where id = $1", [aliceConversation]);
    expect(still.rows[0].title).toBe("secret chat");
  });

  it("does not let a member escalate their own role", async () => {
    await actAs(db, ALICE);
    await db.query("reset role");
    await db.query(
      "insert into public.organization_members (organization_id, user_id, role) values ($1, $2, 'viewer')",
      [aliceOrg, BOB],
    );
    await actAs(db, BOB);
    const res = await db.query(
      "update public.organization_members set role = 'owner' where organization_id = $1 and user_id = $2",
      [aliceOrg, BOB],
    );
    expect(res.affectedRows ?? 0).toBe(0);
    // A viewer can read but not write operational data.
    await expect(
      db.query("insert into public.fans (organization_id, creator_id, alias) values ($1, $2, 'viewer_try')", [aliceOrg, aliceCreator]),
    ).rejects.toThrow();
    await db.query("reset role");
    await db.query("delete from public.organization_members where organization_id = $1 and user_id = $2", [aliceOrg, BOB]);
  });

  it("never records a copied reply as anything but observed activity", async () => {
    await actAs(db, ALICE);
    await expect(
      db.query(
        "insert into public.sales_events (organization_id, event_type, evidence, actor_id) values ($1, 'reply_copied', 'verified', $2)",
        [aliceOrg, ALICE],
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        "insert into public.sales_events (organization_id, event_type, evidence, actor_id) values ($1, 'purchase_confirmed', 'prediction', $2)",
        [aliceOrg, ALICE],
      ),
    ).rejects.toThrow();
  });

  it("deletes all conversation data for an organization on request", async () => {
    await actAs(db, ALICE);
    await db.query("select public.delete_organization_data($1)", [aliceOrg]);
    const left = await db.query("select 1 from public.messages where organization_id = $1", [aliceOrg]);
    expect(left.rows).toHaveLength(0);
    await actAs(db, BOB);
    await expect(db.query("select public.delete_organization_data($1)", [aliceOrg])).rejects.toThrow(/forbidden/);
  });
});
