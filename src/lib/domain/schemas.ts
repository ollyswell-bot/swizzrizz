import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Transcript                                                          */
/* ------------------------------------------------------------------ */

export const SenderSchema = z.enum(["fan", "creator", "unknown"]);
export type Sender = z.infer<typeof SenderSchema>;

/** One message as returned by the vision model. */
export const ExtractedMessageSchema = z.object({
  sender: SenderSchema,
  text: z.string().trim().min(1).max(4000),
  timestamp: z.string().trim().max(64).nullable(),
  uncertain: z.boolean(),
});

export const ExtractionOutputSchema = z.object({
  messages: z.array(ExtractedMessageSchema).max(200),
  unreadable_sections: z.number().int().min(0).max(100),
  notes: z.string().max(500).nullable(),
  safety: z.object({
    possible_minor: z.boolean(),
    not_a_conversation: z.boolean(),
  }),
});
export type ExtractionOutput = z.infer<typeof ExtractionOutputSchema>;

/** One message in the operator-editable transcript. */
export const TranscriptMessageSchema = z.object({
  id: z.string().min(1).max(64),
  sender: SenderSchema,
  text: z.string().max(4000),
  timestamp: z.string().max(64).nullable(),
  uncertain: z.boolean(),
  edited: z.boolean(),
  sourceImage: z.number().int().min(0).max(50),
});
export type TranscriptMessage = z.infer<typeof TranscriptMessageSchema>;

/* ------------------------------------------------------------------ */
/* Analysis output contract                                            */
/* ------------------------------------------------------------------ */

export const FanSegmentSchema = z.enum(["new", "returning", "vip", "lapsed", "unknown"]);
export const BuyingIntentSchema = z.enum(["none", "low", "medium", "high", "unknown"]);
export const ConversationStageSchema = z.enum([
  "opening",
  "engagement",
  "rapport",
  "interest",
  "offer",
  "objection",
  "post_purchase",
  "closing",
  "unknown",
]);
export const RecommendedActionSchema = z.enum([
  "continue_conversation",
  "build_rapport",
  "ask_question",
  "present_offer",
  "follow_up_later",
  "no_sale",
  "escalate_to_human",
]);

export const ToneSchema = z.enum(["balanced", "playful", "warm"]);
export type Tone = z.infer<typeof ToneSchema>;

const ReplyText = z.string().trim().min(1).max(600);

export const AnalysisOutputSchema = z.object({
  fan_segment: FanSegmentSchema,
  buying_intent: BuyingIntentSchema,
  conversation_stage: ConversationStageSchema,
  confidence: z.number().min(0).max(1),
  recommended_action: RecommendedActionSchema,
  purchase_signals: z.array(z.string().max(160)).max(5),
  best_reply: ReplyText,
  alternatives: z
    .array(z.object({ tone: z.enum(["playful", "warm"]), message: ReplyText }))
    .length(2)
    .refine((a) => new Set(a.map((x) => x.tone)).size === 2, "alternatives must be one playful and one warm"),
  recommended_offer_id: z.uuid().nullable(),
  reasoning: z.string().trim().min(1).max(700),
  next_step: z.string().trim().min(1).max(300),
});
export type AnalysisOutput = z.infer<typeof AnalysisOutputSchema>;

/** What the server returns to the browser: the validated output plus server-side checks. */
export interface AnalysisResult extends AnalysisOutput {
  warnings: string[];
  mode: "live" | "mock";
  model: string;
  offer: { id: string; title: string; price_cents: number; currency: string } | null;
}

/* ------------------------------------------------------------------ */
/* Creator voice                                                       */
/* ------------------------------------------------------------------ */

const PhraseList = z.array(z.string().trim().min(1).max(200)).max(40);

export const VoiceInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  creatorId: z.string().max(64).nullable(),
  brandDescription: z.string().max(1000),
  tone: z.string().max(300),
  vocabulary: z.string().max(500),
  emojiFrequency: z.enum(["none", "low", "medium", "high"]),
  typicalLength: z.enum(["short", "medium", "long"]),
  approvedPhrases: PhraseList,
  prohibitedPhrases: PhraseList,
  contentBoundaries: PhraseList,
  exampleMessages: z.array(z.string().trim().min(1).max(500)).max(20),
  defaultSalesStyle: z.enum(["soft", "balanced", "direct"]),
  isDefault: z.boolean(),
});
export type VoiceInput = z.infer<typeof VoiceInputSchema>;

/* ------------------------------------------------------------------ */
/* API request bodies                                                  */
/* ------------------------------------------------------------------ */

export const AnalyzeRequestSchema = z.object({
  creatorId: z.string().min(1).max(64),
  fanId: z.string().min(1).max(64).nullable(),
  voiceId: z.string().min(1).max(64),
  tone: ToneSchema,
  messages: z.array(TranscriptMessageSchema).min(1).max(200),
});
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

export const SaveConversationSchema = z.object({
  creatorId: z.string().min(1).max(64),
  fanId: z.string().min(1).max(64).nullable(),
  title: z.string().trim().max(120),
  messages: z.array(TranscriptMessageSchema).min(1).max(200),
  analysis: z
    .object({
      output: AnalysisOutputSchema,
      mode: z.enum(["live", "mock"]),
      model: z.string().max(80),
      chosenReply: z.string().max(600).nullable(),
    })
    .nullable(),
});
export type SaveConversationInput = z.infer<typeof SaveConversationSchema>;

export const CreateFanSchema = z.object({
  creatorId: z.string().min(1).max(64),
  alias: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[\p{L}\p{N}_.\- ]+$/u, "Use letters, numbers, spaces, dots, dashes or underscores"),
});

export const EventSchema = z.object({
  type: z.enum(["reply_copied", "offer_presented"]),
  conversationId: z.string().max(64).nullable().optional(),
  suggestionKind: z.enum(["best", "playful", "warm"]).optional(),
  offerId: z.string().max(64).nullable().optional(),
});

export const SettingsSchema = z.object({
  retentionHours: z.number().int().min(0).max(720),
});
