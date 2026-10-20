export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly retryable: boolean,
  ) {
    super(message);
  }
}

/** fetch wrapper for the app's own API. Turns error bodies and network failures into ApiError. */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError("You appear to be offline. Check your connection and try again.", 0, "network", true);
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // non-JSON (e.g. a gateway timeout page)
  }
  if (!res.ok) {
    const err = (body as { error?: { message?: string; code?: string; retryable?: boolean } } | null)?.error;
    throw new ApiError(
      err?.message ?? (res.status >= 500 ? "The server had a problem. Try again." : "Request failed."),
      res.status,
      err?.code ?? "http_error",
      err?.retryable ?? (res.status >= 500 || res.status === 429),
    );
  }
  return body as T;
}

export function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}
