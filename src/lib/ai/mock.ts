/**
 * DEMO MODE ONLY. Deterministic stand-ins for the vision and reply models, used when
 * no AI key is configured and in automated tests. Output is clearly labelled in the UI
 * ("Demo AI") and in the reasoning text. It does not read the uploaded image.
 */
import type { AnalysisOutput, ExtractionOutput } from "@/lib/domain/schemas";
import type { AnalysisPromptInput } from "./prompts";
import type { Voice } from "@/lib/domain/types";
import { detectInjection } from "./injection";

const SAMPLE_PAGES: ExtractionOutput["messages"][] = [
  [
    { sender: "fan", text: "heyy just subscribed, your last post was amazing", timestamp: "9:41 PM", uncertain: false },
    { sender: "creator", text: "omg welcome!! that's so sweet of you", timestamp: "9:43 PM", uncertain: false },
    { sender: "fan", text: "haha of course. been following you for a while on insta", timestamp: "9:44 PM", uncertain: false },
  ],
  [
    { sender: "creator", text: "aww no way, what made you finally join?", timestamp: "9:46 PM", uncertain: false },
    { sender: "fan", text: "honestly the beach set. do you have more like that?", timestamp: "9:48 PM", uncertain: false },
    { sender: "fan", text: "would love to see more", timestamp: null, uncertain: true },
  ],
];

export function mockExtract(pageIndex: number): ExtractionOutput {
  return {
    messages: SAMPLE_PAGES[pageIndex % SAMPLE_PAGES.length],
    unreadable_sections: 0,
    notes: "Demo mode: this is a sample transcript. Screenshots are not read until an AI key is configured.",
    safety: { possible_minor: false, not_a_conversation: false },
  };
}

const SIGNAL_WORDS = /\b(more|another|unlock|price|how much|buy|send|set|video|pics?|photos?|content|exclusive|custom|bundle|ppv)\b/i;
const NEGATIVE_WORDS = /\b(no thanks|not interested|too expensive|can'?t afford|broke|stop|unsubscrib|leave me|refund)\b/i;
const DISTRESS_WORDS = /\b(depressed|suicid|hurt myself|lonely|nobody cares|want to die|crying)\b/i;
const MINOR_WORDS = /\b(i'?m 1[0-7]\b|high school|middle school|my mom won'?t|grade [6-9]\b|ninth grade|tenth grade)/i;

/** Applies the voice's casing and emoji habits. {title} is filled in after casing so offer names keep theirs. */
function styleText(text: string, voice: Voice, emoji: string, title = ""): string {
  const cased = /lowercase/i.test(voice.vocabulary) ? text.toLowerCase() : text;
  const lower = cased.replace("{title}", title);
  const withEmoji =
    voice.emojiFrequency === "none" ? lower : voice.emojiFrequency === "low" ? `${lower} ${emoji}` : `${lower} ${emoji}${emoji}`;
  return withEmoji.trim();
}

export function mockAnalyze(input: AnalysisPromptInput & { voice: Voice }): AnalysisOutput {
  const fanMessages = input.messages.filter((m) => m.sender === "fan");
  const last = fanMessages.at(-1)?.text ?? input.messages.at(-1)?.text ?? "";
  const allFanText = fanMessages.map((m) => m.text).join(" ");
  const signals = fanMessages
    .filter((m) => SIGNAL_WORDS.test(m.text) && !detectInjection(m.text))
    .map((m) => `fan said: "${m.text.slice(0, 80)}"`)
    .slice(0, 5);
  const v = input.voice;
  const segment = input.fan?.segment && input.fan.segment !== "unknown" ? input.fan.segment : input.fan ? "new" : "unknown";
  const base = {
    fan_segment: segment as AnalysisOutput["fan_segment"],
    purchase_signals: signals,
  };

  if (MINOR_WORDS.test(allFanText) || DISTRESS_WORDS.test(allFanText)) {
    return {
      ...base,
      buying_intent: "none",
      conversation_stage: "unknown",
      confidence: 0.6,
      recommended_action: "escalate_to_human",
      purchase_signals: [],
      best_reply: "hey, thanks for telling me that. i want to make sure you're okay. take care of yourself",
      alternatives: [
        { tone: "playful", message: "hey, i'm going to step back from this chat for now. take care" },
        { tone: "warm", message: "thank you for sharing that with me. please reach out to someone you trust" },
      ],
      recommended_offer_id: null,
      reasoning:
        "Demo mode: the conversation contains signs that need a human decision (possible distress or a possible minor). No sales or flirtatious content is suggested.",
      next_step: "Stop selling. A lead operator should review this conversation before anything else is sent.",
    };
  }

  if (NEGATIVE_WORDS.test(last)) {
    return {
      ...base,
      buying_intent: "none",
      conversation_stage: "objection",
      confidence: 0.7,
      recommended_action: "no_sale",
      best_reply: styleText("totally get it, no pressure at all. how's your week going?", v, "😊"),
      alternatives: [
        { tone: "playful", message: styleText("all good! i'll just keep being cute for free then", v, "😌") },
        { tone: "warm", message: styleText("no worries at all, i'm just happy you're here", v, "🤍") },
      ],
      recommended_offer_id: null,
      reasoning: "Demo mode: the fan declined or raised a cost concern. Respect it and keep the relationship good without pitching.",
      next_step: "Keep chatting casually. Don't revisit offers in this conversation.",
    };
  }

  const interested = SIGNAL_WORDS.test(last) || signals.length >= 2;
  const offer = interested ? input.offers[0] ?? null : null;

  if (offer) {
    const price = (offer.priceCents / 100).toFixed(offer.priceCents % 100 === 0 ? 0 : 2);
    return {
      ...base,
      buying_intent: "medium",
      conversation_stage: "interest",
      confidence: 0.66,
      recommended_action: "present_offer",
      best_reply: styleText(`haha you have good taste. i actually put together "{title}", want me to send it? it's $${price}`, v, "😏", offer.title),
      alternatives: [
        { tone: "playful", message: styleText(`ohh so you're a fan of that one huh. i might have something you'd like, want to see?`, v, "👀") },
        { tone: "warm", message: styleText(`that makes me so happy you liked it. i have "{title}" if you want more like that`, v, "🤍", offer.title) },
      ],
      recommended_offer_id: offer.id,
      reasoning: `Demo mode: the fan asked for more of a specific kind of content, which is a clear interest signal. "${offer.title}" is the lowest-priced eligible offer that fits.`,
      next_step: "Present the offer once. If they hesitate, return to conversation without pushing.",
    };
  }

  return {
    ...base,
    buying_intent: interested ? "low" : "unknown",
    conversation_stage: input.messages.length <= 2 ? "opening" : "engagement",
    confidence: 0.55,
    recommended_action: interested ? "ask_question" : "continue_conversation",
    best_reply: styleText("haha i love that. so what do you like doing when you're not here?", v, "😏"),
    alternatives: [
      { tone: "playful", message: styleText("okay you're kind of trouble, i can tell. what are you up to tonight?", v, "😈") },
      { tone: "warm", message: styleText("that's really sweet, thank you. how's your day been?", v, "🤍") },
    ],
    recommended_offer_id: null,
    reasoning: input.offers.length
      ? "Demo mode: no clear purchase signal yet. Build rapport before mentioning any offer."
      : "Demo mode: there are no eligible offers for this fan, so the suggestion keeps the conversation going without a pitch.",
    next_step: "Ask one question and learn what they enjoy.",
  };
}
