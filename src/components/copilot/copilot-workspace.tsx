"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { AnalysisResult, Tone, TranscriptMessage } from "@/lib/domain/schemas";
import type { Creator, Fan, Offer, Voice } from "@/lib/domain/types";
import { api, ApiError, jsonInit } from "@/lib/api-client";
import { hashFile } from "@/lib/clipboard";
import { mergePages, readiness } from "@/lib/transcript";
import { detectInjection } from "@/lib/ai/injection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FanContextPanel } from "./fan-context-panel";
import { ScreenshotPanel, type Shot } from "./screenshot-panel";
import { RecommendationsPanel, type Drafts } from "./recommendations-panel";

export interface WorkspaceProps {
  creators: Creator[];
  voices: Voice[];
  fans: Fan[];
  offers: Offer[];
  aiMode: "live" | "mock";
  maxImages: number;
  maxBytes: number;
  canWrite: boolean;
}

export type AsyncState =
  | { status: "idle" }
  | { status: "loading"; current?: number; total?: number }
  | { status: "error"; message: string; retryable: boolean };

interface Persisted {
  creatorId: string;
  fanId: string | null;
  voiceId: string;
  tone: Tone;
  transcript: TranscriptMessage[];
  extractionNotes: string[];
  analysis: AnalysisResult | null;
  drafts: Drafts | null;
  savedConversationId: string | null;
}

const STORAGE_KEY = "swizzrizz.copilot.v1";
const SEEN_HASHES_KEY = "swizzrizz.copilot.hashes";

function load(): Partial<Persisted> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<Persisted>) : {};
  } catch {
    return {};
  }
}

function seenHashes(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SEEN_HASHES_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function subscribeDesktop(cb: () => void) {
  const mq = window.matchMedia("(min-width: 1280px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function errorState(err: unknown): AsyncState {
  if (err instanceof ApiError) return { status: "error", message: err.message, retryable: err.retryable };
  return { status: "error", message: "Something went wrong.", retryable: true };
}

export function CopilotWorkspace(props: WorkspaceProps) {
  const { creators, voices, offers, aiMode, maxImages, maxBytes, canWrite } = props;
  const [initial] = useState(load);
  const isDesktop = useSyncExternalStore(subscribeDesktop, () => window.matchMedia("(min-width: 1280px)").matches, () => true);

  const [fans, setFans] = useState<Fan[]>(props.fans);
  const [creatorId, setCreatorId] = useState(
    initial.creatorId && creators.some((c) => c.id === initial.creatorId) ? initial.creatorId : (creators[0]?.id ?? ""),
  );
  const [fanId, setFanId] = useState<string | null>(
    initial.fanId && props.fans.some((f) => f.id === initial.fanId) ? initial.fanId : null,
  );
  const defaultVoice = voices.find((v) => v.isDefault) ?? voices[0];
  const [voiceId, setVoiceId] = useState(
    initial.voiceId && voices.some((v) => v.id === initial.voiceId) ? initial.voiceId : (defaultVoice?.id ?? ""),
  );
  const [tone, setTone] = useState<Tone>(initial.tone ?? "balanced");
  const [shots, setShots] = useState<Shot[]>([]);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>(initial.transcript ?? []);
  const [extractionNotes, setExtractionNotes] = useState<string[]>(initial.extractionNotes ?? []);
  const [extractState, setExtractState] = useState<AsyncState>({ status: "idle" });
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(initial.analysis ?? null);
  const [drafts, setDrafts] = useState<Drafts | null>(initial.drafts ?? null);
  const [analyzeState, setAnalyzeState] = useState<AsyncState>({ status: "idle" });
  const [savedConversationId, setSavedConversationId] = useState<string | null>(initial.savedConversationId ?? null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("workspace");
  const lastCopied = useRef<string | null>(null);

  // Preserve unsaved work across reloads in this tab. Images are never persisted.
  useEffect(() => {
    const data: Persisted = { creatorId, fanId, voiceId, tone, transcript, extractionNotes, analysis, drafts, savedConversationId };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // storage full or blocked: edits still live in memory
    }
  }, [creatorId, fanId, voiceId, tone, transcript, extractionNotes, analysis, drafts, savedConversationId]);

  // Release object URLs when thumbnails go away.
  const shotsRef = useRef(shots);
  useEffect(() => {
    const prev = shotsRef.current;
    prev.filter((p) => !shots.some((s) => s.id === p.id)).forEach((p) => URL.revokeObjectURL(p.url));
    shotsRef.current = shots;
  }, [shots]);
  useEffect(() => () => shotsRef.current.forEach((s) => URL.revokeObjectURL(s.url)), []);

  const fan = fans.find((f) => f.id === fanId) ?? null;
  const creatorFans = fans.filter((f) => f.creatorId === creatorId);
  const creatorOffers = offers.filter((o) => o.creatorId === creatorId);

  const addFiles = useCallback(
    async (files: File[]) => {
      const images = files.filter((f) => /^image\/(png|jpe?g|webp)$/i.test(f.type));
      if (images.length < files.length) toast.error("Only PNG, JPEG and WebP screenshots are accepted.");
      const tooBig = images.filter((f) => f.size > maxBytes);
      if (tooBig.length) toast.error(`${tooBig.length} image${tooBig.length > 1 ? "s are" : " is"} over ${Math.round(maxBytes / 1048576)} MB.`);
      const ok = images.filter((f) => f.size <= maxBytes);
      const seen = seenHashes();
      const added: Shot[] = [];
      for (const file of ok) {
        const hash = await hashFile(file);
        added.push({
          id: crypto.randomUUID(),
          file,
          url: URL.createObjectURL(file),
          hash,
          name: file.name || "Pasted screenshot",
          previouslyAnalyzed: seen.has(hash),
        });
      }
      setShots((current) => {
        const next = [...current];
        for (const s of added) {
          if (next.some((n) => n.hash === s.hash)) {
            toast.warning("That screenshot is already in the list.");
            URL.revokeObjectURL(s.url);
            continue;
          }
          if (next.length >= maxImages) {
            toast.error(`Up to ${maxImages} screenshots per conversation.`);
            URL.revokeObjectURL(s.url);
            break;
          }
          next.push(s);
        }
        return next;
      });
      if (added.some((s) => s.previouslyAnalyzed)) {
        toast.warning("You've already analysed one of these screenshots in this session.");
      }
    },
    [maxBytes, maxImages],
  );

  // One request per screenshot keeps each call well inside serverless time limits
  // (Netlify functions stop at 30 seconds). Pages are merged here in upload order.
  async function extract() {
    if (!shots.length) return;
    type PageResult = {
      messages: TranscriptMessage[];
      notes: string | null;
      warnings: string[];
      unreadableSections: number;
      flaggedInstructionCount: number;
    };
    const pages: PageResult[] = [];
    const skipped: number[] = [];
    try {
      for (let i = 0; i < shots.length; i++) {
        setExtractState({ status: "loading", current: i + 1, total: shots.length });
        const form = new FormData();
        form.append("images", shots[i].file, shots[i].name);
        form.append("position", String(i));
        try {
          pages.push(await api<PageResult>("/api/extract", { method: "POST", body: form }));
        } catch (err) {
          // A screenshot that isn't a conversation is skipped; anything else stops the run.
          if (err instanceof ApiError && err.code === "invalid_output" && !err.retryable && shots.length > 1) {
            skipped.push(i);
            continue;
          }
          throw err;
        }
      }
      if (!pages.length) throw new ApiError("No conversation messages were found in these images.", 422, "invalid_output", false);

      const merged = mergePages(pages.map((p) => p.messages.map(({ sender, text, timestamp, uncertain }) => ({ sender, text, timestamp, uncertain }))));
      setTranscript(merged);
      const notes = [...new Set(pages.flatMap((p) => [...(p.notes ? [p.notes] : []), ...p.warnings]))];
      const unreadable = pages.reduce((n, p) => n + p.unreadableSections, 0);
      const flagged = merged.filter((m) => detectInjection(m.text)).length;
      if (unreadable) notes.push(`${unreadable} section(s) couldn't be read. Check the screenshots and add anything missing.`);
      if (skipped.length) notes.push(`Screenshot ${skipped.map((i) => i + 1).join(", ")} didn't look like a conversation and was skipped.`);
      if (flagged) notes.push(`${flagged} message(s) contain instruction-like text. They'll be treated as plain conversation.`);
      setExtractionNotes(notes);
      setAnalysis(null);
      setDrafts(null);
      setSavedConversationId(null);
      try {
        const seen = seenHashes();
        shots.forEach((s) => seen.add(s.hash));
        sessionStorage.setItem(SEEN_HASHES_KEY, JSON.stringify([...seen].slice(-200)));
      } catch {}
      setExtractState({ status: "idle" });
      toast.success(`Extracted ${merged.length} messages. Review them before analysing.`);
    } catch (err) {
      setExtractState(errorState(err));
    }
  }

  async function analyze() {
    const ready = readiness(transcript);
    if (!ready.usable) {
      toast.error("Add at least one message to analyse.");
      return;
    }
    if (!creatorId || !voiceId) {
      toast.error("Choose a creator and voice first.");
      return;
    }
    setAnalyzeState({ status: "loading" });
    if (!isDesktop) setTab("replies");
    try {
      const result = await api<AnalysisResult>(
        "/api/analyze",
        jsonInit("POST", {
          creatorId,
          fanId,
          voiceId,
          tone,
          messages: transcript.filter((m) => m.text.trim().length > 0),
        }),
      );
      setAnalysis(result);
      setDrafts({
        best: result.best_reply,
        playful: result.alternatives.find((a) => a.tone === "playful")?.message ?? "",
        warm: result.alternatives.find((a) => a.tone === "warm")?.message ?? "",
      });
      setSavedConversationId(null);
      lastCopied.current = null;
      setAnalyzeState({ status: "idle" });
    } catch (err) {
      setAnalyzeState(errorState(err));
    }
  }

  function onCopied(kind: keyof Drafts, text: string) {
    lastCopied.current = text;
    void fetch("/api/events", jsonInit("POST", { type: "reply_copied", suggestionKind: kind, conversationId: savedConversationId })).catch(() => {});
  }

  async function save() {
    if (!transcript.length) return;
    setSaving(true);
    try {
      const output = analysis
        ? {
            fan_segment: analysis.fan_segment,
            buying_intent: analysis.buying_intent,
            conversation_stage: analysis.conversation_stage,
            confidence: analysis.confidence,
            recommended_action: analysis.recommended_action,
            purchase_signals: analysis.purchase_signals,
            best_reply: analysis.best_reply,
            alternatives: analysis.alternatives,
            recommended_offer_id: analysis.recommended_offer_id,
            reasoning: analysis.reasoning,
            next_step: analysis.next_step,
          }
        : null;
      const res = await api<{ conversation: { id: string } }>(
        "/api/conversations",
        jsonInit("POST", {
          creatorId,
          fanId,
          title: fan ? `Chat with ${fan.alias}` : `Chat ${new Date().toLocaleDateString()}`,
          messages: transcript.filter((m) => m.text.trim().length > 0),
          analysis: output && analysis ? { output, mode: analysis.mode, model: analysis.model, chosenReply: lastCopied.current } : null,
        }),
      );
      setSavedConversationId(res.conversation.id);
      toast.success("Conversation saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  function resetAll() {
    setShots([]);
    setTranscript([]);
    setExtractionNotes([]);
    setAnalysis(null);
    setDrafts(null);
    setSavedConversationId(null);
    setExtractState({ status: "idle" });
    setAnalyzeState({ status: "idle" });
    setTab("workspace");
  }

  async function createFan(alias: string) {
    const res = await api<{ fan: Fan }>("/api/fans", jsonInit("POST", { creatorId, alias }));
    setFans((list) => (list.some((f) => f.id === res.fan.id) ? list : [...list, res.fan]));
    setFanId(res.fan.id);
    toast.success(`Fan "${res.fan.alias}" selected.`);
  }

  const context = (
    <FanContextPanel
      creators={creators}
      creatorId={creatorId}
      onCreatorChange={(id) => {
        setCreatorId(id);
        setFanId(null);
      }}
      fans={creatorFans}
      fan={fan}
      onFanChange={setFanId}
      onCreateFan={createFan}
      offers={creatorOffers}
      canWrite={canWrite}
    />
  );
  const workspace = (
    <ScreenshotPanel
      shots={shots}
      setShots={setShots}
      onFiles={addFiles}
      maxImages={maxImages}
      onExtract={extract}
      extractState={extractState}
      transcript={transcript}
      setTranscript={(t) => {
        setTranscript(t);
        setSavedConversationId(null);
      }}
      notes={extractionNotes}
      onAnalyze={analyze}
      analyzing={analyzeState.status === "loading"}
      onReset={resetAll}
      aiMode={aiMode}
      canWrite={canWrite}
    />
  );
  const replies = (
    <RecommendationsPanel
      voices={voices}
      voiceId={voiceId}
      onVoiceChange={setVoiceId}
      tone={tone}
      onToneChange={setTone}
      analysis={analysis}
      drafts={drafts}
      setDrafts={setDrafts}
      state={analyzeState}
      onAnalyze={analyze}
      canAnalyze={readiness(transcript).usable > 0 && canWrite}
      onCopied={onCopied}
      onSave={save}
      saving={saving}
      saved={Boolean(savedConversationId)}
      aiMode={aiMode}
    />
  );

  if (isDesktop) {
    return (
      <div className="grid items-start gap-5 xl:grid-cols-[280px_minmax(0,1fr)_380px]">
        <div className="sticky top-8">{context}</div>
        <div className="min-w-0">{workspace}</div>
        <div className="sticky top-8">{replies}</div>
      </div>
    );
  }

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList aria-label="Copilot panels">
        <TabsTrigger value="context">Fan</TabsTrigger>
        <TabsTrigger value="workspace">Screenshots</TabsTrigger>
        <TabsTrigger value="replies">Replies{analysis ? " ·" : ""}</TabsTrigger>
      </TabsList>
      <TabsContent value="context">{context}</TabsContent>
      <TabsContent value="workspace">{workspace}</TabsContent>
      <TabsContent value="replies">{replies}</TabsContent>
    </Tabs>
  );
}
