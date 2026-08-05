/**
 * LRCLIB lyrics types — raw response shape plus the normalized app type.
 *
 * Raw fields are optional (LRCLIB returns null/omits fields on some tracks;
 * e.g. an instrumental has no plainLyrics). We validate only what we consume,
 * at the point of normalization — consistent with src/types/piped.ts.
 */

/** One record from LRCLIB `/api/get` (or an item in a `/api/search` result). */
export interface LrclibTrack {
  id?: number;
  trackName?: string | null;
  artistName?: string | null;
  albumName?: string | null;
  /** Duration in seconds. */
  duration?: number | null;
  /** True when LRCLIB marks the track instrumental (no vocals expected). */
  instrumental?: boolean;
  /** Plain-text lyrics, or null when the track has none. */
  plainLyrics?: string | null;
  /** LRC-format, time-synced lyrics, or null when only plain lyrics exist. */
  syncedLyrics?: string | null;
}

/** Lyrics payload returned to clients via /api/lyrics/[id]. */
export interface LyricsData {
  /** LRC-format, time-synced lyrics, or null when none are available. */
  syncedLyrics: string | null;
  /** Plain-text lyrics, or null when the track has no lyrics at all. */
  plainLyrics: string | null;
  /** True when LRCLIB marks the track instrumental. */
  instrumental: boolean;
}