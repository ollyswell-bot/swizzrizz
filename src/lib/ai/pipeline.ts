import "server-only";
import {
  AnalysisOutputSchema,
  ExtractionOutputSchema,
  type AnalysisResult,
  type ExtractionOutput,
  type Tone,
  type TranscriptMessage,
} from "@/lib/domain/schemas";
import type { Fan, Offer, Voice } from "@/lib/domain/types";
import { AIProviderError, type AIProvider, type ImageInput } from "./provider";
import { EXTRACTION_SYSTEM_PROMPT, buildAnalysisSystemPrompt, buildAnalysisUserPrompt } from "./prompts";
import { enforceGuardrails } from "./guardrails";
import { matchOffers } from "@/lib/offers";
import { detectInjection } from "./injection";
import { mergePages } from "@/lib/transcript";

async function withOneRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AIProviderError && !err.retryable) throw err;
    return fn();
  }
}

export interface ExtractionResult {
  messages: TranscriptMessage[];
  unreadableSections: number;
  notes: string | null;
  skippedImages: number[];
  flaggedInstructionCount: number;
  mode: "live" | "mock";
}

/** STEP A: screenshots → validated, ordered transcript. One call per image, merged in upload order. */
export async function runExtraction(provider: AIProvider, images: ImageInput[], firstPosition = 0): Promise<ExtractionResult> {
  const pages: ExtractionOutput[] = [];
  for (let i = 0; i < images.length; i++) {
    const page = await withOneRetry(async () => {
      const raw = await provider.extract(EXTRACTION_SYSTEM_PROMPT, [images[i]], firstPosition + i);
      const result = ExtractionOutputSchema.safeParse(raw);
      if (!result.success) throw new AIProviderError("Extraction output failed validation", "invalid_output", true);
      return result.data;
    });
    if (page.safety.possible_minor) {
      throw new AIProviderError(
        "This conversation may involve someone under 18. It can't be processed.",
        "provider_refused",
        false,
      );
    }
    pages.push(page);
  }

  const conversationPages = pages.filter((p) => !p.safety.not_a_conversation);
  const messages = mergePages(
    pages.map((p) => (p.safety.not_a_conversation ? [] : p.messages)),
  );
  if (conversationPages.length === 0 || messages.length === 0) {
    throw new AIProviderError("No conversation messages were found in these images.", "invalid_output", false);
  }

  const notes = pages.map((p) => p.notes).filter((n): n is string => Boolean(n));
  return {
    messages,
    unreadableSections: pages.reduce((n, p) => n + p.unreadable_sections, 0),
    notes: notes.length ? [...new Set(notes)].join(" ") : null,
    skippedImages: pages
      .map((p, i) => (p.safety.not_a_conversation ? i : -1))
      .filter((i) => i >= 0),
    flaggedInstructionCount: messages.filter((m) => detectInjection(m.text)).length,
    mode: provider.mode,
  };
}

export interface AnalysisContext {
  messages: TranscriptMessage[];
  tone: Tone;
  voice: Voice;
  creatorId: string;
  fan: Fan | null;
  offers: Offer[];
  now?: Date;
}

/** STEPS B–E: context → analysis → offer matching → reply drafts, all validated. */
export async function runAnalysis(provider: AIProvider, ctx: AnalysisContext): Promise<AnalysisResult> {
  const messages = ctx.messages.filter((m) => m.text.trim().length > 0);
  if (messages.length === 0) {
    throw new AIProviderError("The transcript is empty.", "invalid_output", false);
  }

  const eligible = matchOffers(
    ctx.offers,
    ctx.creatorId,
    ctx.fan
      ? { segment: ctx.fan.segment, purchaseCount: ctx.fan.purchaseCount, purchasedOfferIds: ctx.fan.purchasedOfferIds }
      : null,
    ctx.now,
  );

  const promptInput = {
    messages,
    tone: ctx.tone,
    offers: eligible,
    fan: ctx.fan
      ? {
          alias: ctx.fan.alias,
          segment: ctx.fan.segment,
          purchaseCount: ctx.fan.purchaseCount,
          contentPreferences: ctx.fan.contentPreferences,
          communicationBoundaries: ctx.fan.communicationBoundaries,
          approvedNotes: ctx.fan.approvedNotes,
          lastSummary: ctx.fan.lastSummary,
        }
      : null,
  };

  const output = await withOneRetry(async () => {
    const raw = await provider.analyze({
      system: buildAnalysisSystemPrompt(ctx.voice),
      user: buildAnalysisUserPrompt(promptInput),
      structured: { ...promptInput, voice: ctx.voice },
    });
    const result = AnalysisOutputSchema.safeParse(raw);
    if (!result.success) throw new AIProviderError("Analysis output failed validation", "invalid_output", true);
    return result.data;
  });

  const checked = enforceGuardrails(output, eligible, ctx.voice);
  const flagged = messages.filter((m) => detectInjection(m.text)).length;
  if (flagged > 0) {
    checked.warnings.unshift(
      `${flagged} message${flagged > 1 ? "s" : ""} in the transcript contain instruction-like text. They were treated as plain conversation.`,
    );
  }

  return {
    ...checked.output,
    warnings: checked.warnings,
    mode: provider.mode,
    model: provider.model,
    offer: checked.offer
      ? {
          id: checked.offer.id,
          title: checked.offer.title,
          price_cents: checked.offer.priceCents,
          currency: checked.offer.currency,
        }
      : null,
  };
}
