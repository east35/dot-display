import { Runner } from "./runner.js";
import { TerminalPublisher } from "./publishers/terminal.js";
import { MqttPublisher } from "./publishers/mqtt.js";
import { clock } from "./apps/clock.js";
import { weatherApp } from "./apps/weather.js";
import { arkivApp } from "./apps/arkiv.js";
import { arkivStatsApp } from "./apps/arkiv-stats.js";
import { nowPlayingApp } from "./apps/now-playing.js";
import type { Publisher } from "./types.js";

function makePublisher(): Publisher {
  const kind = process.env.PUBLISHER ?? "terminal";
  if (kind === "mqtt") {
    return new MqttPublisher({
      broker: process.env.MQTT_BROKER ?? "mqtt://localhost:1883",
      frameTopic: process.env.MQTT_TOPIC_FRAME ?? "matrix/frame",
      metaTopic: process.env.MQTT_TOPIC_META ?? "matrix/meta",
    });
  }
  if (kind === "terminal") return new TerminalPublisher();
  throw new Error(`unknown PUBLISHER: ${kind}`);
}

async function main() {
  const publisher = makePublisher();
  const lat = Number(process.env.LAT ?? 30.2672);
  const lon = Number(process.env.LON ?? -97.7431);

  const runner = new Runner({
    apps: [nowPlayingApp(), clock, weatherApp(lat, lon), arkivApp(), arkivStatsApp()],
    publisher,
    fps: 10,
  });

  const shutdown = async () => {
    runner.stop();
    await publisher.close?.();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  if (process.env.PUBLISHER !== "mqtt") {
    process.stdout.write("\x1b[2J\x1b[H");
  }

  await runner.start();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
