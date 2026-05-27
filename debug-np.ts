/**
 * One-shot probe: hits Navidrome's getNowPlaying and prints the raw response.
 * Run with:  npx tsx --env-file-if-exists=.env debug-np.ts
 */
import crypto from "node:crypto";
import dns from "node:dns/promises";
import { loadSubsonicConfig } from "./src/utils/subsonic.js";

async function main() {
  const cfg = loadSubsonicConfig();
  if (!cfg) {
    console.error("Missing NAVIDROME_URL / NAVIDROME_USER / NAVIDROME_PASS in .env");
    process.exit(1);
  }
  console.log("URL:", cfg.url, "user:", cfg.user);

  // Resolve the host so we can see what Node sees.
  const u = new URL(cfg.url);
  try {
    const addrs = await dns.lookup(u.hostname, { all: true });
    console.log("DNS:", addrs);
  } catch (e) {
    console.log("DNS lookup failed:", (e as Error).message);
  }

  const salt = crypto.randomBytes(8).toString("hex");
  const t = crypto.createHash("md5").update(cfg.pass + salt).digest("hex");
  const params = new URLSearchParams({
    u: cfg.user,
    t,
    s: salt,
    v: "1.16.1",
    c: "dot-display",
    f: "json",
  });

  const url = `${cfg.url.replace(/\/$/, "")}/rest/ping?${params.toString()}`;
  console.log("GET ping…");
  try {
    const ping = await fetch(url);
    console.log("ping status:", ping.status);
    console.log("ping body:", await ping.text());
  } catch (e) {
    dumpErr("ping", e);
  }

  const npUrl = `${cfg.url.replace(/\/$/, "")}/rest/getNowPlaying?${params.toString()}`;
  console.log("GET getNowPlaying…");
  try {
    const res = await fetch(npUrl);
    console.log("status:", res.status);
    const text = await res.text();
    try {
      console.log(JSON.stringify(JSON.parse(text), null, 2));
    } catch {
      console.log(text);
    }
  } catch (e) {
    dumpErr("getNowPlaying", e);
  }
}

function dumpErr(label: string, e: unknown): void {
  const err = e as Error & { code?: string; cause?: unknown };
  console.error(`[${label}] ${err.name}: ${err.message}`);
  if (err.code) console.error(`  code: ${err.code}`);
  let c: unknown = err.cause;
  while (c) {
    const ce = c as Error & { code?: string; cause?: unknown; errors?: unknown[] };
    console.error(`  cause: ${ce.name ?? "?"}: ${ce.message ?? ce}`);
    if (ce.code) console.error(`    code: ${ce.code}`);
    if (Array.isArray(ce.errors)) {
      for (const sub of ce.errors) {
        const se = sub as Error & { code?: string; address?: string; port?: number };
        console.error(`    sub: ${se.code ?? se.name}: ${se.message} (${se.address ?? ""}:${se.port ?? ""})`);
      }
    }
    c = ce.cause;
  }
}

main().catch((e) => dumpErr("main", e));
