export interface ArkivItem {
  media_type: "book" | "game" | string;
  title: string;
  cover_url?: string;
  book?: { author?: string } | null;
  game?: { active_platform?: string } | null;
  started_at?: string;
  revisit_started_at?: string;
}

export interface PublicDisplay {
  in_progress_items?: ArkivItem[];
}

export interface PublicCounts {
  books_ytd?: number;
  games_ytd?: number;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  displayToken: string;
}

// Anon key is public — published in the corresponding .star file. Safe as a default.
const DEFAULT_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inphc3RnY2VtdXJraGx4eWJ2b3N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzQ3MjYsImV4cCI6MjA4ODY1MDcyNn0.f_Z-kS8FyFuGyGP1fm4Sh37eX-v6nqz4hLrgBBsQkfE";

export function loadSupabaseConfig(): SupabaseConfig {
  return {
    url: process.env.SUPABASE_URL ?? "https://zastgcemurkhlxybvosw.supabase.co",
    anonKey: process.env.SUPABASE_ANON_KEY ?? DEFAULT_ANON_KEY,
    displayToken: process.env.DISPLAY_TOKEN ?? "5cd2ff66",
  };
}

interface CacheEntry<T> {
  value: T;
  expires: number;
}

export class SupabaseRpc {
  private cfg: SupabaseConfig;
  private cache = new Map<string, CacheEntry<unknown>>();
  private inflight = new Map<string, Promise<unknown>>();

  constructor(cfg: SupabaseConfig) {
    this.cfg = cfg;
  }

  async call<T>(fn: string, body: Record<string, unknown>, ttlMs: number): Promise<T> {
    const key = `${fn}:${JSON.stringify(body)}`;
    const hit = this.cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.value as T;
    const pending = this.inflight.get(key);
    if (pending) return pending as Promise<T>;

    const p = this.fetch<T>(fn, body)
      .then((v) => {
        this.cache.set(key, { value: v, expires: Date.now() + ttlMs });
        return v;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, p as Promise<unknown>);
    return p;
  }

  private async fetch<T>(fn: string, body: Record<string, unknown>): Promise<T> {
    const endpoint = `${this.cfg.url.replace(/\/$/, "")}/rest/v1/rpc/${fn}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: this.cfg.anonKey,
        Authorization: `Bearer ${this.cfg.anonKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`supabase ${fn}: HTTP ${res.status}`);
    return (await res.json()) as T;
  }

  getPublicDisplay(): Promise<PublicDisplay> {
    return this.call("get_public_display", { p_display_token: this.cfg.displayToken }, 60_000);
  }

  getPublicCounts(): Promise<PublicCounts> {
    return this.call("get_public_display_counts", { p_display_token: this.cfg.displayToken }, 300_000);
  }
}

/**
 * "Started Today" / "Yesterday" / "N Days" / "N Weeks" — matches arkiv.star.
 */
export function startedLabel(item: ArkivItem, now: Date = new Date()): string {
  const raw = item.revisit_started_at || item.started_at;
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  const days = Math.floor((now.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "STARTED TODAY";
  if (days === 1) return "YESTERDAY";
  if (days % 7 === 0) {
    const weeks = days / 7;
    return weeks === 1 ? "1 WEEK" : `${weeks} WEEKS`;
  }
  return `${days} DAYS`;
}
