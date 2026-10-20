"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Save, Star, Trash2 } from "lucide-react";
import type { VoiceInput } from "@/lib/domain/schemas";
import type { Creator, Voice } from "@/lib/domain/types";
import { api, jsonInit } from "@/lib/api-client";
import { DEFAULT_VOICE } from "@/lib/voices";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Notice } from "@/components/ui/misc";

const lines = (v: string[]) => v.join("\n");
const parseLines = (v: string) => v.split("\n").map((s) => s.trim()).filter(Boolean);

function toInput(v: Voice): VoiceInput {
  const { id: _id, updatedAt: _u, ...rest } = v;
  void _id;
  void _u;
  return rest;
}

export function VoiceEditor({ initial, creators, canEdit }: { initial: Voice[]; creators: Creator[]; canEdit: boolean }) {
  const [voices, setVoices] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | "new">(initial.find((v) => v.isDefault)?.id ?? initial[0]?.id ?? "new");
  const selected = voices.find((v) => v.id === selectedId);
  const [form, setForm] = useState<VoiceInput>(selected ? toInput(selected) : { ...DEFAULT_VOICE, name: "", isDefault: false });
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  function select(id: string | "new") {
    if (dirty && !confirm("Discard unsaved changes?")) return;
    setSelectedId(id);
    const v = voices.find((x) => x.id === id);
    setForm(v ? toInput(v) : { ...DEFAULT_VOICE, name: "", creatorId: creators[0]?.id ?? null, isDefault: false });
    setDirty(false);
  }

  function set<K extends keyof VoiceInput>(key: K, value: VoiceInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const isNew = selectedId === "new";
      const res = await api<{ voice: Voice }>(isNew ? "/api/voices" : `/api/voices/${selectedId}`, jsonInit(isNew ? "POST" : "PUT", form));
      setVoices((list) => {
        const next = list.map((v) => (res.voice.isDefault ? { ...v, isDefault: false } : v));
        return isNew ? [...next, res.voice] : next.map((v) => (v.id === res.voice.id ? res.voice : v));
      });
      setSelectedId(res.voice.id);
      setDirty(false);
      toast.success("Voice saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (selectedId === "new" || !confirm("Delete this voice profile?")) return;
    setBusy(true);
    try {
      await api(`/api/voices/${selectedId}`, { method: "DELETE" });
      const remaining = voices.filter((v) => v.id !== selectedId);
      setVoices(remaining);
      setDirty(false);
      const next = remaining[0];
      setSelectedId(next?.id ?? "new");
      if (next) setForm(toInput(next));
      toast.success("Voice deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
      <nav aria-label="Voice profiles" className="flex flex-col gap-1">
        {voices.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => select(v.id)}
            aria-current={selectedId === v.id}
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] transition-colors",
              selectedId === v.id ? "bg-surface-3 text-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <span className="truncate">{v.name}</span>
            {v.isDefault ? <Star className="size-3.5 shrink-0 fill-accent text-accent" aria-label="Default" /> : null}
          </button>
        ))}
        {canEdit ? (
          <Button variant="ghost" size="sm" className="justify-start" onClick={() => select("new")}>
            <Plus aria-hidden /> New voice
          </Button>
        ) : null}
      </nav>

      <Card className="p-5 sm:p-6">
        {!canEdit ? <Notice className="mb-5">Only owners and admins can edit voices.</Notice> : null}
        <form onSubmit={save} className="flex flex-col gap-6">
          <fieldset disabled={!canEdit || busy} className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="v-name">Profile name</Label>
              <Input id="v-name" required maxLength={120} value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="v-creator">Creator</Label>
              <Select id="v-creator" value={form.creatorId ?? ""} onChange={(e) => set("creatorId", e.target.value || null)}>
                <option value="">Any creator</option>
                {creators.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="v-sales">Default sales style</Label>
              <Select id="v-sales" value={form.defaultSalesStyle} onChange={(e) => set("defaultSalesStyle", e.target.value as VoiceInput["defaultSalesStyle"])}>
                <option value="soft">Soft: rapport first, rarely pitches</option>
                <option value="balanced">Balanced</option>
                <option value="direct">Direct: names offers when there&apos;s interest</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="v-brand">Brand description</Label>
              <Textarea id="v-brand" maxLength={1000} value={form.brandDescription} onChange={(e) => set("brandDescription", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="v-tone">Tone</Label>
              <Input id="v-tone" maxLength={300} value={form.tone} onChange={(e) => set("tone", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="v-vocab">Vocabulary and style</Label>
              <Input id="v-vocab" maxLength={500} value={form.vocabulary} onChange={(e) => set("vocabulary", e.target.value)} />
              <p className="text-[11px] text-fg-subtle">Include &quot;lowercase&quot; for natural lowercase writing.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="v-emoji">Emoji frequency</Label>
              <Select id="v-emoji" value={form.emojiFrequency} onChange={(e) => set("emojiFrequency", e.target.value as VoiceInput["emojiFrequency"])}>
                <option value="none">None</option>
                <option value="low">Occasional</option>
                <option value="medium">Regular</option>
                <option value="high">Frequent</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="v-length">Typical message length</Label>
              <Select id="v-length" value={form.typicalLength} onChange={(e) => set("typicalLength", e.target.value as VoiceInput["typicalLength"])}>
                <option value="short">Short</option>
                <option value="medium">Medium</option>
                <option value="long">Long</option>
              </Select>
            </div>
            {(
              [
                ["approvedPhrases", "Approved phrases", "One per line"],
                ["prohibitedPhrases", "Prohibited phrases", "Drafts using these get flagged"],
                ["contentBoundaries", "Content boundaries", "Things the creator never does or says"],
                ["exampleMessages", "Example messages", "Real messages in this voice, one per line"],
              ] as const
            ).map(([key, label, hint]) => (
              <div key={key} className="flex flex-col gap-1.5">
                <Label htmlFor={`v-${key}`}>{label}</Label>
                <Textarea id={`v-${key}`} rows={4} value={lines(form[key])} onChange={(e) => set(key, parseLines(e.target.value))} />
                <p className="text-[11px] text-fg-subtle">{hint}</p>
              </div>
            ))}
            <label className="flex items-center gap-2.5 text-[13px] text-fg sm:col-span-2">
              <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={form.isDefault} onChange={(e) => set("isDefault", e.target.checked)} />
              Use as the default voice
            </label>
          </fieldset>
          {canEdit ? (
            <div className="flex items-center justify-between gap-3 border-t border-border pt-5">
              <div>{dirty ? <Badge tone="warning">Unsaved changes</Badge> : null}</div>
              <div className="flex gap-2">
                {selectedId !== "new" && voices.length > 1 ? (
                  <Button variant="danger" onClick={remove} disabled={busy}>
                    <Trash2 aria-hidden /> Delete
                  </Button>
                ) : null}
                <Button variant="primary" type="submit" disabled={busy || !form.name.trim()}>
                  <Save aria-hidden /> Save voice
                </Button>
              </div>
            </div>
          ) : null}
        </form>
        <p className="mt-6 text-[11px] leading-relaxed text-fg-subtle">
          Voices shape tone only. Every voice is also bound by the built-in rules: no invented offers, prices or scarcity, no claims
          of exclusivity or meeting in person, and escalation when something seems wrong.
        </p>
      </Card>
    </div>
  );
}
