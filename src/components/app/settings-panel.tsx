"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, jsonInit } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Notice } from "@/components/ui/misc";

interface Props {
  retentionHours: number;
  isAdmin: boolean;
  dataMode: "demo" | "supabase";
  aiMode: "live" | "mock";
  aiModel: string;
  demoSecretMissing: boolean;
}

const RETENTION = [
  { value: 0, label: "Don't store screenshots (process and discard)" },
  { value: 1, label: "1 hour" },
  { value: 24, label: "24 hours" },
  { value: 72, label: "3 days" },
  { value: 168, label: "7 days" },
];

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-4 p-5 sm:p-6">
      <div>
        <h2 className="text-sm font-medium text-fg">{title}</h2>
        {description ? <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">{description}</p> : null}
      </div>
      {children}
    </Card>
  );
}

export function SettingsPanel({ retentionHours, isAdmin, dataMode, aiMode, aiModel, demoSecretMissing }: Props) {
  const router = useRouter();
  const [retention, setRetention] = useState(retentionHours);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveRetention() {
    setBusy(true);
    try {
      await api("/api/settings", jsonInit("PATCH", { retentionHours: retention }));
      toast.success("Retention updated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAll() {
    setBusy(true);
    try {
      await api("/api/data", jsonInit("DELETE", { confirm: "DELETE" }));
      try {
        sessionStorage.clear();
      } catch {}
      setConfirmText("");
      toast.success("All conversation data deleted.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Section title="Environment">
        <dl className="grid grid-cols-1 gap-3 text-[13px] sm:grid-cols-3">
          <div>
            <dt className="text-xs text-fg-subtle">Data</dt>
            <dd className="mt-1">{dataMode === "demo" ? <Badge tone="warning">Demo, in memory</Badge> : <Badge tone="success">Supabase</Badge>}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-subtle">AI</dt>
            <dd className="mt-1">{aiMode === "mock" ? <Badge tone="warning">Simulated</Badge> : <Badge tone="accent">Live</Badge>}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-subtle">Model</dt>
            <dd className="mt-1 font-mono text-xs text-fg">{aiModel}</dd>
          </div>
        </dl>
        {demoSecretMissing ? (
          <Notice tone="warning">
            DEMO_SESSION_SECRET isn&apos;t reaching the app, so demo sign-ins use a built-in key. That&apos;s fine for trying the demo.
            Set the variable before sharing the link widely.
          </Notice>
        ) : null}
      </Section>

      <Section title="Screenshot retention" description="How long uploaded screenshots are kept in private storage before automatic deletion. Transcripts you save are kept until you delete them.">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="retention">Keep screenshots for</Label>
            <Select id="retention" value={retention} disabled={!isAdmin || busy} onChange={(e) => setRetention(Number(e.target.value))}>
              {RETENTION.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </Select>
          </div>
          <Button onClick={saveRetention} disabled={!isAdmin || busy || retention === retentionHours}>Save</Button>
        </div>
        {dataMode === "demo" ? <p className="text-xs text-fg-subtle">Demo mode never stores image files.</p> : null}
      </Section>

      <Section title="Privacy">
        <ul className="flex flex-col gap-2 text-[13px] leading-relaxed text-fg-muted">
          <li>Screenshots and transcripts are confidential customer data, visible only to members of this workspace.</li>
          <li>Images go to the AI provider for transcription. Only the transcript you approve is used to draft replies.</li>
          <li>Activity logs record counts and IDs, never message text or images.</li>
          <li>Nothing is ever sent to fans by SwizzRizz. Every reply is copied and sent by a person.</li>
          <li>Conversations involving anyone under 18 must not be processed. The AI is instructed to stop if it sees signs of this.</li>
        </ul>
      </Section>

      <Section title="Delete all conversation data" description="Permanently removes every saved conversation, message, screenshot, fan alias and activity event in this workspace. Voices and offers stay.">
        {isAdmin ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="confirm-delete">Type DELETE to confirm</Label>
              <Input id="confirm-delete" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
            </div>
            <Button variant="danger" disabled={confirmText !== "DELETE" || busy} onClick={deleteAll}>
              Delete everything
            </Button>
          </div>
        ) : (
          <Notice>Only owners and admins can delete all data.</Notice>
        )}
      </Section>
    </div>
  );
}
