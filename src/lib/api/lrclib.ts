/**
 * Server-side LRCLIB client (imported from route handlers only — never from
 * client components; it uses Node's AbortSignal.timeout).
 *
 * Fetches song lyrics by title + artist. Lyrics are Redis-cached: 30 days for
 * found lyrics (they never change), 1 day for misses (LRCLIB is
 * community-curated and gains lyrics over time, so a stale negative would hide
 * lyrics for a month). Best-effort writes — a Redis failure still returns
 * fresh data (matches Slice 3.1/3.2). Cache provenance returned so callers can
 * emit an X-Cache header, same as searchSongs.
 *
 * Artist strings from Piped are channel/uploader names and can be null or askew
 * from the officially credited artist, so a primary /api/get miss falls back to
 * LRCLIB's /api/search by track name and takes the first hit with lyrics. Good
 * hit-rate payoff for trivial cost.
 */
import {
  LYRICS_TTL_SECONDS,
  cacheGet,
  cacheKey,
  cacheSet,
} from "@/lib/cache/redis";
import type { LyricsData, LrclibTrack } from "@/types/lyrics";

const LRCLIB_URL = "https://lrclib.net/api";
const REQUEST_TIMEOUT_MS = 10_000;
/** Negative-cache TTL: LRCLIB is community-curated so misses resolve over time. */
const LYRICS_MISS_TTL_SECONDS = 86_400; // 1 day

const NO_LYRICS: LyricsData = {
  syncedLyrics: null,
  plainLyrics: null,
  instrumental: false,
};

/**
 * Fetch a JSON response from LRCLIB, or null on 404 (not found). Throws on
 * network/timeout errors and non-404 HTTP failures so the caller can distinguish
 * "no lyrics" (cacheable) from "LRCLIB unreachable" (must NOT be cached).
 */
async function fetchLrclib(path: string): Promise<unknown | null> {
  const response = await fetch(`${LRCLIB_URL}${path}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (response.status === 404) return null; // not found → no lyrics
  if (!response.ok) throw new Error(`LRCLIB → HTTP ${response.status}`);
  return (await response.json()) as unknown;
}

/** True when a record carries either kind of lyrics. */
function hasLyrics(track: LrclibTrack | null): boolean {
  return (
    !!track &&
    (typeof track.syncedLyrics === "string" ||
      typeof track.plainLyrics === "string")
  );
}

/** Best match by track name alone, falling back past null/lyric-less hits. */
async function searchByTitle(title: string): Promise<LrclibTrack | null> {
  const raw = (await fetchLrclib(
    `/search?track_name=${encodeURIComponent(title)}`,
  )) as LrclibTrack[] | null;
  const results = Array.isArray(raw) ? raw : [];
  return results.find(hasLyrics) ?? null;
}

/**
 * Fetch synced/plain lyrics for a track by video ID + title + artist.
 * Redis-cached (30d hit / 1d miss); returns cache provenance for X-Cache.
 */
export async function getLyrics(
  id: string,
  title: string,
  artist: string | null,
): Promise<{ data: LyricsData; fromCache: boolean }> {
  const key = cacheKey("lyrics", `${id}|${title}|${artist ?? ""}`);

  const cached = await cacheGet<LyricsData>(key);
  if (cached) return { data: cached, fromCache: true };

  // Primary: exact lookup by artist + track name. A transient /api/get failure
  // degrades to the search fallback rather than a hard fail.
  let track: LrclibTrack | null = null;
  if (artist) {
    try {
      track = (await fetchLrclib(
        `/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`,
      )) as LrclibTrack | null;
    } catch {
      // ignore — search fallback below tries once more
    }
  }
  if (!hasLyrics(track)) {
    track = await searchByTitle(title);
  }

  const data: LyricsData = hasLyrics(track)
    ? {
        syncedLyrics: track?.syncedLyrics ?? null,
        plainLyrics: track?.plainLyrics ?? null,
        instrumental: track?.instrumental ?? false,
      }
    : NO_LYRICS;

  // Positive hit cached 30d (immutable); miss cached 1d (LRCLIB resolves).
  await cacheSet(
    key,
    data,
    hasLyrics(track) ? LYRICS_TTL_SECONDS : LYRICS_MISS_TTL_SECONDS,
  );
  return { data, fromCache: false };
}