"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { ArrowRight, FlaskConical, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Notice } from "@/components/ui/misc";

interface Props {
  mode: "demo" | "supabase";
  misconfigured: string | null;
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
}

export function LoginForm({ mode, misconfigured, supabaseUrl, supabaseAnonKey }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  async function startDemo() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/demo", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error?.message ?? "Couldn't start the demo.");
      router.replace("/copilot");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the demo.");
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabaseUrl || !supabaseAnonKey) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
    const result = isSignUp
      ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/api/auth/callback` } })
      : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      setError(result.error.message);
      setBusy(false);
      return;
    }
    if (isSignUp && !result.data.session) {
      setInfo("Check your email to confirm your account, then sign in.");
      setBusy(false);
      return;
    }
    router.replace("/copilot");
    router.refresh();
  }

  if (misconfigured) {
    return <Notice tone="danger">{misconfigured}</Notice>;
  }

  if (mode === "demo") {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-3xl text-fg">Open the demo workspace</h1>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">
            No database or AI key is configured, so SwizzRizz runs in demo mode. You get a private, temporary workspace with
            sample data and a simulated AI that returns example output.
          </p>
        </div>
        <Notice tone="accent">
          <span className="flex items-start gap-2">
            <FlaskConical className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
            <span>Demo data lives in server memory and disappears when the server restarts. Don&apos;t upload real customer conversations in demo mode.</span>
          </span>
        </Notice>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button variant="primary" size="lg" onClick={startDemo} disabled={busy}>
          {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
          Enter demo workspace
          {!busy ? <ArrowRight aria-hidden /> : null}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-3xl text-fg">{isSignUp ? "Create your account" : "Sign in"}</h1>
        <p className="mt-2 text-sm text-fg-muted">For authorized account operators only.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete={isSignUp ? "new-password" : "current-password"}
          minLength={10}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {isSignUp ? <p className="text-xs text-fg-subtle">At least 10 characters.</p> : null}
      </div>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {info ? <Notice tone="accent">{info}</Notice> : null}
      <Button variant="primary" size="lg" type="submit" disabled={busy}>
        {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
        {isSignUp ? "Create account" : "Sign in"}
      </Button>
      <button type="button" className="text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline" onClick={() => setIsSignUp((v) => !v)}>
        {isSignUp ? "Already have an account? Sign in" : "New here? Create an account"}
      </button>
    </form>
  );
}
