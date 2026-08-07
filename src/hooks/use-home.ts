"use client";

/**
 * TanStack Query hooks for the home page (Slice 4.6). Server actions return
 * `{ error }` on failure (matching auth + playlists); each hook adapts that
 * into a thrown rejection so useQuery's error/loading states work uniformly
 * (same throwIfError pattern as src/hooks/use-playlists.ts).
 *
 * Query keys: ["recently-played"] and ["popular-tracks"] — used for
 * invalidation by later steps, spelling must stay exact.
 */
import { useQuery } from "@tanstack/react-query";
import { getRecentlyPlayed, getPopularTracks } from "@/lib/history/actions";
import type { Track } from "@/types/piped";

function throwIfError<T>(result: T | { error: string }): T {
  if (result && typeof result === "object" && "error" in result) {
    throw new Error((result as { error: string }).error);
  }
  return result;
}

/** The current user's recently played tracks, most recent first. */
export function useRecentlyPlayed(limit = 8) {
  return useQuery({
    queryKey: ["recently-played"],
    queryFn: async () => throwIfError(await getRecentlyPlayed(limit)),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}

/** Most-played tracks across all users (global popularity). */
export function usePopularTracks(limit = 6) {
  return useQuery({
    queryKey: ["popular-tracks"],
    queryFn: async () => throwIfError(await getPopularTracks(limit)),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });
}