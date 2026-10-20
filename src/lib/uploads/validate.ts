/**
 * Screenshot validation. Trusts the file's bytes, never its name or declared type.
 * Pure functions so they run identically on the server and in tests.
 */

export type AllowedMime = "image/png" | "image/jpeg" | "image/webp";

export const ALLOWED_MIME_TYPES: readonly AllowedMime[] = ["image/png", "image/jpeg", "image/webp"];
export const MIN_DIMENSION = 64;
export const MAX_DIMENSION = 12000;
export const MAX_PIXELS = 60_000_000;

export type ValidationErrorCode =
  | "empty"
  | "too_large"
  | "unsupported_type"
  | "type_mismatch"
  | "unreadable_dimensions"
  | "dimensions_out_of_range"
  | "suspicious_content";

export interface ValidImage {
  ok: true;
  mime: AllowedMime;
  width: number;
  height: number;
  byteSize: number;
}

export interface InvalidImage {
  ok: false;
  code: ValidationErrorCode;
  message: string;
}

export function sniffImageType(bytes: Uint8Array): AllowedMime | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 4) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let out = "";
  for (let i = start; i < start + length && i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

function u16be(b: Uint8Array, o: number) {
  return (b[o] << 8) | b[o + 1];
}
function u32be(b: Uint8Array, o: number) {
  return ((b[o] << 24) >>> 0) + ((b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]);
}
function u16le(b: Uint8Array, o: number) {
  return b[o] | (b[o + 1] << 8);
}
function u24le(b: Uint8Array, o: number) {
  return b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
}

export function readDimensions(bytes: Uint8Array, mime: AllowedMime): { width: number; height: number } | null {
  try {
    if (mime === "image/png") {
      if (bytes.length < 24 || ascii(bytes, 12, 4) !== "IHDR") return null;
      return { width: u32be(bytes, 16), height: u32be(bytes, 20) };
    }
    if (mime === "image/jpeg") {
      let offset = 2;
      while (offset + 9 < bytes.length) {
        if (bytes[offset] !== 0xff) return null;
        const marker = bytes[offset + 1];
        // Standalone markers have no length field.
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
          offset += 2;
          continue;
        }
        const length = u16be(bytes, offset + 2);
        const isSOF =
          marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
        if (isSOF) {
          return { height: u16be(bytes, offset + 5), width: u16be(bytes, offset + 7) };
        }
        if (length < 2) return null;
        offset += 2 + length;
      }
      return null;
    }
    // WebP
    const chunk = ascii(bytes, 12, 4);
    if (chunk === "VP8X" && bytes.length >= 30) {
      return { width: u24le(bytes, 24) + 1, height: u24le(bytes, 27) + 1 };
    }
    if (chunk === "VP8 " && bytes.length >= 30) {
      return { width: u16le(bytes, 26) & 0x3fff, height: u16le(bytes, 28) & 0x3fff };
    }
    if (chunk === "VP8L" && bytes.length >= 25) {
      const b0 = bytes[21], b1 = bytes[22], b2 = bytes[23], b3 = bytes[24];
      return {
        width: 1 + (((b1 & 0x3f) << 8) | b0),
        height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Looks for markup or script embedded near the start of a file (polyglot uploads). */
function looksLikeMarkup(bytes: Uint8Array): boolean {
  const head = ascii(bytes, 0, Math.min(bytes.length, 2048)).toLowerCase();
  return /<script|<html|<svg|<\?php|<iframe|javascript:/.test(head);
}

export function validateImage(
  bytes: Uint8Array,
  declaredMime: string | null | undefined,
  maxBytes: number,
): ValidImage | InvalidImage {
  if (bytes.length === 0) return { ok: false, code: "empty", message: "The file is empty." };
  if (bytes.length > maxBytes) {
    return {
      ok: false,
      code: "too_large",
      message: `Images must be ${Math.round(maxBytes / 1024 / 1024)} MB or smaller.`,
    };
  }
  const mime = sniffImageType(bytes);
  if (!mime) {
    return { ok: false, code: "unsupported_type", message: "Only PNG, JPEG and WebP screenshots are accepted." };
  }
  const declared = (declaredMime ?? "").toLowerCase().replace("image/jpg", "image/jpeg");
  if (declared && declared !== "application/octet-stream" && declared !== mime) {
    return { ok: false, code: "type_mismatch", message: "The file's contents don't match its type." };
  }
  if (looksLikeMarkup(bytes)) {
    return { ok: false, code: "suspicious_content", message: "This file was rejected for safety." };
  }
  const dims = readDimensions(bytes, mime);
  if (!dims || !dims.width || !dims.height) {
    return { ok: false, code: "unreadable_dimensions", message: "Couldn't read the image dimensions." };
  }
  if (
    dims.width < MIN_DIMENSION || dims.height < MIN_DIMENSION ||
    dims.width > MAX_DIMENSION || dims.height > MAX_DIMENSION ||
    dims.width * dims.height > MAX_PIXELS
  ) {
    return {
      ok: false,
      code: "dimensions_out_of_range",
      message: `Images must be between ${MIN_DIMENSION} and ${MAX_DIMENSION} pixels on each side.`,
    };
  }
  return { ok: true, mime, width: dims.width, height: dims.height, byteSize: bytes.length };
}
