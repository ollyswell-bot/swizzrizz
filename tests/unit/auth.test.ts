import "./cookie-jar";
import { describe, it, expect, beforeEach } from "vitest";
import { jar } from "./cookie-jar";
import { DEMO_COOKIE, decodeDemoSession, encodeDemoSession, newDemoSession } from "@/lib/auth/demo-session";
import { requireAuth } from "@/lib/auth/context";

const SECRET = process.env.DEMO_SESSION_SECRET!;

describe("demo session tokens", () => {
  it("round-trips a signed session", () => {
    const s = newDemoSession();
    expect(decodeDemoSession(encodeDemoSession(s, SECRET), SECRET)).toEqual(s);
  });

  it("gives every demo login its own organization", () => {
    expect(newDemoSession().org).not.toBe(newDemoSession().org);
  });

  it("rejects tampered, re-signed, malformed and expired tokens", () => {
    const s = newDemoSession();
    const token = encodeDemoSession(s, SECRET);
    const [payload, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...s, role: "owner", org: "victim" })).toString("base64url");
    expect(decodeDemoSession(`${forged}.${sig}`, SECRET)).toBeNull();
    expect(decodeDemoSession(encodeDemoSession(s, "another-secret-another-secret-123"), SECRET)).toBeNull();
    expect(decodeDemoSession(`${payload}`, SECRET)).toBeNull();
    expect(decodeDemoSession("", SECRET)).toBeNull();
    expect(decodeDemoSession(token, SECRET, (s.exp + 1) * 1000)).toBeNull();
  });
});

describe("route authorization", () => {
  beforeEach(() => jar.clear());

  it("rejects anonymous requests", async () => {
    await expect(requireAuth()).rejects.toMatchObject({ status: 401 });
  });

  it("requires the authorization confirmation before processing conversations", async () => {
    jar.set(DEMO_COOKIE, encodeDemoSession(newDemoSession(), SECRET));
    await expect(requireAuth()).rejects.toMatchObject({ status: 403, code: "authorization_required" });
    await expect(requireAuth({ consent: false })).resolves.toMatchObject({ mode: "demo" });
  });

  it("enforces roles", async () => {
    jar.set(DEMO_COOKIE, encodeDemoSession({ ...newDemoSession(), role: "viewer", consent: true }, SECRET));
    await expect(requireAuth({ access: "read" })).resolves.toMatchObject({ role: "viewer" });
    await expect(requireAuth({ access: "write" })).rejects.toMatchObject({ status: 403 });
    jar.set(DEMO_COOKIE, encodeDemoSession({ ...newDemoSession(), role: "operator", consent: true }, SECRET));
    await expect(requireAuth({ access: "admin" })).rejects.toMatchObject({ status: 403 });
  });
});
