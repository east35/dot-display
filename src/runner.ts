import type { App, Publisher } from "./types.js";

export interface RunnerOptions {
  apps: App[];
  publisher: Publisher;
  fps?: number;
}

export class Runner {
  private apps: App[];
  private publisher: Publisher;
  private fps: number;
  private stopped = false;

  constructor(opts: RunnerOptions) {
    this.apps = opts.apps;
    this.publisher = opts.publisher;
    this.fps = opts.fps ?? 10;
  }

  async start(): Promise<void> {
    const frameInterval = 1000 / this.fps;
    let idx = 0;

    while (!this.stopped) {
      const app = this.apps[idx % this.apps.length]!;

      if (app.isActive && !(await app.isActive())) {
        idx++;
        continue;
      }

      await this.publisher.publishMeta({
        app: app.name,
        fps: this.fps,
        duration: app.duration,
      });

      const start = Date.now();
      while (!this.stopped && Date.now() - start < app.duration) {
        const elapsed = Date.now() - start;
        const tickStart = Date.now();
        const frame = await app.render(elapsed);
        await this.publisher.publishFrame(frame);
        const tickElapsed = Date.now() - tickStart;
        const sleep = Math.max(0, frameInterval - tickElapsed);
        if (sleep > 0) await new Promise((r) => setTimeout(r, sleep));
      }

      idx++;
    }
  }

  stop(): void {
    this.stopped = true;
  }
}
