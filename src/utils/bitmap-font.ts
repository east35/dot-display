import { setPixel } from "./pixel-buffer.js";
import type { Frame } from "../types.js";

/**
 * Minimal 3x5 micro font. Each glyph is a string of 5 rows of "."/"#".
 * Glyphs are variable-width — width is inferred from row length.
 * Render with scale=2 for ~6x10 chunky output.
 */
const G: Record<string, string[]> = {
  "0": ["###", "#.#", "#.#", "#.#", "###"],
  "1": [".#.", "##.", ".#.", ".#.", "###"],
  "2": ["###", "..#", "###", "#..", "###"],
  "3": ["###", "..#", "###", "..#", "###"],
  "4": ["#.#", "#.#", "###", "..#", "..#"],
  "5": ["###", "#..", "###", "..#", "###"],
  "6": ["###", "#..", "###", "#.#", "###"],
  "7": ["###", "..#", "..#", "..#", "..#"],
  "8": ["###", "#.#", "###", "#.#", "###"],
  "9": ["###", "#.#", "###", "..#", "###"],
  ":": [".", "#", ".", "#", "."],
  "/": ["..#", "..#", ".#.", "#..", "#.."],
  "-": ["...", "...", "###", "...", "..."],
  ".": [".", ".", ".", ".", "#"],
  " ": ["..", "..", "..", "..", ".."],
  "°": ["##.", "##.", "...", "...", "..."],
  "%": ["#.#", "..#", ".#.", "#..", "#.#"],
  A: [".#.", "#.#", "###", "#.#", "#.#"],
  B: ["##.", "#.#", "##.", "#.#", "##."],
  C: [".##", "#..", "#..", "#..", ".##"],
  D: ["##.", "#.#", "#.#", "#.#", "##."],
  E: ["###", "#..", "##.", "#..", "###"],
  F: ["###", "#..", "##.", "#..", "#.."],
  G: [".##", "#..", "#.#", "#.#", ".##"],
  H: ["#.#", "#.#", "###", "#.#", "#.#"],
  I: ["###", ".#.", ".#.", ".#.", "###"],
  J: ["..#", "..#", "..#", "#.#", ".#."],
  K: ["#.#", "##.", "#..", "##.", "#.#"],
  L: ["#..", "#..", "#..", "#..", "###"],
  M: ["#.#", "###", "###", "#.#", "#.#"],
  N: ["#.#", "###", "###", "###", "#.#"],
  O: [".#.", "#.#", "#.#", "#.#", ".#."],
  P: ["##.", "#.#", "##.", "#..", "#.."],
  Q: [".#.", "#.#", "#.#", "##.", ".##"],
  R: ["##.", "#.#", "##.", "#.#", "#.#"],
  S: [".##", "#..", ".#.", "..#", "##."],
  T: ["###", ".#.", ".#.", ".#.", ".#."],
  U: ["#.#", "#.#", "#.#", "#.#", "###"],
  V: ["#.#", "#.#", "#.#", "#.#", ".#."],
  W: ["#.#", "#.#", "###", "###", "#.#"],
  X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
  Y: ["#.#", "#.#", ".#.", ".#.", ".#."],
  Z: ["###", "..#", ".#.", "#..", "###"],
};

const GLYPH_HEIGHT = 5;
const GLYPH_GAP = 1;

function glyph(ch: string): string[] {
  return G[ch] ?? G[ch.toUpperCase()] ?? G[" "]!;
}

function glyphWidth(ch: string): number {
  return glyph(ch)[0]!.length;
}

export function measureText(text: string, scale = 1): { w: number; h: number } {
  let w = 0;
  for (let i = 0; i < text.length; i++) {
    w += glyphWidth(text[i]!);
    if (i < text.length - 1) w += GLYPH_GAP;
  }
  return { w: w * scale, h: GLYPH_HEIGHT * scale };
}

export function renderText(
  buf: Frame,
  text: string,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  scale = 1,
  clip?: { minX: number; maxX: number },
): number {
  let cx = x;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    const rows = glyph(ch);
    const gw = rows[0]!.length;
    for (let ry = 0; ry < rows.length; ry++) {
      const row = rows[ry]!;
      for (let rx = 0; rx < row.length; rx++) {
        if (row[rx] === "#") {
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              const px = cx + rx * scale + sx;
              if (clip && (px < clip.minX || px >= clip.maxX)) continue;
              setPixel(buf, px, y + ry * scale + sy, r, g, b);
            }
          }
        }
      }
    }
    cx += (gw + GLYPH_GAP) * scale;
  }
  return cx - x - GLYPH_GAP * scale;
}

/**
 * Horizontally scrolling text within a fixed window. Loops with a gap.
 * `frame` is the integer frame counter; `speed` is pixels per frame.
 */
export function renderMarquee(
  buf: Frame,
  text: string,
  viewX: number,
  viewY: number,
  viewW: number,
  r: number,
  g: number,
  b: number,
  frame: number,
  scale = 1,
  speed = 1,
): void {
  const { w: textW } = measureText(text, scale);
  if (textW <= viewW) {
    renderText(buf, text, viewX, viewY, r, g, b, scale, { minX: viewX, maxX: viewX + viewW });
    return;
  }
  const gap = Math.max(8, Math.floor(viewW / 2));
  const period = textW + gap;
  const offset = ((frame * speed) % period + period) % period;
  const clip = { minX: viewX, maxX: viewX + viewW };
  renderText(buf, text, viewX - offset, viewY, r, g, b, scale, clip);
  // Draw a second copy to fill the gap when the first has scrolled enough.
  if (textW - offset < viewW) {
    renderText(buf, text, viewX - offset + period, viewY, r, g, b, scale, clip);
  }
}
