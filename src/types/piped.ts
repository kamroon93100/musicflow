/**
 * Piped API types — raw response shapes plus normalized app types.
 *
 * Raw shapes are intentionally loose (optional + index signature): Piped
 * instances vary in which fields they return, and strict schemas would break
 * the moment a fallback instance omits a field. We validate only what we
 * consume, at the point of normalization.
 */

/** One item in a `/search?filter=music_songs` response. */
export interface PipedSearchItem {
  type?: string;
  /** Relative watch URL, e.g. `/watch?v=VIDEOID` (instance-dependent). */
  url?: string;
  videoId?: string;
  id?: string;
  title?: string;
  /** Duration in seconds. */
  duration?: number | null;
  views?: number;
  thumbnail?: string;
  thumbnailUrl?: string;
  uploaderName?: string;
  uploaderUrl?: string;
  uploaderAvatar?: string;
  uploadedDate?: string;
  musicVideoType?: string;
  album?: string | null;
  /** Any other fields Piped emits; ignored for now. */
  [key: string]: unknown;
}

/** An audio entry in `/streams/:id` → `audioStreams[]`. */
export interface PipedAudioStream {
  url: string;
  /** Format token: "M4A" | "WEBMA" | "OGG" | "MP3" (instance-dependent). */
  format?: string;
  quality?: string;
  mimeType?: string;
  codec?: string;
  /** Bitrate in kbps. */
  bitrate?: number | null;
  contentLength?: number;
  [key: string]: unknown;
}

/** Subset of the `/streams/:id` response we actually consume. */
export interface PipedStreamsResponse {
  title?: string;
  /** Duration in seconds. */
  duration?: number;
  uploader?: string;
  uploaderUrl?: string;
  uploaderAvatar?: string;
  thumbnailUrl?: string;
  uploadDate?: string;
  audioStreams?: PipedAudioStream[];
  [key: string]: unknown;
}

/** Where a track's enriched metadata came from (Slice 4.10). */
export type MetadataSource = "musicbrainz" | "youtube" | "piped";

/**
 * Optional enrichment bag attached to a Track at play time (Slice 4.10).
 * Search results never carry this — it's added by the metadata pipeline when a
 * track is actually played, mirroring the DB `track_metadata` jsonb snapshot.
 * Absent / `undefined` on the hot search path so memoized consumers stay lean.
 */
export interface TrackMetadata {
  album?: string;
  coverUrl?: string;
  mbid?: string;
  artistMbid?: string;
  channelId?: string;
  channelVerified?: boolean;
  source: MetadataSource;
  /** Unix ms when this metadata was recorded. */
  enrichedAt: number;
}

/** Normalized track — field subset aligned with our `tracks` schema. */
export interface Track {
  /** YouTube video ID (text, same format as our schema's track ID). */
  id: string;
  title: string;
  artist: string | null;
  /** Duration in seconds. */
  duration: number | null;
  thumbnail: string | null;
  /** Optional, additive enrichment (Slice 4.10) — always accessed with `?.`. */
  metadata?: TrackMetadata;
}

/** Playable stream payload the `/api/stream/[id]` route returns. */
export interface StreamInfo {
  url: string;
  /** Howler format hint ("mp4"/"webm"/"ogg"/"mp3") or null. */
  format: string | null;
  bitrate: number | null;
  mimeType: string | null;
  contentLength: number | null;
}
