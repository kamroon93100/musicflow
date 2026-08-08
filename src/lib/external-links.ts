import type { PlayDestination } from "@/lib/history/actions";
import type { Track } from "@/types/piped";

/**
 * Deep-link builders for the external playback buttons (Slice 4.11 pivot).
 * MusicFlow doesn't stream — each button hands the track to a real service.
 */
export function externalLinkFor(
  track: Track,
  destination: PlayDestination,
): string {
  switch (destination) {
    case "youtube":
      return `https://www.youtube.com/watch?v=${track.id}`;
    case "youtube_music":
      return `https://music.youtube.com/watch?v=${track.id}`;
    case "spotify":
      // No stable Spotify lookup without an ID — search by title + artist.
      const query = [track.title, track.artist].filter(Boolean).join(" ");
      return `https://open.spotify.com/search/${encodeURIComponent(query)}`;
  }
}
