/** Builds minimal but structurally valid image headers for validation tests. */

export function pngBytes(width: number, height: number, extra = 64): Uint8Array {
  const b = new Uint8Array(33 + extra);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  b.set([0, 0, 0, 13], 8);
  b.set([0x49, 0x48, 0x44, 0x52], 12); // IHDR
  const v = new DataView(b.buffer);
  v.setUint32(16, width);
  v.setUint32(20, height);
  b[24] = 8; // bit depth
  b[25] = 6; // RGBA
  return b;
}

export function jpegBytes(width: number, height: number): Uint8Array {
  const b = new Uint8Array(64);
  b.set([0xff, 0xd8], 0);
  // APP0 segment, length 16
  b.set([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0, 0, 1, 0, 1, 0, 0], 2);
  // SOF0 at offset 20
  const o = 20;
  b.set([0xff, 0xc0, 0x00, 0x11, 0x08], o);
  b[o + 5] = (height >> 8) & 0xff;
  b[o + 6] = height & 0xff;
  b[o + 7] = (width >> 8) & 0xff;
  b[o + 8] = width & 0xff;
  return b;
}

export function webpBytes(width: number, height: number): Uint8Array {
  const b = new Uint8Array(40);
  const enc = (s: string, at: number) => [...s].forEach((c, i) => (b[at + i] = c.charCodeAt(0)));
  enc("RIFF", 0);
  enc("WEBP", 8);
  enc("VP8X", 12);
  const w = width - 1;
  const h = height - 1;
  b[24] = w & 0xff;
  b[25] = (w >> 8) & 0xff;
  b[26] = (w >> 16) & 0xff;
  b[27] = h & 0xff;
  b[28] = (h >> 8) & 0xff;
  b[29] = (h >> 16) & 0xff;
  return b;
}
