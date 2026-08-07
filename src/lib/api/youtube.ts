/**
 * YouTube Data API v3 enrichment (Slice 4.10 Phase 2). Server-only.
 *
 * Attaches richer metadata to Piped search results at the top of the list:
 *   - verified-channel info (channelId + channelVerified heuristic)
 *   - higher-quality thumbnail (maxres > high > medium > default)
 *   - accurate duration (parsed from ISO 8601 contentDetails)
 *
 * Quota discipline (v3 free tier = 10k units/day): videos.list costs 1 unit
 * per call regardless of how many IDs are in the batch, so we fetch up to
 * TOP_N (10) IDs in a single request and cache the result per video ID for
 * 24h. Re-searches of the same videos hit Redis, not the API.
 *
 * ENRICHMENT IS ADDITIVE AND NEVER FAILS THE SEARCH: any error (quota, key
 * invalid, network, timeout) logs and returns the input tracks unmodified.
 * Search must never break because enrichment did.
 */
import {
  cacheGet,
  cacheKey,
  cacheSet,
} from "@/lib/cache/redis";
import { getServerEnv } from "@/lib/env";
import type { Track } from "@/types/piped";

/** Public shape cached per video ID for 24h. */
export interface YoutubeEnrichment {
  channelId: string;
  channelTitle: string;
  channelVerified: boolean;
  /** Best available thumbnail URL; absent when YT returned no thumbnails. */
  thumbnailUrl?: string;
  /** Parsed duration in seconds; absent when contentDetails was unparseable. */
  durationSeconds?: number;
}

/** Sentinel cached when YT doesn't return a video (deleted/private/region). */
interface NegativeMarker {
  negative: true;
}

const TOP_N = 10;
const ENRICH_TTL_SECONDS = 86_400; // 24h
const YOUTUBE_API = "https://www.googleapis.com/youtube/v3/videos";
const REQUEST_TIMEOUT_MS = 5_000;

const NEGATIVE: NegativeMarker = { negative: true };

/** True when a cached value is the "not found" sentinel. */
function isNegative(cached: YoutubeEnrichment | NegativeMarker): cached is NegativeMarker {
  return (cached as NegativeMarker).negative === true;
}

/**
 * Parse a YouTube ISO 8601 duration (contentDetails.duration) into seconds,
 * e.g. "PT4M13S" → 253, "PT1H2M3S" → 3723. Returns undefined for any shape we
 * can't confidently parse (live/P0D, malformed, absent) rather than guessing.
 */
function parseIsoDuration(iso: string | undefined): number | undefined {
  if (!iso) return undefined;
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(iso);
  if (!match) return undefined;
  const h = match[1] ? Number(match[1]) : 0;
  const m = match[2] ? Number(match[2]) : 0;
  const s = match[3] ? Number(match[3]) : 0;
  if (!Number.isFinite(h + m + s)) return undefined;
  return Math.round(h * 3600 + m * 60 + s);
}

/** Fetch video metadata for up to 50 ids. Throws on any YT/non-OK failure. */
async function batchFetch(
  ids: string[],
): Promise<Map<string, YoutubeEnrichment>> {
  const { YOUTUBE_API_KEY } = getServerEnv();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const url = `${YOUTUBE_API}?id=${ids.join(",")}&part=snippet,contentDetails&key=${YOUTUBE_API_KEY}`;
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`YouTube API → HTTP ${response.status}`);
    const json = (await response.json()) as {
      items?: Array<{
        id?: string;
        snippet?: {
          title?: string;
          channelId?: string;
          channelTitle?: string;
          thumbnails?: {
            maxres?: { url?: string };
            high?: { url?: string };
            medium?: { url?: string };
            default?: { url?: string };
          };
        };
        contentDetails?: { duration?: string };
      }>;
    };

    const enrichments = new Map<string, YoutubeEnrichment>();
    for (const item of json.items ?? []) {
      const id = item.id;
      const snippet = item.snippet;
      if (!id || !snippet) continue;

      const thumbs = snippet.thumbnails;
      const thumbnailUrl =
        thumbs?.maxres?.url ??
        thumbs?.high?.url ??
        thumbs?.medium?.url ??
        thumbs?.default?.url;

      const durationSeconds = parseIsoDuration(item.contentDetails?.duration);

      const channels = `${snippet.channelTitle ?? ""} ${snippet.title ?? ""}`;
      const enrichment: YoutubeEnrichment = {
        channelId: snippet.channelId ?? "",
        channelTitle: snippet.channelTitle ?? "",
        // Verified heuristic: presence of the VEVO/Official brand marker.
        channelVerified: /vevo|official/i.test(channels),
        ...(thumbnailUrl ? { thumbnailUrl } : {}),
        ...(durationSeconds !== undefined ? { durationSeconds } : {}),
      };
      enrichments.set(id, enrichment);
    }
    return enrichments;
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

/**
 * Enrich the first TOP_N tracks with YouTube Data API metadata.
 * Never throws: any failure logs and returns the input unmodified.
 */
export async function enrichSearchResults(tracks: Track[]): Promise<Track[]> {
  try {
    const top = tracks.slice(0, TOP_N);
    if (top.length === 0) return tracks;
    const rest = tracks.slice(TOP_N);

    // 1. Cache-first: keep per-id misses, remember cached negatives.
    const resolved = new Map<string, YoutubeEnrichment | null>(); // id → enr | null(no-data)
    const idsToFetch: string[] = [];
    for (const track of top) {
      const cached = await cacheGet<YoutubeEnrichment | NegativeMarker>(
        cacheKey("yt-enrich", track.id),
      );
      if (cached === null) {
        idsToFetch.push(track.id);
      } else if (isNegative(cached)) {
        resolved.set(track.id, null);
      } else {
        resolved.set(track.id, cached);
      }
    }

    // 2. Batch-fetch cache misses and write results + negatives back.
    if (idsToFetch.length > 0) {
      const fetched = await batchFetch(idsToFetch);
      for (const [id, enrichment] of fetched) {
        resolved.set(id, enrichment);
        await cacheSet(
          cacheKey("yt-enrich", id),
          enrichment,
          ENRICH_TTL_SECONDS,
        );
      }
      // Ids the API didn't return → cache a negative so we don't re-request.
      const returned = new Set(fetched.keys());
      for (const id of idsToFetch) {
        if (returned.has(id)) continue;
        resolved.set(id, null);
        await cacheSet(cacheKey("yt-enrich", id), NEGATIVE, ENRICH_TTL_SECONDS);
      }
    }

    // 3. Merge enrichment into the first TOP_N tracks (input untouched).
    const merged: Track[] = [];
    for (let i = 0; i < top.length; i++) {
      const track = top[i];
      const enrichment = resolved.get(track.id);
      if (!enrichment) {
        merged.push(track);
        continue;
      }
      merged.push({
        ...track,
        thumbnail: enrichment.thumbnailUrl || track.thumbnail,
        duration: enrichment.durationSeconds ?? track.duration,
        metadata: {
          source: "youtube",
          channelId: enrichment.channelId,
          channelVerified: enrichment.channelVerified,
          enrichedAt: Date.now(),
        },
      });
    }
    return [...merged, ...rest];
  } catch (err) {
    const ids = tracks.slice(0, TOP_N).map((t) => t.id);
    console.log("[youtube-enrich]", {
      error: err instanceof Error ? err.message : String(err),
      ids,
    });
    return tracks;
  }
}