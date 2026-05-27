import { WIDTH, HEIGHT, FRAME_BYTES } from "../constants.js";
import type { Frame } from "../types.js";

export function createBuffer(): Frame {
  return new Uint8Array(FRAME_BYTES);
}

export function clear(buf: Frame, r = 0, g = 0, b = 0): void {
  for (let i = 0; i < buf.length; i += 3) {
    buf[i] = r;
    buf[i + 1] = g;
    buf[i + 2] = b;
  }
}

export function setPixel(buf: Frame, x: number, y: number, r: number, g: number, b: number): void {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  const i = (y * WIDTH + x) * 3;
  buf[i] = r;
  buf[i + 1] = g;
  buf[i + 2] = b;
}

export function drawRect(
  buf: Frame,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  g: number,
  b: number,
): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      setPixel(buf, xx, yy, r, g, b);
    }
  }
}

/**
 * Copy raw RGB pixel data (w*h*3 bytes) into the frame at (x, y).
 */
export function blitImage(
  buf: Frame,
  src: Uint8Array,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const si = (yy * w + xx) * 3;
      setPixel(buf, x + xx, y + yy, src[si]!, src[si + 1]!, src[si + 2]!);
    }
  }
}

/**
 * Marquee x offset. Returns a value that scrolls text right-to-left
 * across the available width, looping with a gap.
 */
export function scrollOffset(textWidth: number, viewWidth: number, frame: number, speed = 1): number {
  const total = textWidth + viewWidth;
  const t = Math.floor(frame * speed) % total;
  return viewWidth - t;
}
