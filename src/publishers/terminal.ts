import { WIDTH, HEIGHT } from "../constants.js";
import type { Publisher, Frame } from "../types.js";

/**
 * Renders frames to the terminal using ANSI 24-bit color + the upper half-block
 * character "▀" so each character cell covers two vertical pixels.
 * Result: 64 cols × 16 rows of output for a 64×32 frame.
 */
export class TerminalPublisher implements Publisher {
  private currentApp = "";
  private firstFrame = true;

  publishFrame(frame: Frame): void {
    const lines: string[] = [];
    for (let y = 0; y < HEIGHT; y += 2) {
      let line = "";
      for (let x = 0; x < WIDTH; x++) {
        const top = (y * WIDTH + x) * 3;
        const bot = ((y + 1) * WIDTH + x) * 3;
        const tr = frame[top]!, tg = frame[top + 1]!, tb = frame[top + 2]!;
        const br = frame[bot]!, bg = frame[bot + 1]!, bb = frame[bot + 2]!;
        // Foreground = top pixel, background = bottom pixel.
        line += `\x1b[38;2;${tr};${tg};${tb}m\x1b[48;2;${br};${bg};${bb}m▀`;
      }
      line += "\x1b[0m";
      lines.push(line);
    }

    if (this.firstFrame) {
      // Hide cursor on first frame.
      process.stdout.write("\x1b[?25l");
      this.firstFrame = false;
    }
    // Move cursor home and overwrite in place.
    process.stdout.write("\x1b[H" + lines.join("\n") + `\n[${this.currentApp}]\x1b[K\n`);
  }

  publishMeta(meta: { app: string; fps: number; duration: number }): void {
    this.currentApp = `${meta.app} · ${meta.fps}fps · ${meta.duration}ms`;
  }

  close(): void {
    process.stdout.write("\x1b[?25h\x1b[0m\n");
  }
}
