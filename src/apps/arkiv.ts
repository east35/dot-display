import { WIDTH, HEIGHT } from "../constants.js";
import { createBuffer, drawRect, blitImage } from "../utils/pixel-buffer.js";
import { renderText, renderMarquee, measureText } from "../utils/bitmap-font.js";
import { hexToRgb, type RGB } from "../utils/color.js";
import { fetchImageRGB } from "../utils/image.js";
import { SupabaseRpc, loadSupabaseConfig, startedLabel, type ArkivItem } from "../utils/supabase.js";
import type { App, Frame } from "../types.js";

const PER_ITEM_MS = 15_000;
const COVER_W = 24;
const COVER_H = 30;
const TEXT_X = 1 + COVER_W + 2; // = 27
const TEXT_W = WIDTH - TEXT_X - 1; // = 36
const WHITE: RGB = { r: 255, g: 255, b: 255 };
const DIM: RGB = { r: 138, g: 138, b: 138 };
const ACCENT_BOOK = hexToRgb("#5aa9ff");
const ACCENT_GAME = hexToRgb("#ff7a59");

interface ItemState {
  cover: { data: Buffer; width: number; height: number } | null;
  coverLoadFailed: boolean;
}

export function arkivApp(): App {
  const rpc = new SupabaseRpc(loadSupabaseConfig());
  let items: ArkivItem[] = [];
  let states: ItemState[] = [];
  let lastFetch = 0;
  const FPS = 10;

  async function refresh(): Promise<void> {
    if (Date.now() - lastFetch < 60_000 && items.length > 0) return;
    const data = await rpc.getPublicDisplay();
    items = data.in_progress_items ?? [];
    states = items.map(() => ({ cover: null, coverLoadFailed: false }));
    lastFetch = Date.now();

    // Kick off cover loads in parallel — render uses whatever is ready.
    items.forEach((item, i) => {
      if (!item.cover_url) return;
      fetchImageRGB(item.cover_url, COVER_W, COVER_H)
        .then((img) => {
          states[i]!.cover = img;
        })
        .catch(() => {
          states[i]!.coverLoadFailed = true;
        });
    });
  }

  return {
    name: "arkiv",
    get duration(): number {
      return Math.max(items.length, 1) * PER_ITEM_MS;
    },
    async isActive(): Promise<boolean> {
      try {
        await refresh();
      } catch {
        // Network down — keep previous items if we have them, otherwise skip.
      }
      return items.length > 0;
    },
    async render(elapsedMs: number): Promise<Frame> {
      if (items.length === 0) return messageFrame("NO ITEMS");
      const idx = Math.min(Math.floor(elapsedMs / PER_ITEM_MS), items.length - 1);
      const frameCounter = Math.floor((elapsedMs / 1000) * FPS);
      return drawCard(items[idx]!, states[idx]!, frameCounter);
    },
  };
}

function messageFrame(msg: string): Frame {
  const buf = createBuffer();
  const size = measureText(msg, 1);
  renderText(
    buf,
    msg,
    Math.floor((WIDTH - size.w) / 2),
    Math.floor((HEIGHT - size.h) / 2),
    DIM.r,
    DIM.g,
    DIM.b,
    1,
  );
  return buf;
}

function drawCard(item: ArkivItem, state: ItemState, frame: number): Frame {
  const buf = createBuffer();
  const isBook = item.media_type === "book";
  const accent = isBook ? ACCENT_BOOK : ACCENT_GAME;

  // Cover or placeholder.
  if (state.cover) {
    blitImage(buf, new Uint8Array(state.cover.data), 1, 1, COVER_W, COVER_H);
  } else {
    drawRect(buf, 1, 1, COVER_W, COVER_H, accent.r, accent.g, accent.b);
    const letter = isBook ? "B" : "G";
    const sz = measureText(letter, 2);
    renderText(
      buf,
      letter,
      1 + Math.floor((COVER_W - sz.w) / 2),
      1 + Math.floor((COVER_H - sz.h) / 2),
      0,
      0,
      0,
      2,
    );
  }

  // Right column: title / author or platform / started-label.
  const title = (item.title || "Untitled").toUpperCase();
  const subline = isBook
    ? (item.book?.author ?? "").toUpperCase()
    : (item.game?.active_platform ?? "").toUpperCase();
  const started = startedLabel(item);

  const lines: { text: string; color: RGB }[] = [{ text: title, color: WHITE }];
  if (subline) lines.push({ text: subline, color: accent });
  if (started) lines.push({ text: started, color: DIM });

  // Vertical layout: 3 lines (5px tall each) spaced across COVER_H=30.
  // Slots at y = 2, 13, 24 give 6px gaps between baselines.
  const slots = [2, 13, 24];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const y = slots[i] ?? slots[slots.length - 1]!;
    renderMarquee(buf, line.text, TEXT_X, y, TEXT_W, line.color.r, line.color.g, line.color.b, frame, 1, 1);
  }

  return buf;
}
