import { WIDTH } from "../constants.js";
import { createBuffer, drawRect, blitImage } from "../utils/pixel-buffer.js";
import { renderText, renderMarquee, measureText } from "../utils/bitmap-font.js";
import { vivify, type RGB } from "../utils/color.js";
import { dominantColor, resizeToRGB } from "../utils/image.js";
import { SubsonicClient, loadSubsonicConfig, type NowPlayingEntry } from "../utils/subsonic.js";
import type { App, Frame } from "../types.js";

const COVER_W = 24;
const COVER_H = 30;
const TEXT_X = 1 + COVER_W + 2;
const TEXT_W = WIDTH - TEXT_X - 1;
const POLL_MS = 5_000;
const WHITE: RGB = { r: 255, g: 255, b: 255 };
const DIM: RGB = { r: 138, g: 138, b: 138 };

interface CurrentTrack {
  entry: NowPlayingEntry;
  cover: Uint8Array | null;
  accent: RGB;
}

function errorFrame(msg: string): Frame {
  const buf = createBuffer();
  renderText(buf, "NOW PLAYING", 2, 2, 255, 100, 100, 1);
  // Word-wrap into 3 lines of up to ~15 chars at scale 1.
  const text = msg.toUpperCase();
  const maxChars = 15;
  const lines: string[] = [];
  for (let i = 0; i < text.length && lines.length < 3; i += maxChars) {
    lines.push(text.slice(i, i + maxChars));
  }
  lines.forEach((line, i) => {
    renderText(buf, line, 2, 10 + i * 7, 200, 200, 200, 1);
  });
  return buf;
}

export function nowPlayingApp(): App {
  const cfg = loadSubsonicConfig();
  if (!cfg) {
    // Not configured — app stays inactive.
    return {
      name: "now-playing",
      duration: 0,
      isActive: () => false,
      render: () => createBuffer(),
    };
  }
  const client = new SubsonicClient(cfg);

  let current: CurrentTrack | null = null;
  let lastError: string | null = null;
  let lastPoll = 0;
  const FPS = 10;

  async function refresh(): Promise<void> {
    if (Date.now() - lastPoll < POLL_MS) return;
    lastPoll = Date.now();
    let entry: NowPlayingEntry | null = null;
    try {
      entry = await client.getNowPlaying();
      lastError = null;
    } catch (err) {
      const cause = (err as Error).cause as Error | undefined;
      lastError = cause?.message ?? (err as Error).message;
      current = null;
      return;
    }
    if (!entry) {
      current = null;
      return;
    }
    if (current?.entry.id === entry.id) {
      // Same track — just refresh entry fields.
      current.entry = entry;
      return;
    }
    // New track — load cover + accent.
    let cover: Uint8Array | null = null;
    let accent: RGB = WHITE;
    if (entry.coverArt) {
      try {
        const raw = await client.getCoverArt(entry.coverArt, 96);
        const resized = await resizeToRGB(raw, COVER_W, COVER_H);
        cover = new Uint8Array(resized);
        accent = vivify(await dominantColor(raw));
      } catch {
        // Keep defaults.
      }
    }
    current = { entry, cover, accent };
  }

  return {
    name: "now-playing",
    duration: 30_000,
    async isActive(): Promise<boolean> {
      await refresh();
      // Stay active when there's an error too, so the failure is visible
      // on the panel rather than silently skipped.
      return current !== null || lastError !== null;
    },
    async render(elapsedMs: number): Promise<Frame> {
      // Keep refreshing while showing so we pick up track changes mid-display.
      await refresh();
      const buf = createBuffer();
      if (!current) {
        if (lastError) return errorFrame(lastError);
        return buf;
      }

      if (current.cover) {
        blitImage(buf, current.cover, 1, 1, COVER_W, COVER_H);
      } else {
        const a = current.accent;
        drawRect(buf, 1, 1, COVER_W, COVER_H, a.r, a.g, a.b);
        const ph = "M";
        const sz = measureText(ph, 2);
        renderText(
          buf,
          ph,
          1 + Math.floor((COVER_W - sz.w) / 2),
          1 + Math.floor((COVER_H - sz.h) / 2),
          0,
          0,
          0,
          2,
        );
      }

      const title = (current.entry.title || "Untitled").toUpperCase();
      const artist = (current.entry.artist || "").toUpperCase();
      const album = (current.entry.album || "").toUpperCase();
      const a = current.accent;

      const frame = Math.floor((elapsedMs / 1000) * FPS);
      const slots = [2, 13, 24];
      const lines: { text: string; color: RGB }[] = [{ text: title, color: WHITE }];
      if (artist) lines.push({ text: artist, color: a });
      if (album) lines.push({ text: album, color: DIM });

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const y = slots[i] ?? slots[slots.length - 1]!;
        renderMarquee(buf, line.text, TEXT_X, y, TEXT_W, line.color.r, line.color.g, line.color.b, frame, 1, 1);
      }
      return buf;
    },
  };
}
