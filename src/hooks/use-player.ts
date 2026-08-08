"use client";

/**
 * React bindings over the player store (discovery-first pivot, Slice 4.11).
 *
 * Audio state is gone (no playback in MusicFlow) — the store is selection +
 * queue only. Granular selectors are kept for the same reason as before:
 * components subscribe narrowly so a track change re-renders only the player
 * surfaces, not the whole page (120fps rule #4). usePlayerActions() is safe
 * for any component — actions are stable references.
 */
import { useShallow } from "zustand/react/shallow";
import { usePlayerStore } from "@/stores/player-store";

/** Convenience: whole store. Re-renders on ANY change — prefer granular. */
export function usePlayer() {
  return usePlayerStore();
}

/* ---- Granular selectors (perf isolation) ---- */
export const useCurrentTrack = () => usePlayerStore((s) => s.currentTrack);
export const useQueue = () => usePlayerStore((s) => s.queue);
export const useCurrentIndex = () => usePlayerStore((s) => s.currentIndex);
export const useShuffleMode = () => usePlayerStore((s) => s.shuffle);

/** Stable action set — selected via useShallow, never re-renders on state. */
export function usePlayerActions() {
  return usePlayerStore(
    useShallow((s) => ({
      playTrack: s.playTrack,
      playQueue: s.playQueue,
      toggleShuffle: s.toggleShuffle,
    })),
  );
}
