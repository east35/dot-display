import { WIDTH, HEIGHT } from "../constants.js";
import { createBuffer, drawRect, setPixel } from "../utils/pixel-buffer.js";
import { renderText, measureText } from "../utils/bitmap-font.js";
import { drawIcon, wmoToIcon } from "../utils/icons.js";
import { OpenMeteoClient, dayAbbr, type WeatherData } from "../utils/open-meteo.js";
import type { App, Frame } from "../types.js";

export function weatherApp(lat: number, lon: number): App {
  const client = new OpenMeteoClient(lat, lon);
  let last: WeatherData | null = null;

  return {
    name: "weather",
    duration: 15_000,
    async render(): Promise<Frame> {
      try {
        last = await client.getWeather();
      } catch (err) {
        if (!last) {
          return errorFrame((err as Error).message);
        }
      }
      return drawWeather(last!);
    },
  };
}

function errorFrame(msg: string): Frame {
  const buf = createBuffer();
  renderText(buf, "WX ERR", 2, 2, 255, 100, 100, 1);
  renderText(buf, msg.slice(0, 16).toUpperCase(), 2, 12, 200, 200, 200, 1);
  return buf;
}

function drawWeather(data: WeatherData): Frame {
  const buf = createBuffer();

  // ── Top half: today (icon + current temp + H/L) ──
  const today = data.daily[0]!;
  drawIcon(buf, wmoToIcon(data.current.code), 1, 2, "big");

  const tempStr = `${Math.round(data.current.temp)}°`;
  const tempScale = 2;
  const tempSize = measureText(tempStr, tempScale);
  const tempX = 14;
  const tempY = 1;
  renderText(buf, tempStr, tempX, tempY, 255, 255, 255, tempScale);

  const hl = `H${Math.round(today.tempMax)} L${Math.round(today.tempMin)}`;
  const hlSize = measureText(hl, 1);
  renderText(
    buf,
    hl,
    Math.min(tempX, WIDTH - hlSize.w - 1),
    tempY + tempSize.h + 1,
    180,
    180,
    180,
    1,
  );

  // ── Divider ──
  drawRect(buf, 0, 16, WIDTH, 1, 40, 40, 60);

  // ── Bottom half: next 2 days (compact cells) ──
  const next = data.daily.slice(1, 3);
  const cellW = Math.floor(WIDTH / next.length);

  for (let i = 0; i < next.length; i++) {
    const day = next[i]!;
    const cx = i * cellW;

    if (i > 0) {
      // Vertical separator between cells.
      for (let y = 18; y < HEIGHT - 1; y++) setPixel(buf, cx - 1, y, 40, 40, 60);
    }

    const label = dayAbbr(day.date);
    const labelSize = measureText(label, 1);
    renderText(
      buf,
      label,
      cx + Math.floor((cellW - labelSize.w) / 2),
      18,
      200,
      200,
      200,
      1,
    );

    // Icon + H/L on the same row.
    drawIcon(buf, wmoToIcon(day.code), cx + 1, 25, "small");
    const dayHL = `${Math.round(day.tempMax)}/${Math.round(day.tempMin)}`;
    renderText(buf, dayHL, cx + 9, 26, 255, 255, 255, 1);
  }

  return buf;
}
