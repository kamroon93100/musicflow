import type { Track } from "@/types/piped";

/**
 * Progressive artwork resolver (Slice 4.10 Phase 4).
 * - Prefer metadata.coverUrl (CAA — album context, high quality; arrives 1-5s
 *   after play starts via on-play MusicBrainz enrichment)
 * - Fall back to track.thumbnail (YouTube — instant, always present on search)
 * - Return null only if both are absent (rare/impossible edge)
 */
export function pickArtwork(track: Track): string | null {
  return track.metadata?.coverUrl ?? track.thumbnail ?? null;
}
