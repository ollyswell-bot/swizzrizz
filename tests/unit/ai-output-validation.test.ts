import { describe, it, expect } from "vitest";
import { AnalysisOutputSchema, ExtractionOutputSchema } from "@/lib/domain/schemas";
import { parseJsonObject } from "@/lib/ai/provider";
import { output } from "./helpers";

describe("AI output validation", () => {
  it("accepts a well-formed analysis", () => {
    expect(AnalysisOutputSchema.safeParse(output()).success).toBe(true);
  });

  it("rejects out-of-range confidence, unknown enums and missing fields", () => {
    expect(AnalysisOutputSchema.safeParse(output({ confidence: 1.4 })).success).toBe(false);
    expect(AnalysisOutputSchema.safeParse({ ...output(), recommended_action: "sell_hard" }).success).toBe(false);
    const { best_reply: _drop, ...missing } = output();
    void _drop;
    expect(AnalysisOutputSchema.safeParse(missing).success).toBe(false);
  });

  it("requires exactly one playful and one warm alternative", () => {
    expect(AnalysisOutputSchema.safeParse(output({ alternatives: [{ tone: "playful", message: "a" }, { tone: "playful", message: "b" }] })).success).toBe(false);
    expect(AnalysisOutputSchema.safeParse(output({ alternatives: [{ tone: "warm", message: "a" }] })).success).toBe(false);
  });

  it("requires a real uuid for a recommended offer", () => {
    expect(AnalysisOutputSchema.safeParse(output({ recommended_offer_id: "offer-123" })).success).toBe(false);
  });

  it("rejects empty or overlong replies", () => {
    expect(AnalysisOutputSchema.safeParse(output({ best_reply: "   " })).success).toBe(false);
    expect(AnalysisOutputSchema.safeParse(output({ best_reply: "x".repeat(601) })).success).toBe(false);
  });

  it("validates extraction output", () => {
    const ok = { messages: [{ sender: "fan", text: "hi", timestamp: null, uncertain: false }], unreadable_sections: 0, notes: null, safety: { possible_minor: false, not_a_conversation: false } };
    expect(ExtractionOutputSchema.safeParse(ok).success).toBe(true);
    expect(ExtractionOutputSchema.safeParse({ ...ok, messages: [{ sender: "bot", text: "hi", timestamp: null, uncertain: false }] }).success).toBe(false);
    expect(ExtractionOutputSchema.safeParse({ ...ok, safety: undefined }).success).toBe(false);
  });

  it("parses JSON from fenced or chatty model responses and rejects non-JSON", () => {
    expect(parseJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonObject('Here you go: {"a":{"b":2}} thanks')).toEqual({ a: { b: 2 } });
    expect(() => parseJsonObject("no json here")).toThrow();
    expect(() => parseJsonObject("{broken")).toThrow();
  });
});
