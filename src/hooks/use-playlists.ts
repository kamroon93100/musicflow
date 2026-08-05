"use client";

/**
 * TanStack Query hooks for playlist CRUD (Slice 3.6). Server actions return
 * `{ error }` on failure (matching auth); each hook adapts that into a thrown
 * rejection so useQuery/useMutation error states work uniformly. Mutations
 * invalidate + refetch (no optimistic updates this slice — Phase 4).
 *
 * Query keys: ["playlists"] and ["playlist-tracks", <id>].
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPlaylist,
  deletePlaylist,
  getMyPlaylists,
  getPlaylistWithTracks,
} from "@/lib/playlists/actions";
import {
  addTrackToPlaylist,
  removeTrackFromPlaylist,
} from "@/lib/playlists/track-actions";
import type { Track } from "@/types/piped";
import type {
  CreatePlaylistInput,
  Playlist,
  PlaylistWithTracks,
} from "@/types/playlist";

function throwIfError<T>(result: T | { error: string }): T {
  if (result && typeof result === "object" && "error" in result) {
    throw new Error((result as { error: string }).error);
  }
  return result as T;
}

/** Current user's playlists, newest first. */
export function useMyPlaylists() {
  return useQuery<Playlist[]>({
    queryKey: ["playlists"],
    queryFn: async () => throwIfError(await getMyPlaylists()),
  });
}

/** A playlist with its ordered tracks. Disabled until an id is provided. */
export function usePlaylistTracks(playlistId: string) {
  return useQuery<PlaylistWithTracks>({
    queryKey: ["playlist-tracks", playlistId],
    queryFn: async () => throwIfError(await getPlaylistWithTracks(playlistId)),
    enabled: !!playlistId,
  });
}

export function useCreatePlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePlaylistInput): Promise<Playlist> =>
      throwIfError(await createPlaylist(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["playlists"] }),
  });
}

export function useDeletePlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (playlistId: string): Promise<void> => {
      const result = await deletePlaylist(playlistId);
      if (result.error) throw new Error(result.error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["playlists"] }),
  });
}

export function useAddTrack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      playlistId,
      track,
    }: {
      playlistId: string;
      track: Track;
    }): Promise<void> => {
      const result = await addTrackToPlaylist(playlistId, track);
      if (result.error) throw new Error(result.error);
    },
    onSuccess: (_data, vars) =>
      queryClient.invalidateQueries({
        queryKey: ["playlist-tracks", vars.playlistId],
      }),
  });
}

export function useRemoveTrack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      playlistId,
      trackId,
    }: {
      playlistId: string;
      trackId: string;
    }): Promise<void> => {
      const result = await removeTrackFromPlaylist(playlistId, trackId);
      if (result.error) throw new Error(result.error);
    },
    onSuccess: (_data, vars) =>
      queryClient.invalidateQueries({
        queryKey: ["playlist-tracks", vars.playlistId],
      }),
  });
}