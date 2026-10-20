"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Notice } from "@/components/ui/misc";

export function OnboardingForm() {
  const router = useRouter();
  const [organizationName, setOrg] = useState("");
  const [creatorName, setCreator] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organizationName, creatorName }),
    });
    if (!res.ok) {
      setError((await res.json()).error?.message ?? "Couldn't create the workspace.");
      setBusy(false);
      return;
    }
    router.replace("/copilot");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-3xl text-fg">Set up your workspace</h1>
        <p className="mt-2 text-sm text-fg-muted">You&apos;ll be the owner. You can add creators and teammates later.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="org">Agency or workspace name</Label>
        <Input id="org" required maxLength={120} value={organizationName} onChange={(e) => setOrg(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="creator">First creator (name or alias)</Label>
        <Input id="creator" required maxLength={120} value={creatorName} onChange={(e) => setCreator(e.target.value)} />
      </div>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Button variant="primary" size="lg" type="submit" disabled={busy}>
        Create workspace
      </Button>
    </form>
  );
}
