import type { Offer, Voice, Fan } from "@/lib/domain/types";
import type { TranscriptMessage, AnalysisOutput } from "@/lib/domain/schemas";
import { DEFAULT_VOICE } from "@/lib/voices";

export const CREATOR = "c0000000-0000-4000-8000-000000000001";

export function voice(over: Partial<Voice> = {}): Voice {
  return { ...DEFAULT_VOICE, creatorId: CREATOR, id: "v1", updatedAt: "2026-10-20T00:00:00Z", ...over };
}

export function offer(over: Partial<Offer> = {}): Offer {
  return {
    id: crypto.randomUUID(), creatorId: CREATOR, title: "Beach Set", description: "", priceCents: 2500, currency: "USD",
    category: "photo", includedContent: "", isActive: true, availableFrom: null, availableUntil: null,
    eligibility: {}, bundleOfferIds: [], isSample: false, ...over,
  };
}

export function fan(over: Partial<Fan> = {}): Fan {
  return {
    id: "f1", creatorId: CREATOR, alias: "mike", segment: "returning", approvedNotes: "", contentPreferences: [],
    communicationBoundaries: [], firstInteractionAt: null, lastInteractionAt: null, followUpStatus: "none",
    purchaseCount: 1, purchasedOfferIds: [], lastSummary: null, isSample: false, ...over,
  };
}

export function transcript(...pairs: [TranscriptMessage["sender"], string][]): TranscriptMessage[] {
  return pairs.map(([sender, text], i) => ({ id: `m${i + 1}`, sender, text, timestamp: null, uncertain: false, edited: false, sourceImage: 0 }));
}

export function output(over: Partial<AnalysisOutput> = {}): AnalysisOutput {
  return {
    fan_segment: "returning", buying_intent: "medium", conversation_stage: "interest", confidence: 0.7,
    recommended_action: "continue_conversation", purchase_signals: [],
    best_reply: "haha tell me more", alternatives: [{ tone: "playful", message: "ooh trouble" }, { tone: "warm", message: "that's sweet" }],
    recommended_offer_id: null, reasoning: "Building rapport.", next_step: "Ask a question.", ...over,
  };
}
