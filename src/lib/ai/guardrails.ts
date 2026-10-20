import type { AnalysisOutput } from "@/lib/domain/schemas";
import type { Offer, Voice } from "@/lib/domain/types";

const SCARCITY = [
  /\blast chance\b/i,
  /\blimited time\b/i,
  /\bonly (today|tonight)\b/i,
  /\bexpires? (soon|tonight|today|in)\b/i,
  /\bhurry\b/i,
  /\bbefore it'?s gone\b/i,
  /\bonly \d+ (left|spots?)\b/i,
];

const FALSE_INTIMACY = [
  /\bonly (talking|chatting|texting) (to|with) you\b/i,
  /\byou'?re the only one\b/i,
  /\bmeet (up|in person|irl)\b/i,
  /\bmy (phone )?number is\b/i,
];

const PRICE = /(?:[$€£]\s?(\d+(?:[.,]\d{1,2})?))|(\d+(?:[.,]\d{1,2})?)\s?(?:usd|dollars|bucks|eur|gbp)\b/gi;

function replies(output: AnalysisOutput): string[] {
  return [output.best_reply, ...output.alternatives.map((a) => a.message)];
}

/**
 * Server-side checks on validated model output. The model is told these rules too,
 * but nothing here trusts it: offers are re-checked against the eligible list, and
 * risky language is surfaced as a warning to the operator before they copy anything.
 */
export function enforceGuardrails(
  output: AnalysisOutput,
  eligibleOffers: Offer[],
  voice: Voice,
): { output: AnalysisOutput; warnings: string[]; offer: Offer | null } {
  const warnings: string[] = [];
  const next: AnalysisOutput = { ...output, alternatives: output.alternatives.map((a) => ({ ...a })) };

  let offer: Offer | null = null;
  if (next.recommended_offer_id) {
    offer = eligibleOffers.find((o) => o.id === next.recommended_offer_id) ?? null;
    if (!offer) {
      warnings.push("The AI referenced an offer that isn't active or eligible. It was removed.");
      next.recommended_offer_id = null;
    }
  }
  if (!offer && next.recommended_action === "present_offer") {
    next.recommended_action = "continue_conversation";
    warnings.push("No eligible offer is available, so the recommendation was changed to continue the conversation.");
  }

  const prohibited = voice.prohibitedPhrases.map((p) => p.toLowerCase()).filter(Boolean);
  for (const text of replies(next)) {
    const lower = text.toLowerCase();
    const hit = prohibited.find((p) => lower.includes(p));
    if (hit) warnings.push(`A draft uses the prohibited phrase "${hit}". Edit before sending.`);
    if (SCARCITY.some((r) => r.test(text))) {
      warnings.push("A draft uses urgency or scarcity language. Only keep it if it's literally true.");
    }
    if (FALSE_INTIMACY.some((r) => r.test(text))) {
      warnings.push("A draft makes a personal claim (exclusivity, meeting, contact details). Remove it.");
    }
    for (const match of text.matchAll(PRICE)) {
      const amount = Number.parseFloat((match[1] ?? match[2] ?? "").replace(",", "."));
      if (!Number.isFinite(amount)) continue;
      const cents = Math.round(amount * 100);
      if (!offer || offer.priceCents !== cents) {
        warnings.push(`A draft mentions a price (${match[0].trim()}) that doesn't match an approved offer.`);
      }
    }
  }

  return { output: next, warnings: [...new Set(warnings)], offer };
}
