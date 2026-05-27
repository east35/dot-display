export interface RGB {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

export function rgb(r: number, g: number, b: number): RGB {
  return { r, g, b };
}

/**
 * Boost a color toward saturation + brightness for legibility on the matrix.
 * Roughly: stretch the min channel down and the max channel up.
 */
export function vivify(c: RGB, minBrightness = 140): RGB {
  const max = Math.max(c.r, c.g, c.b);
  if (max === 0) return { r: minBrightness, g: minBrightness, b: minBrightness };
  const scale = Math.max(1, minBrightness / max);
  return {
    r: Math.min(255, Math.round(c.r * scale)),
    g: Math.min(255, Math.round(c.g * scale)),
    b: Math.min(255, Math.round(c.b * scale)),
  };
}
