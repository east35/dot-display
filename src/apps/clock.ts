import { WIDTH, HEIGHT } from "../constants.js";
import { createBuffer } from "../utils/pixel-buffer.js";
import { renderText, measureText } from "../utils/bitmap-font.js";
import type { App, Frame } from "../types.js";

export const clock: App = {
  name: "clock",
  duration: 10_000,
  render(): Frame {
    const buf = createBuffer();
    const now = new Date();

    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = now.getSeconds();
    const time = `${hh}${ss % 2 === 0 ? ":" : " "}${mm}`;

    const timeScale = 2;
    const timeSize = measureText(time, timeScale);
    const timeX = Math.floor((WIDTH - timeSize.w) / 2);
    const timeY = 6;
    renderText(buf, time, timeX, timeY, 255, 255, 255, timeScale);

    const mo = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const date = `${mo}/${dd}`;
    const dateSize = measureText(date, 1);
    const dateX = Math.floor((WIDTH - dateSize.w) / 2);
    const dateY = HEIGHT - dateSize.h - 2;
    renderText(buf, date, dateX, dateY, 90, 169, 255, 1);

    return buf;
  },
};
