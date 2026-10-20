"use client";

import { ChevronDown, ChevronUp, MessageSquarePlus, ShieldAlert, X } from "lucide-react";
import type { Sender, TranscriptMessage } from "@/lib/domain/schemas";
import { assignSender, insertMessageAfter, moveMessage, removeMessage, updateText } from "@/lib/transcript";
import { detectInjection } from "@/lib/ai/injection";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const SENDERS: { value: Sender; label: string }[] = [
  { value: "fan", label: "Fan" },
  { value: "creator", label: "Creator" },
  { value: "unknown", label: "?" },
];

interface Props {
  transcript: TranscriptMessage[];
  setTranscript: (t: TranscriptMessage[]) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export function TranscriptEditor({ transcript, setTranscript, onSubmit, disabled }: Props) {
  if (transcript.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border-strong px-6 py-10 text-center">
        <p className="font-display text-xl text-fg">No transcript yet</p>
        <p className="max-w-xs text-[13px] leading-relaxed text-fg-muted">
          Extract one from screenshots, or type the conversation in yourself.
        </p>
        <Button variant="secondary" size="sm" disabled={disabled} onClick={() => setTranscript(insertMessageAfter([], null, "fan"))}>
          <MessageSquarePlus aria-hidden /> Add a message manually
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-2" aria-label="Conversation transcript, oldest first">
        {transcript.map((m, i) => {
          const flagged = detectInjection(m.text);
          const fromCreator = m.sender === "creator";
          return (
            <li
              key={m.id}
              className={cn(
                "group flex gap-2 rounded-xl border p-2.5 transition-colors",
                fromCreator ? "border-accent/15 bg-accent-soft/60 sm:ml-10" : "border-border bg-surface-2 sm:mr-10",
                m.uncertain && "border-warning/40",
              )}
            >
              <span className="w-5 shrink-0 pt-1.5 text-right font-mono text-[10px] text-fg-subtle">{i + 1}</span>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <div role="radiogroup" aria-label={`Sender of message ${i + 1}`} className="flex rounded-md border border-border bg-surface p-0.5">
                    {SENDERS.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        role="radio"
                        aria-checked={m.sender === s.value}
                        disabled={disabled}
                        onClick={() => setTranscript(assignSender(transcript, m.id, s.value))}
                        className={cn(
                          "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
                          m.sender === s.value ? "bg-surface-3 text-fg" : "text-fg-subtle hover:text-fg-muted",
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  {m.timestamp ? <span className="font-mono text-[10px] text-fg-subtle">{m.timestamp}</span> : null}
                  {m.uncertain ? <Badge tone="warning">uncertain</Badge> : null}
                  {m.edited ? <Badge>edited</Badge> : null}
                  {flagged ? (
                    <Badge tone="danger" title="This text looks like an instruction. It will be treated as plain conversation.">
                      <ShieldAlert className="size-3" aria-hidden /> instruction-like
                    </Badge>
                  ) : null}
                </div>
                <textarea
                  aria-label={`Message ${i + 1} text`}
                  value={m.text}
                  rows={Math.min(6, Math.max(1, Math.ceil(m.text.length / 70)))}
                  disabled={disabled}
                  placeholder="Message text"
                  onChange={(e) => setTranscript(updateText(transcript, m.id, e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      onSubmit();
                    }
                  }}
                  className="w-full resize-none rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[14px] leading-relaxed text-fg placeholder:text-fg-subtle hover:border-border focus:border-accent/50 focus:bg-surface focus:outline-none"
                />
              </div>
              <div className="flex shrink-0 flex-col items-center gap-0.5 opacity-60 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                <button type="button" aria-label={`Move message ${i + 1} up`} disabled={disabled || i === 0} onClick={() => setTranscript(moveMessage(transcript, m.id, -1))} className="rounded p-0.5 text-fg-subtle hover:text-fg disabled:opacity-30">
                  <ChevronUp className="size-3.5" />
                </button>
                <button type="button" aria-label={`Delete message ${i + 1}`} disabled={disabled} onClick={() => setTranscript(removeMessage(transcript, m.id))} className="rounded p-0.5 text-fg-subtle hover:text-danger">
                  <X className="size-3.5" />
                </button>
                <button type="button" aria-label={`Move message ${i + 1} down`} disabled={disabled || i === transcript.length - 1} onClick={() => setTranscript(moveMessage(transcript, m.id, 1))} className="rounded p-0.5 text-fg-subtle hover:text-fg disabled:opacity-30">
                  <ChevronDown className="size-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" disabled={disabled} onClick={() => setTranscript(insertMessageAfter(transcript, null, "fan"))}>
          <MessageSquarePlus aria-hidden /> Add fan message
        </Button>
        <Button variant="ghost" size="sm" disabled={disabled} onClick={() => setTranscript(insertMessageAfter(transcript, null, "creator"))}>
          <MessageSquarePlus aria-hidden /> Add creator message
        </Button>
      </div>
    </div>
  );
}
