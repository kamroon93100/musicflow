"use client";

/**
 * React bindings over the player store.
 *
 * Use the granular selectors in hot paths: position/duration tick at rAF rate,
 * so anything that subscribes to the whole store re-renders every frame
 * (violates the 120fps rule). usePlayerActions() is safe for any component —
 * actions are stable references, so it never re-renders on state changes.
 */
import { useShallow } from "zustand/react/shallow";
import { usePlayerStore } from "@/stores/player-store";

/** Convenience: whole store. Re-renders on ANY change — prefer granular. */
export function usePlayer() {
  return usePlayerStore();
}

/* ---- Granular selectors (perf isolation) ---- */
export const useCurrentTrack = () => usePlayerStore((s) => s.currentTrack);
export const useIsPlaying = () => usePlayerStore((s) => s.isPlaying);
export const useIsPaused = () => usePlayerStore((s) => s.isPaused);
export const useIsLoading = () => usePlayerStore((s) => s.isLoading);
export const usePosition = () => usePlayerStore((s) => s.position);
export const useDuration = () => usePlayerStore((s) => s.duration);
export const useVolume = () => usePlayerStore((s) => s.volume);
export const useQueue = () => usePlayerStore((s) => s.queue);
export const useHistory = () => usePlayerStore((s) => s.history);
export const useCurrentIndex = () => usePlayerStore((s) => s.currentIndex);
export const useShuffleMode = () => usePlayerStore((s) => s.shuffle);
export const useRepeatMode = () => usePlayerStore((s) => s.repeat);

/** Stable action set — selected via useShallow, never re-renders on state. */
export function usePlayerActions() {
  return usePlayerStore(
    useShallow((s) => ({
      playTrack: s.playTrack,
      playQueue: s.playQueue,
      pause: s.pause,
      resume: s.resume,
      stop: s.stop,
      next: s.next,
      previous: s.previous,
      seek: s.seek,
      setVolume: s.setVolume,
      toggleShuffle: s.toggleShuffle,
      cycleRepeat: s.cycleRepeat,
      addToQueue: s.addToQueue,
      removeFromQueue: s.removeFromQueue,
      clearQueue: s.clearQueue,
    })),
  );
}