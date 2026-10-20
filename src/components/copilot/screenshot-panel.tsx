"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, RotateCcw, ScanText, Sparkles, Trash2, TriangleAlert, X } from "lucide-react";
import type { TranscriptMessage } from "@/lib/domain/schemas";
import { readiness } from "@/lib/transcript";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Notice, Progress } from "@/components/ui/misc";
import { TranscriptEditor } from "./transcript-editor";
import type { AsyncState } from "./copilot-workspace";

export interface Shot {
  id: string;
  file: File;
  url: string;
  hash: string;
  name: string;
  previouslyAnalyzed: boolean;
}

interface Props {
  shots: Shot[];
  setShots: React.Dispatch<React.SetStateAction<Shot[]>>;
  onFiles: (files: File[]) => void;
  maxImages: number;
  onExtract: () => void;
  extractState: AsyncState;
  transcript: TranscriptMessage[];
  setTranscript: (t: TranscriptMessage[]) => void;
  notes: string[];
  onAnalyze: () => void;
  analyzing: boolean;
  onReset: () => void;
  aiMode: "live" | "mock";
  canWrite: boolean;
}

export function ScreenshotPanel(props: Props) {
  const { shots, setShots, onFiles, maxImages, onExtract, extractState, transcript, setTranscript, notes, onAnalyze, analyzing, onReset, aiMode, canWrite } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const extracting = extractState.status === "loading";
  const ready = readiness(transcript);

  // Paste screenshots from the clipboard anywhere on the page.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (files.length) {
        e.preventDefault();
        onFiles(files);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onFiles]);

  function move(id: string, dir: -1 | 1) {
    setShots((list) => {
      const i = list.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[13px] font-medium text-fg">Screenshots</h2>
            <p className="text-xs text-fg-subtle">Add them top to bottom, oldest message first.</p>
          </div>
          {shots.length || transcript.length ? (
            <Button variant="ghost" size="sm" onClick={onReset} disabled={extracting}>
              <RotateCcw aria-hidden /> Start over
            </Button>
          ) : null}
        </div>

        <div
          role="button"
          tabIndex={0}
          aria-label="Add screenshots. Drop files here, paste from the clipboard, or press Enter to browse."
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            onFiles(Array.from(e.dataTransfer.files));
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-9 text-center transition-colors",
            dragging ? "border-accent bg-accent-soft" : "border-border-strong hover:border-fg-subtle hover:bg-surface-2",
            !canWrite && "pointer-events-none opacity-50",
          )}
        >
          <ImagePlus className="size-5 text-fg-subtle" aria-hidden />
          <p className="text-sm text-fg">
            Drop screenshots, <span className="text-accent">browse</span>, or paste with{" "}
            <kbd className="rounded border border-border-strong px-1 font-mono text-[11px]">Ctrl/⌘ V</kbd>
          </p>
          <p className="text-xs text-fg-subtle">PNG, JPEG or WebP · up to {maxImages} images</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            hidden
            data-testid="file-input"
            onChange={(e) => {
              onFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </div>

        {shots.length ? (
          <ol className="mt-4 flex gap-3 overflow-x-auto pb-1" aria-label="Screenshot order">
            {shots.map((s, i) => (
              <li key={s.id} className="group relative w-28 shrink-0 fade-up">
                <div className="relative aspect-[9/16] overflow-hidden rounded-lg border border-border bg-surface-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, never leaves the browser */}
                  <img src={s.url} alt={`Screenshot ${i + 1}`} className="size-full object-cover object-top" />
                  <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white">{i + 1}</span>
                  {s.previouslyAnalyzed ? (
                    <span className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-warning" title="Already analysed this session">
                      seen
                    </span>
                  ) : null}
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <button type="button" className="rounded p-1 text-fg-subtle hover:text-fg disabled:opacity-30" onClick={() => move(s.id, -1)} disabled={i === 0 || extracting} aria-label={`Move screenshot ${i + 1} earlier`}>
                    <ArrowLeft className="size-3.5" />
                  </button>
                  <button type="button" className="rounded p-1 text-fg-subtle hover:text-danger" onClick={() => setShots((l) => l.filter((x) => x.id !== s.id))} disabled={extracting} aria-label={`Remove screenshot ${i + 1}`}>
                    <X className="size-3.5" />
                  </button>
                  <button type="button" className="rounded p-1 text-fg-subtle hover:text-fg disabled:opacity-30" onClick={() => move(s.id, 1)} disabled={i === shots.length - 1 || extracting} aria-label={`Move screenshot ${i + 1} later`}>
                    <ArrowRight className="size-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        ) : null}

        {extracting ? (
          <div className="mt-4">
            <Progress
              label={
                extractState.status === "loading" && extractState.total && extractState.total > 1
                  ? `Reading screenshot ${extractState.current} of ${extractState.total}…`
                  : "Reading the screenshot. This can take a few seconds."
              }
            />
          </div>
        ) : null}

        {extractState.status === "error" ? (
          <Notice tone="danger" className="mt-4">
            <span className="flex items-center justify-between gap-3">
              <span>{extractState.message}</span>
              {extractState.retryable ? (
                <Button size="sm" variant="secondary" onClick={onExtract}>
                  Retry
                </Button>
              ) : null}
            </span>
          </Notice>
        ) : null}

        {shots.length ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant={transcript.length ? "secondary" : "primary"} onClick={onExtract} disabled={extracting || !canWrite}>
              <ScanText aria-hidden /> {transcript.length ? "Re-extract" : "Extract conversation"}
            </Button>
            {aiMode === "mock" ? <span className="text-xs text-warning">Demo AI returns a sample transcript.</span> : null}
          </div>
        ) : null}
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[13px] font-medium text-fg">Transcript</h2>
            <p className="text-xs text-fg-subtle">Fix anything the AI misread. Only what&apos;s here is analysed.</p>
          </div>
          {transcript.length ? (
            <div className="flex gap-1.5">
              <Badge>{ready.usable} messages</Badge>
              {ready.uncertain ? <Badge tone="warning">{ready.uncertain} uncertain</Badge> : null}
              {ready.unknownSender ? <Badge tone="warning">{ready.unknownSender} unassigned</Badge> : null}
            </div>
          ) : null}
        </div>

        {notes.length ? (
          <ul className="mb-4 flex flex-col gap-1.5">
            {notes.map((n) => (
              <li key={n} className="flex gap-2 text-xs leading-relaxed text-fg-muted">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
                {n}
              </li>
            ))}
          </ul>
        ) : null}

        <TranscriptEditor transcript={transcript} setTranscript={setTranscript} onSubmit={onAnalyze} disabled={!canWrite} />

        {transcript.length ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-xs text-fg-subtle">
              {ready.lastIsFan ? "Ready to draft a reply to the fan's last message." : "The last message isn't from the fan. Replies will continue from there."}
              <span className="hidden sm:inline"> · Ctrl/⌘ Enter</span>
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setTranscript([])} disabled={analyzing}>
                <Trash2 aria-hidden /> Clear
              </Button>
              <Button variant="primary" onClick={onAnalyze} disabled={analyzing || !ready.usable || !canWrite}>
                <Sparkles aria-hidden /> Analyze conversation
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
