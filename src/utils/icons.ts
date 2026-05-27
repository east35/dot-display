import { setPixel } from "./pixel-buffer.js";
import type { Frame } from "../types.js";
import type { RGB } from "./color.js";

/**
 * Tiny multi-color bitmap icons.
 * Each glyph row uses single-char codes that map to a palette:
 *   "." = transparent (skip)
 *   any other char = palette lookup
 *
 * Two sizes per icon: 10x10 ("big") and 6x6 ("small").
 */

const PALETTE: Record<string, RGB> = {
  Y: { r: 255, g: 210, b: 70 },   // sun yellow
  W: { r: 220, g: 220, b: 220 },  // cloud light
  G: { r: 130, g: 130, b: 140 },  // cloud dark / gray
  B: { r: 90, g: 169, b: 255 },   // rain blue / sky
  S: { r: 240, g: 240, b: 255 },  // snow white
  T: { r: 255, g: 220, b: 80 },   // thunder yellow
  D: { r: 200, g: 200, b: 200 },  // generic light
  K: { r: 60, g: 60, b: 80 },     // dark
};

interface IconDef {
  big: string[];
  small: string[];
}

const SUN: IconDef = {
  big: [
    "....Y.....",
    "Y...Y...Y.",
    ".Y.YYY.Y..",
    "..YYYYY...",
    "YYYYYYYYY.",
    "..YYYYY...",
    ".Y.YYY.Y..",
    "Y...Y...Y.",
    "....Y.....",
    "..........",
  ],
  small: [
    "..Y...",
    "Y.Y.Y.",
    ".YYY..",
    "YYYYY.",
    ".YYY..",
    "Y.Y.Y.",
  ],
};

const PARTLY: IconDef = {
  big: [
    "Y.........",
    ".YYY......",
    "Y.YYY..WW.",
    ".YYY.WWWWW",
    "..Y.WWWWWW",
    "....WWWWWW",
    "....GGGGGG",
    "..........",
    "..........",
    "..........",
  ],
  small: [
    "Y.....",
    ".Y.WW.",
    "Y.WWWW",
    "..WWWW",
    "..GGGG",
    "......",
  ],
};

const CLOUD: IconDef = {
  big: [
    "..........",
    "...WWWW...",
    "..WWWWWW..",
    ".WWWWWWWW.",
    "WWWWWWWWWW",
    "WWWWWWWWWW",
    ".GGGGGGGG.",
    "..........",
    "..........",
    "..........",
  ],
  small: [
    "..WW..",
    ".WWWW.",
    "WWWWWW",
    "WWWWWW",
    ".GGGG.",
    "......",
  ],
};

const RAIN: IconDef = {
  big: [
    "...WWWW...",
    "..WWWWWW..",
    ".WWWWWWWW.",
    "WWWWWWWWWW",
    ".GGGGGGGG.",
    "..........",
    "..B...B...",
    ".B...B...B",
    "B...B...B.",
    "..........",
  ],
  small: [
    ".WWWW.",
    "WWWWWW",
    ".GGGG.",
    ".B..B.",
    "B..B..",
    "......",
  ],
};

const SNOW: IconDef = {
  big: [
    "..........",
    "...WWWW...",
    "..WWWWWW..",
    ".WWWWWWWW.",
    ".GGGGGGGG.",
    "..........",
    ".S.S.S.S..",
    "..........",
    "S.S.S.S.S.",
    "..........",
  ],
  small: [
    "..WW..",
    ".WWWW.",
    "WWWWWW",
    ".GGGG.",
    "S.S.S.",
    ".S.S.S",
  ],
};

const THUNDER: IconDef = {
  big: [
    "..........",
    "..WWWWW...",
    ".WWWWWWW..",
    "WWWWWWWWW.",
    ".GGGGGGGG.",
    "....TT....",
    "...TT.....",
    "..TTTT....",
    "....T.....",
    "...T......",
  ],
  small: [
    ".WWWW.",
    "WWWWWW",
    ".GGGG.",
    "..TT..",
    ".TT...",
    "..T...",
  ],
};

const FOG: IconDef = {
  big: [
    "..........",
    "..........",
    "GGGGGGGGGG",
    "..........",
    ".DDDDDDDDD",
    "..........",
    "DDDDDDDDD.",
    "..........",
    ".GGGGGGGGG",
    "..........",
  ],
  small: [
    "......",
    "GGGGGG",
    "......",
    ".DDDDD",
    "......",
    "GGGGG.",
  ],
};

export type IconName = "sun" | "partly" | "cloud" | "rain" | "snow" | "thunder" | "fog";

const ICONS: Record<IconName, IconDef> = {
  sun: SUN,
  partly: PARTLY,
  cloud: CLOUD,
  rain: RAIN,
  snow: SNOW,
  thunder: THUNDER,
  fog: FOG,
};

export function drawIcon(
  buf: Frame,
  name: IconName,
  x: number,
  y: number,
  size: "big" | "small" = "big",
): void {
  const rows = ICONS[name][size];
  for (let ry = 0; ry < rows.length; ry++) {
    const row = rows[ry]!;
    for (let rx = 0; rx < row.length; rx++) {
      const ch = row[rx]!;
      if (ch === ".") continue;
      const c = PALETTE[ch];
      if (!c) continue;
      setPixel(buf, x + rx, y + ry, c.r, c.g, c.b);
    }
  }
}

/**
 * Map WMO weather codes (Open-Meteo) to icon names.
 * Reference: https://open-meteo.com/en/docs (weather_code values)
 */
export function wmoToIcon(code: number): IconName {
  if (code === 0) return "sun";
  if (code === 1 || code === 2) return "partly";
  if (code === 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 67) return "rain";
  if (code >= 80 && code <= 82) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 85 && code <= 86) return "snow";
  if (code >= 95 && code <= 99) return "thunder";
  return "cloud";
}
