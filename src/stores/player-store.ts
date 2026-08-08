"use client";

/**
 * Player store — single source of truth for the SELECTED track + queue
 * (discovery-first pivot, Slice 4.11). No audio lives here: MusicFlow no longer
 * streams server-side; playback happens in the user's own service (YouTube /
 * YouTube Music / Spotify). Selecting a track just records it here and opens
 * the full-screen card, whose open-link buttons hand off to the external player.
 *
 * Queue model (unchanged from the streaming era): `queue` holds the UPCOMING
 * tracks after `currentTrack`; `currentIndex` is the current track's position
 * in the original selection. Consumers (home / search / playlist pages) keep
 * calling `playQueue(tracks, index)` — the API is preserved.
 *
 * State isolation: consumers select fields granularly (see use-player.ts), so
 * a track change re-renders only the player surfaces.
 */
import { create } from "zustand";
import type { Track, TrackMetadata as PipedTrackMetadata } from "@/types/piped";
import { useUIStore } from "@/stores/ui-store";

export interface PlayerState {
  currentTrack: Track | null;
  /** Upcoming tracks after currentTrack (the `[current, ...queue]` model). */
  queue: Track[];
  currentIndex: number;
  shuffle: boolean;

  playTrack: (track: Track) => Promise<void>;
  playQueue: (tracks: Track[], startIndex?: number) => Promise<void>;
  toggleShuffle: () => void;
}

/* ---- Store ------------------------------------------------------------------- */
export const usePlayerStore = create<PlayerState>()((set, get) => ({
  currentTrack: null,
  queue: [],
  currentIndex: 0,
  shuffle: false,

  playTrack: (track) => selectTrack([track], 0),
  playQueue: (tracks, startIndex = 0) => selectTrack(tracks, startIndex),
  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
}));

/* ---- Internal helpers --------------------------------------------------------- */

/**
 * Fire-and-forget enrichment (Slice 4.10 Phase 3). Requests /api/enrich after a
 * track is selected and MERGES the returned album/cover metadata into the store
 * (the card's progressive artwork upgrade). Guards: only fires when the track
 * has an artist (MB needs one), only writes when the SAME track is still
 * current (user may have selected another), never blocks UI, never retries.
 * The server caches 30d, so re-selects hit cache.
 */
function fireEnrichment(track: Track): void {
  if (!track.artist) return; // MB query needs an artist — skip otherwise
  const params = new URLSearchParams({
    title: track.title,
    artist: track.artist,
  });
  void fetch(`/api/enrich/${encodeURIComponent(track.id)}?${params.toString()}`)
    .then((res) => res.json())
    .then(
      (json: { success?: boolean; data?: PipedTrackMetadata | null }) => {
        if (!json.success || !json.data) return;
        const current = usePlayerStore.getState().currentTrack;
        if (!current || current.id !== track.id) return; // stale — user switched
        usePlayerStore.setState({
          currentTrack: {
            ...current,
            metadata: { ...(current.metadata ?? {}), ...json.data },
          },
        });
      },
    )
    .catch(() => {
      // silent — enrichment failure never breaks the card
    });
}

/**
 * Select a track: record it + its upcoming queue, fire enrichment, and open the
 * full-screen card (clicking a track opens the player card — pivot criterion).
 */
async function selectTrack(tracks: Track[], startIndex: number): Promise<void> {
  if (tracks.length === 0) return;
  const start = Math.min(Math.max(startIndex, 0), tracks.length - 1);
  const { shuffle } = usePlayerStore.getState();
  let upcoming = tracks.slice(start + 1);
  if (shuffle) upcoming = shuffleArray(upcoming);

  const current = tracks[start];
  usePlayerStore.setState({
    currentTrack: current,
    queue: upcoming,
    currentIndex: start,
  });
  fireEnrichment(current);
  useUIStore.getState().openFullScreenPlayer();
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
