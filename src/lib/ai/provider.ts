import "server-only";
import { getConfig } from "@/lib/config";
import { mockAnalyze, mockExtract } from "./mock";
import type { AnalysisPromptInput } from "./prompts";
import type { Voice } from "@/lib/domain/types";

export interface ImageInput {
  mime: "image/png" | "image/jpeg" | "image/webp";
  base64: string;
}

export interface AnalyzeCall {
  system: string;
  user: string;
  /** Structured input, used by the mock provider to stay deterministic. */
  structured: AnalysisPromptInput & { voice: Voice };
}

export interface AIProvider {
  mode: "live" | "mock";
  model: string;
  extract(system: string, images: ImageInput[], pageIndex: number): Promise<unknown>;
  analyze(call: AnalyzeCall): Promise<unknown>;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly code: "provider_unavailable" | "provider_refused" | "invalid_output" | "timeout",
    public readonly retryable: boolean,
  ) {
    super(message);
  }
}

/** Pulls the first JSON object out of a model response, tolerating code fences. */
export function parseJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) throw new AIProviderError("No JSON object in model output", "invalid_output", true);
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new AIProviderError("Model output was not valid JSON", "invalid_output", true);
  }
}

type AnthropicContent =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

class AnthropicProvider implements AIProvider {
  mode = "live" as const;
  constructor(
    private readonly apiKey: string,
    public readonly model: string,
  ) {}

  private async call(system: string, content: AnthropicContent[], maxTokens: number): Promise<unknown> {
    let res: Response;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: maxTokens,
          temperature: 0.4,
          system,
          messages: [{ role: "user", content }],
        }),
        // Stays under the 30-second serverless limit on Netlify so the operator gets a clean retry.
        signal: AbortSignal.timeout(Number(process.env.AI_TIMEOUT_MS ?? 25_000)),
        cache: "no-store",
      });
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "TimeoutError";
      throw new AIProviderError(
        timedOut ? "The AI provider took too long to respond." : "Couldn't reach the AI provider.",
        timedOut ? "timeout" : "provider_unavailable",
        true,
      );
    }
    if (!res.ok) {
      // Never log the request body: it contains customer conversation data.
      const retryable = res.status === 429 || res.status >= 500;
      throw new AIProviderError(`AI provider returned ${res.status}`, "provider_unavailable", retryable);
    }
    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
      stop_reason?: string;
    };
    if (data.stop_reason === "refusal") {
      throw new AIProviderError("The AI provider declined to process this content.", "provider_refused", false);
    }
    const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n");
    return parseJsonObject(text);
  }

  extract(system: string, images: ImageInput[]) {
    const content: AnthropicContent[] = [];
    images.forEach((img, i) => {
      content.push({ type: "text", text: `Screenshot ${i + 1}:` });
      content.push({ type: "image", source: { type: "base64", media_type: img.mime, data: img.base64 } });
    });
    content.push({ type: "text", text: "Transcribe the conversation in this screenshot. Return only the JSON object." });
    return this.call(system, content, 4000);
  }

  analyze(call: AnalyzeCall) {
    return this.call(call.system, [{ type: "text", text: call.user }], 1500);
  }
}

class MockProvider implements AIProvider {
  mode = "mock" as const;
  model = "demo-mock-v1";
  async extract(_system: string, _images: ImageInput[], pageIndex: number) {
    return mockExtract(pageIndex);
  }
  async analyze(call: AnalyzeCall) {
    return mockAnalyze(call.structured);
  }
}

export function getAIProvider(): AIProvider {
  const config = getConfig();
  if (config.aiMode === "live" && config.anthropicApiKey) {
    return new AnthropicProvider(config.anthropicApiKey, config.aiModel);
  }
  return new MockProvider();
}

export { MockProvider };
