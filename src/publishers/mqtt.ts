import mqtt, { type MqttClient } from "mqtt";
import type { Publisher, Frame } from "../types.js";

export class MqttPublisher implements Publisher {
  private client: MqttClient;
  private frameTopic: string;
  private metaTopic: string;

  constructor(opts: { broker: string; frameTopic: string; metaTopic: string }) {
    this.frameTopic = opts.frameTopic;
    this.metaTopic = opts.metaTopic;
    this.client = mqtt.connect(opts.broker, { reconnectPeriod: 2000 });
    this.client.on("connect", () => console.log(`[mqtt] connected to ${opts.broker}`));
    this.client.on("error", (err) => console.error("[mqtt] error:", err.message));
  }

  publishFrame(frame: Frame): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.publish(this.frameTopic, Buffer.from(frame), { qos: 0 }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  publishMeta(meta: { app: string; fps: number; duration: number }): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.publish(this.metaTopic, JSON.stringify(meta), { qos: 0, retain: true }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve) => this.client.end(false, {}, () => resolve()));
  }
}
