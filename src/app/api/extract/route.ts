import { createHash, randomUUID } from "node:crypto";
import { getConfig } from "@/lib/config";
import { requireAuth, getRepository } from "@/lib/auth/context";
import { HttpError, json, route } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { validateImage } from "@/lib/uploads/validate";
import { getAIProvider, type ImageInput } from "@/lib/ai/provider";
import { runExtraction } from "@/lib/ai/pipeline";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const maxDuration = 120;

const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as const;

/**
 * STEP A. Accepts screenshots as multipart "images" fields in conversation order.
 * Validates bytes, optionally keeps a short-lived private copy, and returns an
 * editable transcript. Nothing in the image is treated as an instruction.
 */
export const POST = route(async (req: Request) => {
  const ctx = await requireAuth();
  const config = getConfig();
  enforceRateLimit(`extract:${ctx.userId}`, 20);

  const declared = Number(req.headers.get("content-length") ?? 0);
  const ceiling = config.maxUploadBytes * config.maxImagesPerRequest + 64 * 1024;
  if (declared > ceiling) throw new HttpError(413, "payload_too_large", "Too much data in one request.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new HttpError(400, "invalid_form", "Upload must be multipart form data.");
  }
  const files = form.getAll("images").filter((f): f is File => f instanceof File);
  if (files.length === 0) throw new HttpError(400, "no_images", "Add at least one screenshot.");
  if (files.length > config.maxImagesPerRequest) {
    throw new HttpError(400, "too_many_images", `Up to ${config.maxImagesPerRequest} screenshots per conversation.`);
  }

  const repo = await getRepository(ctx);
  const settings = await repo.getSettings();
  const images: ImageInput[] = [];
  const hashes = new Set<string>();
  const warnings: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.size > config.maxUploadBytes) {
      throw new HttpError(400, "too_large", `Screenshot ${i + 1}: images must be ${config.maxUploadBytes / 1024 / 1024} MB or smaller.`);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const check = validateImage(bytes, file.type, config.maxUploadBytes);
    if (!check.ok) throw new HttpError(400, check.code, `Screenshot ${i + 1}: ${check.message}`);

    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (hashes.has(sha256)) {
      warnings.push(`Screenshot ${i + 1} is identical to an earlier one in this batch and was skipped.`);
      continue;
    }
    hashes.add(sha256);
    if (await repo.findScreenshotByHash(sha256)) {
      warnings.push(`Screenshot ${i + 1} was already uploaded recently. Check you aren't analysing the same chat twice.`);
    }

    const expiresAt = new Date(Date.now() + settings.retentionHours * 3600_000).toISOString();
    let storagePath = "not-stored";
    if (ctx.mode === "supabase" && settings.retentionHours > 0) {
      storagePath = `${ctx.orgId}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${EXT[check.mime]}`;
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.storage
        .from("screenshots")
        .upload(storagePath, bytes, { contentType: check.mime, upsert: false });
      if (error) throw new HttpError(500, "storage_failed", "Couldn't store the screenshot securely.");
    }
    await repo.recordScreenshot({
      storagePath,
      sha256,
      mime: check.mime,
      width: check.width,
      height: check.height,
      byteSize: check.byteSize,
      position: i,
      expiresAt,
    });

    images.push({ mime: check.mime, base64: Buffer.from(bytes).toString("base64") });
  }

  const provider = getAIProvider();
  // Position of the first image within the conversation, when the client sends screenshots one at a time.
  const position = Math.min(50, Math.max(0, Number.parseInt(String(form.get("position") ?? "0"), 10) || 0));
  const result = await runExtraction(provider, images, position);
  await repo.audit("screenshots.extracted", "screenshot", null, {
    images: images.length,
    messages: result.messages.length,
    mode: provider.mode,
  });

  return json({ ...result, warnings });
});
