/**
 * Server-side Piped API client (imported from route handlers only — never
 * from client components; it uses Node's AbortSignal.timeout).
 *
 * Multi-instance with fallback: requests are tried against each instance in
 * order until one responds, so a single dead host (e.g. a 502) never breaks
 * search or streaming. Redis caching lands in Slice 3.1; for now search is
 * cached in-memory for 5 minutes per the CLAUDE.md cache rule. Stream URLs are
 * NOT cached (they expire / are region-locked).
 *
 * Instance list is kept deliberately SHORT: each dead host costs a full 10s
 * timeout on the failure path before falling through, so stacking unverified
 * hosts makes worst-case latency explode. To refresh, query the official
 * directory at https://piped-instances.kavin.rocks — as of 2026-08 only
 * private.coffee is registered and up; kavin.rocks is the canonical repo host
 * (fast-fails with 502 when down, so it's free to keep as a fallback).
 */
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
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const WATCH_URL_RE = /\/watch\?v=([A-Za-z0-9_-]{11})/;
const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** Piped format token → howler format hint (engine StreamSource.format). */
const FORMAT_TO_HOWLER: Record<string, string> = {
  M4A: "mp4",
  WEBMA: "webm",
  OGG: "ogg",
  MP3: "mp3",
};

/** In-memory search cache, keyed by normalized query. Replaced by Redis in 3.1. */
const searchCache = new Map<string, { at: number; data: Track[] }>();

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

function toHowlerFormat(format: string | undefined): string | null {
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
  for (const instance of PIPED_INSTANCES) {
    try {
      const response = await fetch(`${instance}${path}`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) {
        failures.push(`${instance} → HTTP ${response.status}`);
        continue;
      }
      return (await response.json()) as unknown;
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      failures.push(`${instance} → ${detail}`);
    }
  }
  throw new Error(`All Piped instances failed: ${failures.join(" | ")}`);
}

/** Search YouTube Music for songs, normalized to `Track[]` (cached 5 min). */
export async function searchSongs(query: string): Promise<Track[]> {
  const cached = searchCache.get(query);
  if (cached && Date.now() - cached.at < SEARCH_CACHE_TTL_MS) return cached.data;

  const path = `/search?q=${encodeURIComponent(query)}&filter=music_songs&region=US`;
  const raw = (await fetchPiped(path)) as { items?: PipedSearchItem[] };
  const items = Array.isArray(raw.items) ? raw.items : [];
  const tracks = items
    .map(normalizeSearchItem)
    .filter((t): t is Track => t !== null);

  searchCache.set(query, { at: Date.now(), data: tracks });
  return tracks;
}

/** Fetch + validate the `/streams/:id` payload once, shared by both methods. */
async function fetchStreams(videoId: string): Promise<PipedStreamsResponse> {
  const raw = (await fetchPiped(
    `/streams/${encodeURIComponent(videoId)}`,
  )) as PipedStreamsResponse;
  if (!Array.isArray(raw.audioStreams)) raw.audioStreams = [];
  return raw;
}

/** Best playable audio stream for a video (throws if none available). */
export async function getStreamUrl(videoId: string): Promise<StreamInfo> {
  const res = await fetchStreams(videoId);
  const best = selectBestAudioStream(res.audioStreams);
  if (!best?.url) {
    throw new Error("No audio stream available for this video");
  }
  return {
    url: best.url,
    format: toHowlerFormat(best.format),
    bitrate: typeof best.bitrate === "number" ? best.bitrate : null,
    mimeType: best.mimeType ?? null,
    contentLength:
      typeof best.contentLength === "number" ? best.contentLength : null,
  };
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
