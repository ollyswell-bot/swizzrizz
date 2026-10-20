import type { VoiceInput } from "@/lib/domain/schemas";
import type { Voice } from "@/lib/domain/types";

/** The default "Playful Creator" profile. Mirrored in create_organization() in the SQL migration. */
export const DEFAULT_VOICE: VoiceInput = {
  name: "Playful Creator",
  creatorId: null,
  brandDescription: "Warm, confident creator who keeps things light and fun.",
  tone: "Flirty, playful, teasing, warm, confident",
  vocabulary: "casual, natural lowercase, short sentences",
  emojiFrequency: "low",
  typicalLength: "short",
  approvedPhrases: ["haha", "tell me more", "you're sweet"],
  prohibitedPhrases: ["buy now", "limited time only", "last chance", "only for you"],
  contentBoundaries: ["no meetups", "no personal contact details", "no promises of exclusivity"],
  exampleMessages: ["haha you're trouble 😏 what are you up to tonight?", "okay that made me smile. tell me more"],
  defaultSalesStyle: "soft",
  isDefault: true,
};

/** Picks the voice to use: the requested one if it exists, else the org default, else the first. */
export function selectVoice(voices: Voice[], requestedId: string | null | undefined): Voice | null {
  if (requestedId) {
    const match = voices.find((v) => v.id === requestedId);
    if (match) return match;
  }
  return voices.find((v) => v.isDefault) ?? voices[0] ?? null;
}
