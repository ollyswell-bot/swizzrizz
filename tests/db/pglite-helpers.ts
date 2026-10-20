import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");

/** Minimal stand-in for the parts of Supabase the core migration relies on. */
const SUPABASE_STUB = `
  create schema if not exists auth;
  create table auth.users (id uuid primary key, email text);
  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create role authenticated nologin;
  create role anon nologin;
`;

export async function createDatabase() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    // Storage policies need the real Supabase storage schema; covered by manual checklist.
    if (file.includes("storage")) continue;
    await db.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
  }
  await db.exec(`
    grant usage on schema public, auth to authenticated;
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant execute on all functions in schema public to authenticated;
    grant execute on function auth.uid() to authenticated;
  `);
  return db;
}

export async function createAuthUser(db: PGlite, id: string, email: string) {
  await db.query("reset role");
  await db.query("insert into auth.users (id, email) values ($1, $2)", [id, email]);
}

/** Switch the session to an authenticated Supabase user so RLS applies. */
export async function actAs(db: PGlite, userId: string) {
  await db.query("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.query("set role authenticated");
}
