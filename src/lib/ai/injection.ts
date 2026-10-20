/**
 * Prompt-injection defenses for text that came out of a screenshot.
 *
 * Layered approach:
 * 1. Screenshot text is wrapped in tagged blocks and the system prompt says it is data.
 * 2. Characters that could close or forge those tags are neutralised.
 * 3. Instruction-like messages are flagged so the operator sees them, and the model is
 *    told which messages were flagged.
 * 4. Model output is schema-validated and post-checked by guardrails.ts, so even a
 *    successful injection can only produce a reply the operator still has to approve.
 */

const PATTERNS: RegExp[] = [
  /ignore (all |any |the )?(previous|prior|above|earlier) (instructions|prompts|messages|rules)/i,
  /disregard (all |any |the )?(previous|prior|above|system)/i,
  /\b(system|developer) (prompt|message|instructions?)\b/i,
  /\byou are now\b/i,
  /\bact as (an?|the) (ai|assistant|model|system)\b/i,
  /\bnew instructions?\b/i,
  /\bjailbreak\b|\bdan mode\b|\bdeveloper mode\b/i,
  /<\/?\s*(system|transcript|instructions?|assistant|user)\s*>/i,
  /\b(assistant|system)\s*:/i,
  /\breveal (your|the) (prompt|instructions|system)\b/i,
  /\boutput (the )?(json|following)\b.*\b(offer|price|discount)\b/i,
];

export function detectInjection(text: string): boolean {
  return PATTERNS.some((p) => p.test(text));
}

/** Neutralises tag delimiters and control characters so text can't break out of its block. */
export function sanitizeForPrompt(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[\u200b-\u200f\u2028-\u202e\u2060-\u2064\ufeff]/g, "")
    .replace(/</g, "\u2039")
    .replace(/>/g, "\u203a")
    .slice(0, 4000);
}
