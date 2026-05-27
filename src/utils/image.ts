import sharp from "sharp";
import type { RGB } from "./color.js";

interface CachedImage {
  data: Buffer;
  width: number;
  height: number;
  expires: number;
}

const cache = new Map<string, CachedImage>();
const inflight = new Map<string, Promise<CachedImage>>();
const TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Fetch an image URL and resize to raw RGB bytes (w*h*3).
 * Cached for 24h keyed by `${url}@${w}x${h}`.
 */
export async function fetchImageRGB(
  url: string,
  width: number,
  height: number,
): Promise<{ data: Buffer; width: number; height: number }> {
  const key = `${url}@${width}x${height}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit;
  const pending = inflight.get(key);
  if (pending) return pending;

  const p = (async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`image ${url}: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const data = await sharp(buf)
      .resize(width, height, { fit: "cover" })
      .removeAlpha()
      .raw()
      .toBuffer();
    const entry: CachedImage = { data, width, height, expires: Date.now() + TTL_MS };
    cache.set(key, entry);
    return entry;
  })().finally(() => inflight.delete(key));

  inflight.set(key, p);
  return p;
}

/**
 * Resize raw image bytes to a tiny image and pick the most saturated pixel
 * as the dominant color — better than a flat average for accent use.
 */
export async function dominantColor(imageBytes: Buffer): Promise<RGB> {
  const SAMPLE = 8;
  const { data } = await sharp(imageBytes)
    .resize(SAMPLE, SAMPLE, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let best = { r: 255, g: 255, b: 255 };
  let bestScore = -1;
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    const lightness = max / 255;
    // Reward saturation, lightly penalize very dark or very light pixels.
    const score = sat * (1 - Math.abs(lightness - 0.55));
    if (score > bestScore) {
      bestScore = score;
      best = { r, g, b };
    }
  }
  return best;
}

/**
 * Convenience for callers that already have a Buffer (e.g. cover art bytes)
 * and want the raw RGB resized data without going through the URL cache.
 */
export async function resizeToRGB(
  imageBytes: Buffer,
  width: number,
  height: number,
): Promise<Buffer> {
  return sharp(imageBytes).resize(width, height, { fit: "cover" }).removeAlpha().raw().toBuffer();
}
