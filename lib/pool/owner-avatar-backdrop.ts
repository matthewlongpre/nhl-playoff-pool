/**
 * Picks a representative RGB from image pixels by quantizing to 16 levels per
 * channel, finding the most populated bucket, and averaging RGB within it.
 * Skips nearly transparent pixels. Returns modern space-separated `rgb()`.
 */
export function dominantRgbFromImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): string | null {
  type Acc = { r: number; g: number; b: number; n: number };
  const buckets = new Map<number, Acc>();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = data[i + 3]!;
      if (a < 12) continue;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const key = ((r & 0xf0) << 16) | ((g & 0xf0) << 8) | (b & 0xf0);
      let acc = buckets.get(key);
      if (!acc) {
        acc = { r: 0, g: 0, b: 0, n: 0 };
        buckets.set(key, acc);
      }
      acc.r += r;
      acc.g += g;
      acc.b += b;
      acc.n += 1;
    }
  }

  let best: Acc | null = null;
  for (const acc of buckets.values()) {
    if (!best || acc.n > best.n) best = acc;
  }
  if (!best || best.n === 0) return null;

  const r = Math.round(best.r / best.n);
  const g = Math.round(best.g / best.n);
  const b = Math.round(best.b / best.n);
  return `rgb(${r} ${g} ${b})`;
}
