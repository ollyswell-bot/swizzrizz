// Generates tests/fixtures/chat-1.png and chat-2.png: small, valid PNG screenshots for e2e tests.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, seed) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const i = y * (w * 3 + 1) + 1 + x * 3;
      const bubble = Math.floor(y / 90) % 2 === 0 ? x < w * 0.65 : x > w * 0.35;
      const inRow = y % 90 > 20 && y % 90 < 75;
      const v = inRow && bubble ? (Math.floor(y / 90) % 2 ? 120 + seed : 48) : 18;
      raw[i] = v; raw[i + 1] = v; raw[i + 2] = inRow && bubble && Math.floor(y / 90) % 2 ? 200 : v + 4;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const dir = new URL(".", import.meta.url).pathname;
writeFileSync(dir + "chat-1.png", png(390, 720, 0));
writeFileSync(dir + "chat-2.png", png(390, 720, 30));
console.log("wrote fixtures");
