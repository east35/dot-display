export type Frame = Uint8Array;

export interface App {
  name: string;
  duration: number;
  render(elapsedMs: number): Promise<Frame> | Frame;
  isActive?(): Promise<boolean> | boolean;
}

export interface Publisher {
  publishFrame(frame: Frame): Promise<void> | void;
  publishMeta(meta: { app: string; fps: number; duration: number }): Promise<void> | void;
  close?(): Promise<void> | void;
}
