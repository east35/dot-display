import { WIDTH } from "../constants.js";
import { createBuffer, drawRect } from "../utils/pixel-buffer.js";
import { renderText, measureText } from "../utils/bitmap-font.js";
import { hexToRgb, type RGB } from "../utils/color.js";
import { SupabaseRpc, loadSupabaseConfig, type PublicCounts } from "../utils/supabase.js";
import type { App, Frame } from "../types.js";

const HEADER_BG = hexToRgb("#3a4dff");
const BOOK_NUM = hexToRgb("#5dde5d");
const GAME_NUM = hexToRgb("#ff5b5b");
const WHITE: RGB = { r: 255, g: 255, b: 255 };
const DIM = (c: RGB): RGB => ({ r: Math.round(c.r * 0.27), g: Math.round(c.g * 0.27), b: Math.round(c.b * 0.27) });

export function arkivStatsApp(): App {
  const rpc = new SupabaseRpc(loadSupabaseConfig());
  let counts: PublicCounts | null = null;
  let lastError: string | null = null;

  async function refresh(): Promise<void> {
    try {
      counts = await rpc.getPublicCounts();
      lastError = null;
    } catch (err) {
      lastError = (err as Error).message;
    }
  }

  return {
    name: "arkiv-stats",
    duration: 15_000,
    async render(): Promise<Frame> {
      await refresh();
      if (!counts) {
        return errorFrame(lastError ?? "OFFLINE");
      }
      return drawStats(counts);
    },
  };
}

function errorFrame(msg: string): Frame {
  const buf = createBuffer();
  renderText(buf, "ARKIV ERR", 2, 2, 255, 100, 100, 1);
  renderText(buf, msg.slice(0, 16).toUpperCase(), 2, 12, 200, 200, 200, 1);
  return buf;
}

function drawStats(c: PublicCounts): Frame {
  const buf = createBuffer();
  const books = Number(c.books_ytd ?? 0);
  const games = Number(c.games_ytd ?? 0);
  const year = String(new Date().getFullYear());

  // Header — 6px tall band at the top.
  drawRect(buf, 0, 0, WIDTH, 6, 12, 16, 60);
  const header = `ARKIV ${year} YTD`;
  const hSize = measureText(header, 1);
  renderText(
    buf,
    header,
    Math.floor((WIDTH - hSize.w) / 2),
    0,
    HEADER_BG.r,
    HEADER_BG.g,
    HEADER_BG.b,
    1,
  );

  // Two 32-wide columns.
  drawNumberColumn(buf, books, "BOOKS", BOOK_NUM, 0);
  drawNumberColumn(buf, games, "GAMES", GAME_NUM, 32);
  return buf;
}

function drawNumberColumn(
  buf: Frame,
  count: number,
  label: string,
  color: RGB,
  colX: number,
): void {
  const colW = 32;
  const scale = 4; // 3×5 → 12×20

  const numText = String(count);
  const showPlaceholder = count < 10;
  const placeholderSize = showPlaceholder ? measureText("0", scale) : { w: 0, h: 0 };
  const numSize = measureText(numText, scale);
  const gap = showPlaceholder ? 1 : 0;
  const totalW = placeholderSize.w + (showPlaceholder ? gap : 0) + numSize.w;

  // Number row sits in the 20px-tall area from y=7..26.
  const numY = 7;
  let cursorX = colX + Math.floor((colW - totalW) / 2);

  if (showPlaceholder) {
    const d = DIM(color);
    renderText(buf, "0", cursorX, numY, d.r, d.g, d.b, scale);
    cursorX += placeholderSize.w + gap;
  }
  renderText(buf, numText, cursorX, numY, color.r, color.g, color.b, scale);

  // Label — 5px tall, fits in y=27..31.
  const lSize = measureText(label, 1);
  renderText(
    buf,
    label,
    colX + Math.floor((colW - lSize.w) / 2),
    27,
    WHITE.r,
    WHITE.g,
    WHITE.b,
    1,
  );
}
