"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, FlaskConical, Gauge, RefreshCw, Save, Sparkles, Tag, TriangleAlert } from "lucide-react";
import type { AnalysisResult, Tone } from "@/lib/domain/schemas";
import type { Voice } from "@/lib/domain/types";
import { copyText } from "@/lib/clipboard";
import { formatPrice } from "@/lib/offers";
import { cn, humanize } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label, Select } from "@/components/ui/input";
import { Notice, Progress, SectionLabel, Skeleton } from "@/components/ui/misc";
import { ACTION_LABELS, INTENT_LABELS } from "./labels";
import type { AsyncState } from "./copilot-workspace";

export interface Drafts {
  best: string;
  playful: string;
  warm: string;
}

interface Props {
  voices: Voice[];
  voiceId: string;
  onVoiceChange: (id: string) => void;
  tone: Tone;
  onToneChange: (t: Tone) => void;
  analysis: AnalysisResult | null;
  drafts: Drafts | null;
  setDrafts: (d: Drafts) => void;
  state: AsyncState;
  onAnalyze: () => void;
  canAnalyze: boolean;
  onCopied: (kind: keyof Drafts, text: string) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  aiMode: "live" | "mock";
}

const TONES: { value: Tone; label: string }[] = [
  { value: "balanced", label: "Balanced" },
  { value: "playful", label: "Playful" },
  { value: "warm", label: "Warm" },
];

function ReplyCard({
  label,
  kind,
  value,
  onChange,
  onCopied,
  primary,
}: {
  label: string;
  kind: keyof Drafts;
  value: string;
  onChange: (v: string) => void;
  onCopied: (kind: keyof Drafts, text: string) => void;
  primary?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const id = `reply-${kind}`;

  async function copy() {
    const result = await copyText(value);
    if (result === "failed") {
      const el = document.getElementById(id) as HTMLTextAreaElement | null;
      el?.focus();
      el?.select();
      toast.error("Couldn't access the clipboard. The text is selected, press Ctrl/⌘ C.");
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
    toast.success("Copied. Review it once more before you send.");
    onCopied(kind, value);
  }

  return (
    <div className={cn("rounded-xl border p-3.5 fade-up", primary ? "border-accent/30 bg-accent-soft" : "border-border bg-surface-2")}>
      <div className="mb-2 flex items-center justify-between">
        <label htmlFor={id} className={cn("text-[11px] font-medium uppercase tracking-[0.12em]", primary ? "text-accent" : "text-fg-subtle")}>
          {label}
        </label>
        <Button size="sm" variant={primary ? "primary" : "secondary"} onClick={copy} disabled={!value.trim()} aria-label={`Copy ${label.toLowerCase()}`}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={Math.min(6, Math.max(2, Math.ceil(value.length / 42)))}
        className="w-full resize-none rounded-md border border-transparent bg-transparent p-0.5 text-[15px] leading-relaxed text-fg hover:border-border focus:border-accent/50 focus:outline-none"
      />
    </div>
  );
}

export function RecommendationsPanel(props: Props) {
  const { voices, voiceId, onVoiceChange, tone, onToneChange, analysis, drafts, setDrafts, state, onAnalyze, canAnalyze, onCopied, onSave, saving, saved, aiMode } = props;
  const loading = state.status === "loading";

  return (
    <Card className="flex flex-col gap-5 p-5" aria-label="AI recommendations">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-medium text-fg">Recommendations</h2>
        {aiMode === "mock" ? (
          <Badge tone="warning" title="No AI key configured. Output is simulated.">
            <FlaskConical className="size-3" aria-hidden /> Demo AI
          </Badge>
        ) : (
          <Sparkles className="size-4 text-accent" aria-hidden />
        )}
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="voice">Creator voice</Label>
          <Select id="voice" value={voiceId} onChange={(e) => onVoiceChange(e.target.value)}>
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.isDefault ? " (default)" : ""}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-fg-muted" id="tone-label">Tone for the main reply</span>
          <div role="radiogroup" aria-labelledby="tone-label" className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-surface-2 p-1">
            {TONES.map((t) => (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={tone === t.value}
                onClick={() => onToneChange(t.value)}
                className={cn(
                  "rounded-md py-1.5 text-[13px] transition-colors",
                  tone === t.value ? "bg-surface-3 text-fg" : "text-fg-muted hover:text-fg",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <Button variant={analysis ? "secondary" : "primary"} onClick={onAnalyze} disabled={!canAnalyze || loading}>
          {analysis ? <RefreshCw aria-hidden className={cn(loading && "animate-spin")} /> : <Sparkles aria-hidden />}
          {analysis ? "Regenerate" : "Analyze conversation"}
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <Progress label="Reading the conversation and drafting replies…" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      ) : null}

      {state.status === "error" ? (
        <Notice tone="danger">
          <span className="flex flex-col gap-2">
            <span>{state.message}</span>
            {state.retryable ? (
              <Button size="sm" variant="secondary" onClick={onAnalyze} className="self-start">
                <RefreshCw aria-hidden /> Try again
              </Button>
            ) : null}
          </span>
        </Notice>
      ) : null}

      {!loading && !analysis && state.status !== "error" ? (
        <div className="rounded-xl border border-dashed border-border-strong px-4 py-8 text-center">
          <p className="font-display text-lg text-fg">Nothing drafted yet</p>
          <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">Review the transcript, then analyse. You&apos;ll get three drafts to edit and copy.</p>
        </div>
      ) : null}

      {!loading && analysis && drafts ? (
        <div className="flex flex-col gap-4">
          {analysis.warnings.length ? (
            <div className="flex flex-col gap-1.5 rounded-lg border border-warning/25 bg-warning-soft p-3" role="alert">
              {analysis.warnings.map((w) => (
                <p key={w} className="flex gap-2 text-xs leading-relaxed text-warning">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {w}
                </p>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col gap-1">
            <SectionLabel>Recommended next action</SectionLabel>
            <p className={cn("text-[15px] font-medium", analysis.recommended_action === "escalate_to_human" ? "text-danger" : "text-fg")}>
              {ACTION_LABELS[analysis.recommended_action]}
            </p>
          </div>

          <ReplyCard label="Best reply" kind="best" primary value={drafts.best} onChange={(v) => setDrafts({ ...drafts, best: v })} onCopied={onCopied} />
          <ReplyCard label="Playful" kind="playful" value={drafts.playful} onChange={(v) => setDrafts({ ...drafts, playful: v })} onCopied={onCopied} />
          <ReplyCard label="Warm" kind="warm" value={drafts.warm} onChange={(v) => setDrafts({ ...drafts, warm: v })} onCopied={onCopied} />

          {analysis.offer ? (
            <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-2 p-3.5">
              <Tag className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <div className="min-w-0 flex-1">
                <SectionLabel>Suggested offer</SectionLabel>
                <p className="mt-1 text-[14px] text-fg">{analysis.offer.title}</p>
                <p className="font-mono text-xs text-fg-muted">{formatPrice(analysis.offer.price_cents, analysis.offer.currency)} · from your approved catalog</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-fg-subtle">No offer suggested for this moment.</p>
          )}

          <dl className="grid grid-cols-2 gap-3 border-t border-border pt-4 text-[13px]">
            <div>
              <dt className="text-[11px] uppercase tracking-[0.12em] text-fg-subtle">Fan intent</dt>
              <dd className="mt-1 text-fg">{INTENT_LABELS[analysis.buying_intent]}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.12em] text-fg-subtle">Stage</dt>
              <dd className="mt-1 capitalize text-fg">{humanize(analysis.conversation_stage)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.12em] text-fg-subtle">Segment</dt>
              <dd className="mt-1 capitalize text-fg">{analysis.fan_segment}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1 text-[11px] uppercase tracking-[0.12em] text-fg-subtle">
                <Gauge className="size-3" aria-hidden /> Confidence
              </dt>
              <dd className="mt-1 font-mono text-fg">{Math.round(analysis.confidence * 100)}%</dd>
            </div>
          </dl>

          {analysis.purchase_signals.length ? (
            <div className="flex flex-col gap-1.5">
              <SectionLabel>Signals the AI noticed</SectionLabel>
              <ul className="flex flex-col gap-1">
                {analysis.purchase_signals.map((s) => (
                  <li key={s} className="text-xs leading-relaxed text-fg-muted">· {s}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <SectionLabel>Why</SectionLabel>
            <p className="text-[13px] leading-relaxed text-fg-muted">{analysis.reasoning}</p>
            <p className="text-[13px] leading-relaxed text-fg">
              <span className="text-fg-subtle">Next: </span>
              {analysis.next_step}
            </p>
            <p className="text-[11px] text-fg-subtle">AI assessment, not a fact about the fan. You decide what to send.</p>
          </div>

          <Button variant="outline" onClick={onSave} disabled={saving || saved}>
            {saved ? <Check aria-hidden /> : <Save aria-hidden />}
            {saved ? "Saved" : "Save conversation"}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
