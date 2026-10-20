import { describe, it, expect } from "vitest";
import { validateImage, sniffImageType, readDimensions } from "@/lib/uploads/validate";
import { pngBytes, jpegBytes, webpBytes } from "../fixtures/images";

const MB10 = 10 * 1024 * 1024;

describe("screenshot file validation", () => {
  it("accepts PNG, JPEG and WebP by their real bytes", () => {
    expect(validateImage(pngBytes(1170, 2532), "image/png", MB10)).toMatchObject({ ok: true, mime: "image/png", width: 1170, height: 2532 });
    expect(validateImage(jpegBytes(1080, 1920), "image/jpeg", MB10)).toMatchObject({ ok: true, mime: "image/jpeg", width: 1080, height: 1920 });
    expect(validateImage(webpBytes(800, 1600), "image/webp", MB10)).toMatchObject({ ok: true, mime: "image/webp", width: 800, height: 1600 });
  });

  it("treats image/jpg as image/jpeg and accepts a missing declared type", () => {
    expect(validateImage(jpegBytes(500, 500), "image/jpg", MB10).ok).toBe(true);
    expect(validateImage(pngBytes(500, 500), "", MB10).ok).toBe(true);
  });

  it("rejects files whose bytes don't match the declared type", () => {
    expect(validateImage(pngBytes(500, 500), "image/jpeg", MB10)).toMatchObject({ ok: false, code: "type_mismatch" });
  });

  it("rejects unsupported formats such as GIF, SVG and PDF", () => {
    const gif = new TextEncoder().encode("GIF89a.........");
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const pdf = new TextEncoder().encode("%PDF-1.7 ....");
    for (const f of [gif, svg, pdf]) expect(validateImage(f, "image/png", MB10)).toMatchObject({ ok: false, code: "unsupported_type" });
  });

  it("rejects empty and oversized files", () => {
    expect(validateImage(new Uint8Array(), "image/png", MB10)).toMatchObject({ ok: false, code: "empty" });
    expect(validateImage(pngBytes(500, 500, 2048), "image/png", 1024)).toMatchObject({ ok: false, code: "too_large" });
  });

  it("rejects implausible dimensions", () => {
    expect(validateImage(pngBytes(10, 10), "image/png", MB10)).toMatchObject({ ok: false, code: "dimensions_out_of_range" });
    expect(validateImage(pngBytes(20000, 1000), "image/png", MB10)).toMatchObject({ ok: false, code: "dimensions_out_of_range" });
    expect(validateImage(pngBytes(10000, 10000), "image/png", MB10)).toMatchObject({ ok: false, code: "dimensions_out_of_range" });
  });

  it("rejects polyglot files carrying markup or script", () => {
    const evil = pngBytes(500, 500, 200);
    evil.set(new TextEncoder().encode("<script>alert(1)</script>"), 40);
    expect(validateImage(evil, "image/png", MB10)).toMatchObject({ ok: false, code: "suspicious_content" });
  });

  it("rejects truncated headers", () => {
    const truncated = pngBytes(500, 500).slice(0, 12);
    expect(sniffImageType(truncated)).toBe("image/png");
    expect(readDimensions(truncated, "image/png")).toBeNull();
    expect(validateImage(truncated, "image/png", MB10)).toMatchObject({ ok: false, code: "unreadable_dimensions" });
  });
});
