/**
 * Server-side Piped API client (imported from route handlers only — never
 * from client components; it uses Node's AbortSignal.timeout).
 *
 * Search-only since the discovery-first pivot: MusicFlow no longer streams
 * audio server-side, so the stream-source cascade (getStreamUrl / yt-dlp /
 * Piped `/streams/:id`) was removed. This module keeps the multi-instance
 * fallback + host health cooldown for search. Search results are Redis-cached
 * 5 minutes (Slice 3.1 helpers, CLAUDE.md cache rule) via a best-effort write —
 * see searchSongs.
 *
 * Instance list is kept deliberately SHORT: each dead host costs a full 10s
 * timeout on the failure path before falling through, so stacking unverified
 * hosts makes worst-case latency explode. To refresh, query the official
 * directory at https://piped-instances.kavin.rocks — as of 2026-08 only
 * private.coffee is registered and up; kavin.rocks is the canonical repo host
 * (fast-fails with 502 when down, so it's free to keep as a fallback).
 */
import {
  SEARCH_TTL_SECONDS,
  cacheGet,
  cacheKey,
  cacheSet,
} from "@/lib/cache/redis";
import type { PipedSearchItem, Track } from "@/types/piped";

/** Ordered fallback list — first to respond wins. Verified instance first. */
const PIPED_INSTANCES = [
  "https://api.piped.private.coffee",
  "https://pipedapi.kavin.rocks",
] as const;

const REQUEST_TIMEOUT_MS = 10_000;
const WATCH_URL_RE = /\/watch\?v=([A-Za-z0-9_-]{11})/;
const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/* ---- Host health cooldown (Slice 4.9 Phase 4) ------------------------------
 * In-memory, runtime-only self-healing: a host that just failed is skipped for
 * a short cooldown so a dead instance stops costing a full 10s timeout on every
 * request. Pure reactive marking (no proactive probing), resets on restart —
 * which is fine for a per-process cache. Fail-open: if every host is cooling
 * down, we try the original list anyway rather than block the search entirely.
 */
const HOST_COOLDOWN_MS = 60_000; // 60s

interface HostHealth {
  /** Unix ms after which the host may be retried; 0/absent = healthy. */
  cooldownUntil: number;
  /** Last failure reason, for logging/diagnostics. */
  lastFailure?: string;
}

const hostHealth = new Map<string, HostHealth>();

function markHostUnhealthy(host: string, reason: string): void {
  hostHealth.set(host, {
    cooldownUntil: Date.now() + HOST_COOLDOWN_MS,
    lastFailure: reason,
  });
  console.log("[piped] host cooldown", {
    host,
    reason,
    cooldownMs: HOST_COOLDOWN_MS,
  });
}

function isHostHealthy(host: string): boolean {
  const record = hostHealth.get(host);
  if (!record) return true;
  return Date.now() >= record.cooldownUntil;
}

/** Collapse a thrown fetch error into a reason string ('timeout' vs network). */
function markHostFailure(host: string, err: unknown): void {
  const detail = err instanceof Error ? err.message : String(err);
  const isTimeout = /abort|timed?\s?out|timeout/i.test(detail);
  markHostUnhealthy(host, isTimeout ? "timeout" : `network: ${detail}`);
}

/**
 * Ordered candidate hosts for a request. Prefers hosts NOT in cooldown,
 * preserving list order; falls back to the full original list when every host
 * is cooling down (fail-open). Returns the original index so callers can keep
 * their primary/fallback tier tags stable across the health filter.
 */
function healthyHostOrder(): Array<{ host: string; index: number }> {
  const all = PIPED_INSTANCES.map((host, index) => ({ host, index }));
  const healthy = all.filter(({ host }) => isHostHealthy(host));
  const mode = healthy.length > 0 ? "healthy" : "fail-open";
  const tried = healthy.length > 0 ? healthy : all;
  console.log("[piped] host selection", {
    mode,
    tried: tried.map((t) => t.host),
  });
  return tried;
}

function extractVideoId(item: PipedSearchItem): string | null {
  if (item.videoId && YT_ID_RE.test(item.videoId)) return item.videoId;
  if (item.id && YT_ID_RE.test(item.id)) return item.id;
  if (item.url) {
    const match = WATCH_URL_RE.exec(item.url);
    if (match) return match[1];
  }
  return null;
}

function normalizeSearchItem(item: PipedSearchItem): Track | null {
  const id = extractVideoId(item);
  if (!id || typeof item.title !== "string") return null;
  return {
    id,
    title: item.title,
    artist: typeof item.uploaderName === "string" ? item.uploaderName : null,
    duration: typeof item.duration === "number" ? item.duration : null,
    thumbnail:
      typeof item.thumbnail === "string"
        ? item.thumbnail
        : typeof item.thumbnailUrl === "string"
          ? item.thumbnailUrl
          : null,
  };
}

/**
 * Fetch a Piped path across instances until one responds. Throws only when
 * every instance fails — the message lists EACH instance's failure so the
 * last error shown is never mistaken for the first instance tried.
 */
async function fetchPiped(path: string): Promise<unknown> {
  const failures: string[] = [];
  for (const { host } of healthyHostOrder()) {
    try {
      const response = await fetch(`${host}${path}`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) {
        markHostUnhealthy(host, `HTTP ${response.status}`);
        failures.push(`${host} → HTTP ${response.status}`);
        continue;
      }
      return (await response.json()) as unknown;
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      markHostFailure(host, err);
      failures.push(`${host} → ${detail}`);
    }
  }
  throw new Error(`All Piped instances failed: ${failures.join(" | ")}`);
}

/**
 * Search YouTube Music for songs, normalized to `Track[]`. Redis-cached 5 min
 * (CLAUDE.md cache rule); cache provenance returned so callers can emit an
 * X-Cache header. Best-effort: a Redis miss/error degrades to a live fetch.
 */
export async function searchSongs(query: string): Promise<{
  tracks: Track[];
  fromCache: boolean;
}> {
  const key = cacheKey("search", query);
  const cached = await cacheGet<Track[]>(key);
  // `[]` is truthy, so a cached empty result counts as a hit too.
  if (cached) return { tracks: cached, fromCache: true };

  const path = `/search?q=${encodeURIComponent(query)}&filter=music_songs&region=US`;
  const raw = (await fetchPiped(path)) as { items?: PipedSearchItem[] };
  const items = Array.isArray(raw.items) ? raw.items : [];
  const tracks = items
    .map(normalizeSearchItem)
    .filter((t): t is Track => t !== null);

  await cacheSet(key, tracks, SEARCH_TTL_SECONDS);
  return { tracks, fromCache: false };
}
