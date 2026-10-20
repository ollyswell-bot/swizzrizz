"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/misc";

const ITEMS = [
  {
    key: "authorized",
    label:
      "I am authorized by the creator (and their agency, where applicable) to read and help respond to these conversations, and I will follow the platform's terms of service.",
  },
  {
    key: "adultsOnly",
    label:
      "Every creator and fan in conversations I process is 18 or older. I will stop and escalate if anything suggests otherwise.",
  },
  {
    key: "aiProcessing",
    label:
      "I understand screenshots and transcripts are sent to an AI provider for analysis, that suggestions can be wrong, and that I review every reply before sending it myself.",
  },
] as const;

export function ConsentGate({ dataMode, aiMode }: { dataMode: "demo" | "supabase"; aiMode: "live" | "mock" }) {
  const router = useRouter();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const all = ITEMS.every((i) => checked[i.key]);

  async function confirm() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/consent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ authorized: true, adultsOnly: true, aiProcessing: true }),
    });
    if (!res.ok) {
      setError((await res.json()).error?.message ?? "Couldn't save your confirmation.");
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 py-8 fade-up">
      <ShieldCheck className="size-6 text-accent" aria-hidden />
      <div>
        <h1 className="font-display text-[34px] leading-tight text-fg">Before you start</h1>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          SwizzRizz processes private conversations. Confirm the following to continue. Your confirmation is recorded in the audit log.
        </p>
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">Confirmations</legend>
        {ITEMS.map((item) => (
          <label
            key={item.key}
            className="flex cursor-pointer gap-3 rounded-xl border border-border bg-surface p-4 text-[13px] leading-relaxed text-fg-muted transition-colors hover:border-border-strong has-[:checked]:border-accent/40 has-[:checked]:text-fg"
          >
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
              checked={Boolean(checked[item.key])}
              onChange={(e) => setChecked((c) => ({ ...c, [item.key]: e.target.checked }))}
            />
            {item.label}
          </label>
        ))}
      </fieldset>
      {aiMode === "live" ? (
        <Notice>
          Before production use, confirm your AI provider&apos;s usage policy and data-retention terms permit processing these screenshots.
        </Notice>
      ) : null}
      {dataMode === "demo" ? <Notice tone="warning">Demo workspace: use sample screenshots, not real customer conversations.</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Button variant="primary" size="lg" disabled={!all || busy} onClick={confirm}>
        Confirm and continue
      </Button>
    </div>
  );
}
