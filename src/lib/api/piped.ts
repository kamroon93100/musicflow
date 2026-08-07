/**
 * Server-side Piped API client (imported from route handlers only — never
 * from client components; it uses Node's AbortSignal.timeout).
 *
 * Multi-instance with fallback: requests are tried against each instance in
 * order until one responds, so a single dead host (e.g. a 502) never breaks
 * search or streaming. Search results are Redis-cached 5 minutes (Slice 3.1
 * helpers, CLAUDE.md cache rule) via a best-effort write — see searchSongs.
 * Stream URLs are Redis-cached 5h (STREAM_TTL_SECONDS) by the getStreamUrl
 * orchestrator (3.3-alt): a resolved URL is written back so repeat plays of the
 * same video skip the upstream entirely.
 *
 * Instance list is kept deliberately SHORT: each dead host costs a full 10s
 * timeout on the failure path before falling through, so stacking unverified
 * hosts makes worst-case latency explode. To refresh, query the official
 * directory at https://piped-instances.kavin.rocks — as of 2026-08 only
 * private.coffee is registered and up; kavin.rocks is the canonical repo host
 * (fast-fails with 502 when down, so it's free to keep as a fallback).
 */
import { getStreamFromYtdlp } from "@/lib/api/ytdlp";
import {
  SEARCH_TTL_SECONDS,
  STREAM_TTL_SECONDS,
  cacheGet,
  cacheKey,
  cacheSet,
} from "@/lib/cache/redis";
import type {
  PipedAudioStream,
  PipedSearchItem,
  PipedStreamsResponse,
  StreamInfo,
  Track,
} from "@/types/piped";

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
 * down, we try the original list anyway rather than block playback entirely.
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

/** Piped format token → howler format hint (engine StreamSource.format). */
const FORMAT_TO_HOWLER: Record<string, string> = {
  M4A: "mp4",
  WEBMA: "webm",
  WEBM: "webm",
  OGG: "ogg",
  MP3: "mp3",
};

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

export function toHowlerFormat(format: string | undefined): string | null {
  if (!format) return null;
  return FORMAT_TO_HOWLER[format.toUpperCase()] ?? null;
}

/** Pick the highest-bitrate https audio stream; tiebreak on format quality. */
function selectBestAudioStream(
  streams: PipedAudioStream[] | undefined,
): PipedAudioStream | null {
  if (!streams || streams.length === 0) return null;

  const formatRank = (format?: string): number => {
    switch ((format ?? "").toUpperCase()) {
      case "M4A":
        return 3;
      case "WEBMA":
        return 2;
      case "OGG":
        return 1;
      default:
        return 0;
    }
  };

  const usable = streams.filter(
    (s) => typeof s.url === "string" && s.url.startsWith("https://"),
  );
  if (usable.length === 0) return streams[0] ?? null;

  return usable.reduce((best, current) => {
    const bestBitrate = typeof best.bitrate === "number" ? best.bitrate : -1;
    const bitrate = typeof current.bitrate === "number" ? current.bitrate : -1;
    if (bitrate > bestBitrate) return current;
    if (bitrate === bestBitrate && formatRank(current.format) > formatRank(best.format)) {
      return current;
    }
    return best;
  }, usable[0]);
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

/** Fetch + validate the `/streams/:id` payload once, shared by both methods. */
async function fetchStreams(videoId: string): Promise<PipedStreamsResponse> {
  const raw = (await fetchPiped(
    `/streams/${encodeURIComponent(videoId)}`,
  )) as PipedStreamsResponse;
  if (!Array.isArray(raw.audioStreams)) raw.audioStreams = [];
  return raw;
}

/** Which layer of the stream-source cascade produced the URL. */
export type StreamSource =
  | "cache"
  | "ytdlp"
  | "piped-primary"
  | "piped-fallback";

/**
 * Structured stream-source failure: per-layer reasons so the route can
 * serialize exactly what broke (client reads `.error`; details are for logs).
 */
export class StreamError extends Error {
  readonly details: { ytdlp?: string; piped: string[] };
  constructor(message: string, details: { ytdlp?: string; piped: string[] }) {
    super(message);
    this.name = "StreamError";
    this.details = details;
  }
}

/**
 * Resolve a stream via Piped's instance list, tagging which tier served it
 * (index 0 → piped-primary, any later → piped-fallback). Per-instance loop —
 * NOT fetchStreams, which hides the winning instance. Reuses the shared
 * selectBestAudioStream for pick logic. Throws a `" | "`-joined failure list
 * that the orchestrator splits into the StreamError.details.piped array.
 */
async function getStreamFromPiped(videoId: string): Promise<{
  stream: StreamInfo;
  source: "piped-primary" | "piped-fallback";
}> {
  const failures: string[] = [];
  for (const { host, index } of healthyHostOrder()) {
    const instance = host;
    const source = index === 0 ? "piped-primary" : "piped-fallback";
    const started = Date.now();
    console.log("[stream] trying piped", { instance, videoId });
    try {
      const response = await fetch(
        `${instance}/streams/${encodeURIComponent(videoId)}`,
        {
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          headers: { Accept: "application/json" },
          cache: "no-store",
        },
      );
      if (!response.ok) {
        markHostUnhealthy(instance, `HTTP ${response.status}`);
        failures.push(`${instance} → HTTP ${response.status}`);
        continue;
      }
      const raw = (await response.json()) as PipedStreamsResponse;
      if (!Array.isArray(raw.audioStreams)) raw.audioStreams = [];
      const best = selectBestAudioStream(raw.audioStreams);
      if (!best?.url) {
        failures.push(`${instance} → no audio stream`);
        continue;
      }
      const stream: StreamInfo = {
        url: best.url,
        format: toHowlerFormat(best.format),
        bitrate: typeof best.bitrate === "number" ? best.bitrate : null,
        mimeType: best.mimeType ?? null,
        contentLength:
          typeof best.contentLength === "number" ? best.contentLength : null,
      };
      console.log("[stream] piped OK", {
        instance,
        source,
        ms: Date.now() - started,
      });
      return { stream, source };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      markHostFailure(instance, err);
      failures.push(`${instance} → ${detail}`);
    }
  }
  throw new Error(failures.join(" | "));
}

/**
 * Stream-source orchestrator (Slice 3.3-alt). Tries in order:
 *   Layer 0: Redis cache (5h TTL) — fastest path, skips upstream entirely.
 *   Layer 1: yt-dlp primary — only if YTDLP_URL is configured (self-hosted
 *            service; bypasses the Piped/YouTube IP block, KNOWN_ISSUE [2.2]).
 *   Layer 2: Piped multi-instance fallback (primary + fallback tier tags).
 * Winners write back to Redis so repeat plays hit Layer 0.
 * Returns the winner + which layer produced it (the route emits it as
 * X-Stream-Source). All-fail → throws StreamError with per-layer details.
 */
export async function getStreamUrl(videoId: string): Promise<{
  data: StreamInfo;
  source: StreamSource;
}> {
  // Layer 0: Redis cache.
  const key = cacheKey("stream", videoId);
  const cached = await cacheGet<StreamInfo>(key);
  if (cached) {
    console.log("[stream] cache HIT", { videoId });
    return { data: cached, source: "cache" };
  }

  const failures: { ytdlp?: string; piped: string[] } = { piped: [] };

  // Layer 1: yt-dlp (only when configured).
  const ytdlpConfigured = !!process.env.YTDLP_URL;
  if (ytdlpConfigured) {
    try {
      const stream = await getStreamFromYtdlp(videoId);
      await cacheSet(key, stream, STREAM_TTL_SECONDS);
      return { data: stream, source: "ytdlp" };
    } catch (err) {
      failures.ytdlp = err instanceof Error ? err.message : String(err);
    }
  } else {
    failures.ytdlp = "not configured";
  }

  // Layer 2: Piped multi-instance fallback.
  try {
    const { stream, source } = await getStreamFromPiped(videoId);
    await cacheSet(key, stream, STREAM_TTL_SECONDS);
    return { data: stream, source };
  } catch (err) {
    failures.piped = (err instanceof Error ? err.message : String(err)).split(
      " | ",
    );
  }

  throw new StreamError("All stream sources failed", failures);
}

/** Full details + stream for a video. Used by metadata work (Slice 3.3+). */
export async function getSongDetails(videoId: string): Promise<{
  track: Track;
  stream: StreamInfo;
}> {
  const res = await fetchStreams(videoId);
  const best = selectBestAudioStream(res.audioStreams);

  const track: Track = {
    id: videoId,
    title: typeof res.title === "string" ? res.title : videoId,
    artist: typeof res.uploader === "string" ? res.uploader : null,
    duration: typeof res.duration === "number" ? res.duration : null,
    thumbnail: typeof res.thumbnailUrl === "string" ? res.thumbnailUrl : null,
  };

  const stream: StreamInfo = best?.url
    ? {
        url: best.url,
        format: toHowlerFormat(best.format),
        bitrate: typeof best.bitrate === "number" ? best.bitrate : null,
        mimeType: best.mimeType ?? null,
        contentLength:
          typeof best.contentLength === "number" ? best.contentLength : null,
      }
    : { url: "", format: null, bitrate: null, mimeType: null, contentLength: null };

  return { track, stream };
}
