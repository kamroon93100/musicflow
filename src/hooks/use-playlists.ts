"use client";

/**
 * TanStack Query hooks for playlist CRUD (Slices 3.6 + 4.5). Server actions
 * return `{ error }` on failure (matching auth); each hook adapts that into a
 * thrown rejection so useQuery/useMutation error states work uniformly.
 *
 * Since 4.5 the mutating hooks are optimistic where it improves UX: add/remove
 * update both cache keys instantly, reorder applies a local row move, and the
 * header playlist edit patches the list + detail caches concurrently. Every
 * mutation rolls back its snapshot on error and invalidates on settle so the
 * cache always resyncs to server truth.
 *
 * Query keys: ["playlists"] and ["playlist-tracks", <id>].
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPlaylist,
  deletePlaylist,
  getMyPlaylists,
  getPlaylistWithTracks,
  updatePlaylist,
} from "@/lib/playlists/actions";
import {
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  reorderTrack,
} from "@/lib/playlists/track-actions";
import type { Track } from "@/types/piped";
import type {
  CreatePlaylistInput,
  Playlist,
  PlaylistTrackEntry,
  PlaylistWithTracks,
  UpdatePlaylistInput,
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
    mutationFn: async (vars: AddTrackVariables): Promise<void> => {
      const result = await addTrackToPlaylist(vars.playlistId, vars.track);
      if (result.error) throw new Error(result.error);
    },
    onMutate: async ({ playlistId, track }) => {
      await queryClient.cancelQueries({
        queryKey: ["playlist-tracks", playlistId],
      });
      await queryClient.cancelQueries({ queryKey: ["playlists"] });

      const prevDetail = queryClient.getQueryData<PlaylistWithTracks>([
        "playlist-tracks",
        playlistId,
      ]);
      const prevList = queryClient.getQueryData<Playlist[]>(["playlists"]);

      // Append at the end with a temp id; real row replaces it after refetch.
      const entry: PlaylistTrackEntry = {
        id: optimisticTrackId(track.id),
        trackId: track.id,
        position: prevDetail?.tracks.length ?? 0,
        metadata: track,
      };
      queryClient.setQueryData<PlaylistWithTracks>(
        ["playlist-tracks", playlistId],
        (old) =>
          old
            ? {
                ...old,
                tracks: [...old.tracks, entry],
                trackCount: (old.trackCount ?? old.tracks.length) + 1,
              }
            : old,
      );
      queryClient.setQueryData<Playlist[]>(["playlists"], (old) =>
        old?.map((p) =>
          p.id === playlistId && p.trackCount != null
            ? { ...p, trackCount: p.trackCount + 1 }
            : p,
        ),
      );

      return { prevDetail, prevList };
    },
    onError: (_err, vars, context) => {
      if (context?.prevDetail) {
        queryClient.setQueryData(
          ["playlist-tracks", vars.playlistId],
          context.prevDetail,
        );
      }
      if (context?.prevList) {
        queryClient.setQueryData(["playlists"], context.prevList);
      }
    },
    onSettled: (_data, _error, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["playlist-tracks", vars.playlistId],
      });
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
    },
  });
}

export function useRemoveTrack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: RemoveTrackVariables): Promise<void> => {
      const result = await removeTrackFromPlaylist(vars.playlistId, vars.trackId);
      if (result.error) throw new Error(result.error);
    },
    onMutate: async ({ playlistId, trackId }) => {
      await queryClient.cancelQueries({
        queryKey: ["playlist-tracks", playlistId],
      });
      await queryClient.cancelQueries({ queryKey: ["playlists"] });

      const prevDetail = queryClient.getQueryData<PlaylistWithTracks>([
        "playlist-tracks",
        playlistId,
      ]);
      const prevList = queryClient.getQueryData<Playlist[]>(["playlists"]);

      // Removed count = rows matching the YouTube id in the cached detail
      // (mirrors removeTrackFromPlaylist's `.eq("track_id", trackId)` delete).
      const removedCount =
        prevDetail?.tracks.filter((t) => t.trackId === trackId).length ?? 1;

      queryClient.setQueryData<PlaylistWithTracks>(
        ["playlist-tracks", playlistId],
        (old) =>
          old
            ? {
                ...old,
                tracks: old.tracks.filter((t) => t.trackId !== trackId),
                trackCount: Math.max(
                  0,
                  (old.trackCount ?? old.tracks.length) - removedCount,
                ),
              }
            : old,
      );
      // Keep the list's count aggregate in sync optimistically.
      queryClient.setQueryData<Playlist[]>(["playlists"], (old) =>
        old?.map((p) =>
          p.id === playlistId && p.trackCount != null
            ? { ...p, trackCount: Math.max(0, p.trackCount - removedCount) }
            : p,
        ),
      );

      return { prevDetail, prevList };
    },
    onError: (_err, vars, context) => {
      if (context?.prevDetail) {
        queryClient.setQueryData(
          ["playlist-tracks", vars.playlistId],
          context.prevDetail,
        );
      }
      if (context?.prevList) {
        queryClient.setQueryData(["playlists"], context.prevList);
      }
    },
    onSettled: (_data, _error, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["playlist-tracks", vars.playlistId],
      });
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
    },
  });
}

/** Arguments for a single reorder: target playlist, the moved YouTube video
 *  id, and its new 0-based index. */
type ReorderMutationVariables = {
  playlistId: string;
  trackId: string;
  newPosition: number;
};

/** Module-level counter for the optimistic insert's temp id (unique across
 *  rapid succeeds-less adds; never `index` — CLAUDE.md). Real id replaces it
 *  once onSettled invalidates and refetches. */
let optimisticSeq = 0;
const optimisticTrackId = (trackId: string) => `opt:${trackId}:${optimisticSeq++}`;

/** Arguments for an add: target playlist + the normalized track to append. */
type AddTrackVariables = {
  playlistId: string;
  track: Track;
};

/** Arguments for a remove: target playlist + the YouTube video id to drop. */
type RemoveTrackVariables = {
  playlistId: string;
  trackId: string;
};

/** Apply a partial update to the playlist-shaped cached row (Playlist and
 *  PlaylistWithTracks share name/description/isPublic/createdAt/updatedAt). */
function applyUpdate<T extends Playlist>(row: T, input: UpdatePlaylistInput): T {
  if (!input.name && input.description === undefined) return row;
  return {
    ...row,
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
  };
}

/**
 * Move a track to a new index (Slice 4.5). Optimistic: onMutate snapshots the
 * cached PlaylistWithTracks, applies the reorder locally (pure row move —
 * positions are recomputed as 0..n-1 to mirror the server's normalized order),
 * and rolls back to the snapshot on error. onSettled invalidates so the cache
 * resyncs to server truth.
 *
 * Reorder never changes track count, so ["playlists"] is left untouched (the
 * header/library counts come from a separate aggregate and don't depend on
 * order). The UI serializes drags via isPending (dragListener off while
 * in-flight) because reorderTrack is not transactional — a second concurrent
 * reorder could interleave and corrupt positions (see KNOWN_ISSUE.md [4.5]).
 */
export function useReorderTrack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      playlistId,
      trackId,
      newPosition,
    }: ReorderMutationVariables): Promise<void> => {
      const result = await reorderTrack(playlistId, trackId, newPosition);
      if (result.error) throw new Error(result.error);
    },
    onMutate: async ({ playlistId, trackId, newPosition }) => {
      await queryClient.cancelQueries({
        queryKey: ["playlist-tracks", playlistId],
      });
      const previous = queryClient.getQueryData<PlaylistWithTracks>([
        "playlist-tracks",
        playlistId,
      ]);
      queryClient.setQueryData<PlaylistWithTracks>(
        ["playlist-tracks", playlistId],
        (old) => {
          if (!old) return old;
          const fromIndex = old.tracks.findIndex((t) => t.trackId === trackId);
          if (fromIndex === -1) return old;
          const target = Math.max(0, Math.min(newPosition, old.tracks.length - 1));
          if (fromIndex === target) return old;
          const next: PlaylistTrackEntry[] = old.tracks.slice();
          const [moved] = next.splice(fromIndex, 1);
          next.splice(target, 0, moved);
          // Normalize positions to mirror the server's post-shift order.
          return {
            ...old,
            tracks: next.map((t, i) => ({ ...t, position: i })),
          };
        },
      );
      return { previous };
    },
    onError: (_err, vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["playlist-tracks", vars.playlistId],
          context.previous,
        );
      }
    },
    onSettled: (_data, _error, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["playlist-tracks", vars.playlistId],
      });
    },
  });
}

/**
 * Update name/description (Slice 4.5). Optimistic across BOTH cache keys that
 * render this playlist: the ["playlists"] list (Playlist rows) and the
 * ["playlist-tracks", id] detail (PlaylistWithTracks). Each is patched only if
 * currently cached; updatedAt is deliberately left to server truth (we don't
 * fabricate timestamps client-side). onSettled invalidates both keys.
 *
 * Returns the server's updated Playlist so onSuccess callers (e.g. the edit
 * dialog) can act on it.
 */
export function useUpdatePlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      playlistId: string;
      input: UpdatePlaylistInput;
    }): Promise<Playlist> =>
      throwIfError(await updatePlaylist(vars.playlistId, vars.input)),
    onMutate: async ({ playlistId, input }) => {
      await queryClient.cancelQueries({ queryKey: ["playlists"] });
      await queryClient.cancelQueries({
        queryKey: ["playlist-tracks", playlistId],
      });

      const prevList = queryClient.getQueryData<Playlist[]>(["playlists"]);
      const prevDetail = queryClient.getQueryData<PlaylistWithTracks>([
        "playlist-tracks",
        playlistId,
      ]);

      queryClient.setQueryData<Playlist[]>(["playlists"], (old) =>
        old?.map((p) => (p.id === playlistId ? applyUpdate(p, input) : p)),
      );
      queryClient.setQueryData<PlaylistWithTracks>(
        ["playlist-tracks", playlistId],
        (old) => (old ? applyUpdate(old, input) : old),
      );

      return { prevList, prevDetail };
    },
    onError: (_err, vars, context) => {
      if (context?.prevList) {
        queryClient.setQueryData(["playlists"], context.prevList);
      }
      if (context?.prevDetail) {
        queryClient.setQueryData(
          ["playlist-tracks", vars.playlistId],
          context.prevDetail,
        );
      }
    },
    onSettled: (_data, _error, vars) => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      queryClient.invalidateQueries({
        queryKey: ["playlist-tracks", vars.playlistId],
      });
    },
  });
}