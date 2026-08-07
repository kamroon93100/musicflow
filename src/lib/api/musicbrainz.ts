/**
 * MusicBrainz + Cover Art Archive enrichment (Slice 4.10 Phase 3). Server-only.
 *
 * Runs ON PLAY (D2=B decision), not on search. Resolves the canonical album /
 * cover-art / MBIDs for a track by querying MusicBrainz (then Cover Art Archive
 * for the album front cover) and caches the result per artist+title for 30 days.
 *
 * MB is strict about two things:
 *   - Rate: 1 request/second/client. Enforced by a module-scope promise queue
 *     (scheduleMbRequest) so concurrent enrich requests serialize with a 1s gap
 *     regardless of how they arrive.
 *   - User-Agent: REQUIRED — MusicBrainz 403s without a real UA string.
 *
 * ENRICHMENT IS SILENT AND OPTIONAL: any failure (timeout, no match, CAA 404)
 * returns null so the request/audio path is unaffected. Metadata stays at
 * whatever it was (possibly YouTube-only from Phase 2).
 */
import { createHash } from "crypto";
import { cacheGet, cacheKey, cacheSet } from "@/lib/cache/redis";
import type { Track, TrackMetadata } from "@/types/piped";

/**
 * Sentinel cached when MB can't provide a hit. `kind` distinguishes a genuine
 * no-match (long-lived) from a transient transport failure (short-lived) so a
 * real miss isn't re-queried for a month while a blip can retry soon. On read,
 * behavior is identical for both — `kind` is observability only.
 */
interface MbNegative {
  negative: true;
  kind: "no-match" | "transport-error";
}

/** Genuine "no match" — MB answered but had no qualifying recordings. */
const MB_NEGATIVE_NO_MATCH: MbNegative = { negative: true, kind: "no-match" };
/** Transient error (timeout/network/4xx/5xx) — may resolve, so expire soon. */
const MB_NEGATIVE_TRANSPORT: MbNegative = {
  negative: true,
  kind: "transport-error",
};

const MB_TTL_SECONDS = 2_592_000; // 30 d — positive enrichment
const MB_NEGATIVE_TTL_HARD = 2_592_000; // 30 d — genuine "no match"
const MB_NEGATIVE_TTL_SOFT = 3_600; // 1 h — transient transport error
const MB_RATE_LIMIT_MS = 1_000; // 1 req/sec/client
const REQUEST_TIMEOUT_MS = 5_000;
const MB_UA = "muuzic/1.0 (https://github.com/kamroon93100/musicflow)";
const MB_API = "https://musicbrainz.org/ws/2/recording/";
const CAA_RELEASE_GROUP = "https://coverartarchive.org/release-group";

/** Cache key builder — also used by /api/enrich for the X-Cache header. */
export function mbCacheKey(track: {
  title: string;
  artist: string | null;
}): string {
  const digest = createHash("sha1")
    .update(`${track.artist ?? ""}|${track.title}`)
    .digest("hex");
  return cacheKey("mb", digest);
}

/* ---- Rate limiter (module-scope, never exported) -------------------------------- */
let queue: Promise<void> = Promise.resolve();
/**
 * Serialize MB requests to 1/sec: each request .then()s on the previous one and
 * the chain carries a 1s timer after every completion (success or failure), so
 * concurrent play events queue without bursting the API.
 */
function scheduleMbRequest<T>(fn: () => Promise<T>): Promise<T> {
  const result = queue.then(() => fn());
  queue = result
    .then(() => new Promise<void>((resolve) => setTimeout(resolve, MB_RATE_LIMIT_MS)))
    .catch(() => new Promise<void>((resolve) => setTimeout(resolve, MB_RATE_LIMIT_MS)));
  return result;
}

/* ---- MB response shapes --------------------------------------------------------- */

interface MbRelease {
  title?: string;
  "release-group"?: {
    id?: string;
    "primary-type"?: string;
  };
}

interface MbRecording {
  id?: string;
  score?: number;
  title?: string;
  "artist-credit"?: Array<{ artist?: { id?: string; name?: string } }>;
  releases?: MbRelease[];
}

interface MbHit {
  mbid?: string;
  artistMbid?: string;
  album?: string;
  releaseGroupId?: string;
}

/** True when any of a recording's releases is a primary-type Album. */
function isAlbumGroup(rec: MbRecording): boolean {
  return (rec.releases ?? []).some(
    (rel) => rel["release-group"]?.["primary-type"] === "Album",
  );
}

/** First release carrying a release-group id, else the first release. */
function pickRelease(rec: MbRecording): MbRelease | undefined {
  const rels = rec.releases ?? [];
  return rels.find((r) => r["release-group"]?.id) ?? rels[0];
}

/** Highest score, Album-primary release-group preferred. */
function pickBest(recordings: MbRecording[]): MbHit | null {
  const withReleases = recordings.filter(
    (r) => Array.isArray(r.releases) && r.releases.length > 0,
  );
  if (withReleases.length === 0) return null;

  withReleases.sort((a, b) => {
    // Album-primary first, then descending MB match score.
    const album = Number(isAlbumGroup(b)) - Number(isAlbumGroup(a));
    return album !== 0 ? album : (b.score ?? 0) - (a.score ?? 0);
  });

  const best = withReleases[0];
  const release = pickRelease(best);
  const artist = best["artist-credit"]?.[0]?.artist;
  return {
    mbid: best.id,
    artistMbid: artist?.id,
    album: release?.title,
    releaseGroupId: release?.["release-group"]?.id,
  };
}

/** Query MusicBrainz (rate-limited). Throws on timeout/non-OK so the caller catches. */
async function mbQuery(artist: string, title: string): Promise<MbHit | null> {
  return scheduleMbRequest(async () => {
    const query = `artist:"${artist}" AND recording:"${title}"`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(
        `${MB_API}?query=${encodeURIComponent(query)}&fmt=json&limit=3`,
        {
          signal: controller.signal,
          headers: { "User-Agent": MB_UA, Accept: "application/json" },
          cache: "no-store",
        },
      );
      if (!res.ok) throw new Error(`MusicBrainz → HTTP ${res.status}`);
      const json = (await res.json()) as { recordings?: MbRecording[] };
      return pickBest(json.recordings ?? []);
    } finally {
      clearTimeout(timeout);
      controller.abort();
    }
  });
}

/**
 * Resolve the album front cover via Cover Art Archive. Follows the 307 redirect
 * to the actual image URL; any non-OK outcome → undefined (no cover). Never
 * throws. Not rate-limited (separate service from MB).
 */
async function resolveCover(
  releaseGroupId: string,
): Promise<string | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${CAA_RELEASE_GROUP}/${encodeURIComponent(releaseGroupId)}/front-500`,
      {
        signal: controller.signal,
        redirect: "follow",
        headers: { "User-Agent": MB_UA },
        cache: "no-store",
      },
    );
    if (!res.ok) return undefined; // 404 = no cover; other errors also silent
    return res.url; // final URL after the redirect
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

/**
 * Enrich a track from MusicBrainz + CAA. Returns null on ANY failure (MB
 * outage, no match, CAA 404) — never throws, never breaks playback. Positive
 * Negative results are cached (30d no-match / 1h transport-error) so a miss
 * isn't refetched every play while a transient blip can resolve quickly.
 * every play.
 */
export async function enrichTrackFromMusicBrainz(
  track: Track,
): Promise<TrackMetadata | null> {
  if (!track.artist) return null; // MB query needs an artist; no-op otherwise

  const key = mbCacheKey(track);
  const cached = await cacheGet<TrackMetadata | MbNegative>(key);
  if (cached !== null) {
    return (cached as MbNegative).negative === true
      ? null
      : (cached as TrackMetadata);
  }

  try {
    const hit = await mbQuery(track.artist, track.title);
    if (!hit) {
      // 200 but no qualifying recording → genuine miss, cache long.
      await cacheSet(key, MB_NEGATIVE_NO_MATCH, MB_NEGATIVE_TTL_HARD);
      return null;
    }
    const coverUrl = hit.releaseGroupId
      ? await resolveCover(hit.releaseGroupId)
      : undefined;

    const metadata: TrackMetadata = {
      ...(track.metadata ?? {}), // preserve YT phase-2 data (channelId, etc.)
      ...(hit.album ? { album: hit.album } : {}),
      ...(coverUrl ? { coverUrl } : {}),
      ...(hit.mbid ? { mbid: hit.mbid } : {}),
      ...(hit.artistMbid ? { artistMbid: hit.artistMbid } : {}),
      source: "musicbrainz", // more canonical than 'youtube' → overrides it
      enrichedAt: Date.now(),
    };
    await cacheSet(key, metadata, MB_TTL_SECONDS);
    return metadata;
  } catch (err) {
    console.log("[musicbrainz]", {
      error: err instanceof Error ? err.message : String(err),
      artist: track.artist,
      title: track.title,
    });
    // Timeout/network/4xx/5xx → likely transient, expire in 1h so we retry.
    await cacheSet(key, MB_NEGATIVE_TRANSPORT, MB_NEGATIVE_TTL_SOFT);
    return null;
  }
}