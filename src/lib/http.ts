import "server-only";
import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { AIProviderError } from "@/lib/ai/provider";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function jsonError(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status, headers: { "cache-control": "no-store" } });
}

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

export async function parseBody<T>(req: Request, schema: ZodType<T>, maxBytes = 512 * 1024): Promise<T> {
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > maxBytes) throw new HttpError(413, "payload_too_large", "Request is too large.");
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "invalid_json", "Request body must be JSON.");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new HttpError(400, "invalid_request", first ? `${first.path.join(".") || "body"}: ${first.message}` : "Invalid request.");
  }
  return result.data;
}

/**
 * Wraps a route handler so every failure becomes a clean JSON error. Messages never
 * include request bodies, conversation text or provider responses.
 */
export function route<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof HttpError) return jsonError(err.status, err.code, err.message);
      if (err instanceof AIProviderError) {
        const status = err.code === "provider_refused" ? 422 : err.code === "invalid_output" ? 502 : 503;
        return jsonError(status, err.code, err.message, { retryable: err.retryable });
      }
      console.error("[swizzrizz] unhandled route error:", err instanceof Error ? err.name : "unknown");
      return jsonError(500, "internal_error", "Something went wrong. Please try again.", { retryable: true });
    }
  };
}
