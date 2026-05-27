import crypto from "node:crypto";

const API_VERSION = "1.16.1";
const CLIENT_NAME = "dot-display";

export interface NowPlayingEntry {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  coverArt?: string;
  duration?: number;
  playerName?: string;
  minutesAgo?: number;
}

export interface SubsonicConfig {
  url: string;
  user: string;
  pass: string;
}

export function loadSubsonicConfig(): SubsonicConfig | null {
  const url = process.env.NAVIDROME_URL;
  const user = process.env.NAVIDROME_USER;
  const pass = process.env.NAVIDROME_PASS;
  if (!url || !user || !pass) return null;
  return { url, user, pass };
}

interface SubsonicResponse<T> {
  "subsonic-response": {
    status: string;
    version: string;
  } & T;
}

export class SubsonicClient {
  private cfg: SubsonicConfig;

  constructor(cfg: SubsonicConfig) {
    this.cfg = cfg;
  }

  private authParams(): URLSearchParams {
    const salt = crypto.randomBytes(8).toString("hex");
    const token = crypto.createHash("md5").update(this.cfg.pass + salt).digest("hex");
    return new URLSearchParams({
      u: this.cfg.user,
      t: token,
      s: salt,
      v: API_VERSION,
      c: CLIENT_NAME,
      f: "json",
    });
  }

  private endpoint(method: string, extra: Record<string, string> = {}): string {
    const params = this.authParams();
    for (const [k, v] of Object.entries(extra)) params.set(k, v);
    return `${this.cfg.url.replace(/\/$/, "")}/rest/${method}?${params.toString()}`;
  }

  async getNowPlaying(): Promise<NowPlayingEntry | null> {
    const res = await fetch(this.endpoint("getNowPlaying"));
    if (!res.ok) throw new Error(`subsonic getNowPlaying: HTTP ${res.status}`);
    const json = (await res.json()) as SubsonicResponse<{
      nowPlaying?: { entry?: NowPlayingEntry | NowPlayingEntry[] };
      error?: { code: number; message: string };
    }>;
    const sr = json["subsonic-response"];
    if (sr.status !== "ok") {
      throw new Error(`subsonic: ${sr.error?.message ?? sr.status}`);
    }
    const raw = sr.nowPlaying?.entry;
    const entries: NowPlayingEntry[] = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
    if (entries.length === 0) return null;
    return entries[0] ?? null;
  }

  async getCoverArt(id: string, size = 64): Promise<Buffer> {
    const res = await fetch(this.endpoint("getCoverArt", { id, size: String(size) }));
    if (!res.ok) throw new Error(`subsonic getCoverArt: HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
}
