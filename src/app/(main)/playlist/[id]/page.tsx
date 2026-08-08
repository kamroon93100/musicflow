"use client";

/**
 * Playlist detail (Slice 4.5) — reads the id param via useParams (client page —
 * Next 16 App Router client pages can't be async). Assembles the new
 * component set:
 *
 *   <PlaylistHeader>   cover + name/desc + meta + Play/Shuffle/"..." menu
 *   sticky column row  "# / Title / Time" (sticks under the top bar while
 *                      the track list scrolls)
 *   <PlaylistTrackList> framer Reorder.Group of PlaylistTrackRow (drag-reorder
 *                      + optimistic remove; empty state handled internally)
 *   <EditPlaylistDialog> rename/description (useUpdatePlaylist, optimistic)
 *   delete Dialog        confirm → deletePlaylist → router.push("/library")
 *
 * Subscriptions (perf gate — 120fps rule #4): the page subscribes ONLY to the
 * playlist query, the active track id, and shuffle — no audio state (Slice
 * 4.11 discovery-first). All handlers are useCallback'd with correct deps so
 * the memo'd list/rows hold across renders.
 *
 * Note: the step-7 sketch's handlers took (entry) params, but the approved
 * PlaylistTrackList interface consumes onPlayTrack(index) / onRemoveTrack(trackId)
 * — the list resolves entry → index/trackId internally. Page handlers match
 * the component interface.
 */
import { useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  useDeletePlaylist,
  usePlaylistTracks,
  useRemoveTrack,
} from "@/hooks/use-playlists";
import {
  useCurrentTrack,
  usePlayerActions,
  useShuffleMode,
} from "@/hooks/use-player";
import PlaylistHeader from "@/components/playlist/playlist-header";
import PlaylistTrackList from "@/components/playlist/playlist-track-list";
import { EditPlaylistDialog } from "@/components/playlist/edit-playlist-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import type { PlaylistTrackEntry } from "@/types/playlist";
import type { Track } from "@/types/piped";

/** Stable keys for the 8 skeleton rows — never index keys (CLAUDE.md). */
const SKELETON_KEYS = ["r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8"] as const;

/** Snapshot metadata for every playable track in order (nulls skipped). */
function tracksOf(entries: PlaylistTrackEntry[]): Track[] {
  return entries
    .map((e) => e.metadata)
    .filter((t): t is Track => t !== null);
}

export default function PlaylistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isPending, isError, refetch } = usePlaylistTracks(id);

  // Active-track state for the list (one subscription each).
  const currentTrack = useCurrentTrack();
  const shuffle = useShuffleMode();
  const { playQueue, toggleShuffle } = usePlayerActions();

  // Mutations (stable from TanStack).
  const removeTrack = useRemoveTrack();
  const deletePlaylist = useDeletePlaylist();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  /* ---- Handlers (useCallback + correct deps — memo chain) ----------------- */

  const handlePlayAll = useCallback(() => {
    if (!data?.tracks.length) return;
    const tracks = tracksOf(data.tracks);
    if (!tracks.length) return;
    playQueue(tracks, 0);
  }, [data, playQueue]);

  const handleShufflePlay = useCallback(() => {
    if (!data?.tracks.length) return;
    if (!shuffle) toggleShuffle();
    handlePlayAll();
  }, [data, shuffle, toggleShuffle, handlePlayAll]);

  const handlePlayTrack = useCallback(
    (index: number) => {
      if (!data?.tracks.length) return;
      playQueue(tracksOf(data.tracks), index);
    },
    [data, playQueue],
  );

  const handleRemoveTrack = useCallback(
    (trackId: string) => {
      removeTrack.mutate({ playlistId: id, trackId });
    },
    [removeTrack, id],
  );

  const openEdit = useCallback(() => setEditOpen(true), []);
  const openDelete = useCallback(() => setDeleteOpen(true), []);

  const handleConfirmDelete = useCallback(() => {
    deletePlaylist.mutate(id, {
      onSuccess: () => router.push("/library"),
      onError: (err) => {
        toast.add({
          title: "Couldn't delete playlist",
          description:
            err instanceof Error ? err.message : "Please try again.",
          type: "error",
        });
      },
    });
  }, [deletePlaylist, id, router]);

  /* ---- States ------------------------------------------------------------- */

  if (isPending) return <PlaylistSkeleton />;
  if (isError) return <PlaylistError onRetry={() => void refetch()} />;
  if (!data) return null;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-8">
      <PlaylistHeader
        playlist={data}
        onPlayAll={handlePlayAll}
        onShufflePlay={handleShufflePlay}
        onEdit={openEdit}
        onDelete={openDelete}
      />

      <div className="mt-6">
        {/* Column labels — sticky under the top bar while the list scrolls.
            Only meaningful when there are rows; the empty state has no list. */}
        {data.tracks.length > 0 && <StickyHeaderRow />}
        <PlaylistTrackList
          playlist={data}
          activeTrackId={currentTrack?.id ?? null}
          onPlayTrack={handlePlayTrack}
          onRemoveTrack={handleRemoveTrack}
        />
      </div>

      <EditPlaylistDialog
        playlist={data}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      {/* Delete confirmation — stays open on error (toast explains). */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete playlist?</DialogTitle>
            <DialogDescription>
              “{data.name}” and its {data.tracks.length}{" "}
              {data.tracks.length === 1 ? "track" : "tracks"} will be
              permanently removed. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteOpen(false)}
              disabled={deletePlaylist.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="rounded-full"
              disabled={deletePlaylist.isPending}
              onClick={handleConfirmDelete}
            >
              {deletePlaylist.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---- Sticky column labels -------------------------------------------------- */

function StickyHeaderRow() {
  return (
    <div className="sticky top-0 z-10 -mx-4 border-b border-border bg-base/80 px-4 py-2 backdrop-blur md:-mx-8 md:px-8">
      <div className="flex select-none items-center gap-3 text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
        <span className="w-6 shrink-0 text-center">#</span>
        <span className="w-10 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">Title</span>
        <span className="shrink-0 pr-12">Time</span>
      </div>
    </div>
  );
}

/* ---- States ---------------------------------------------------------------- */

function PlaylistSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-8">
      <div className="flex flex-col items-center gap-5 md:flex-row md:items-end md:gap-6">
        <Skeleton className="size-40 rounded-[8px] md:size-58" />
        <div className="w-full min-w-0 space-y-3 text-center md:text-left">
          <Skeleton className="mx-auto h-3 w-20 rounded-full md:mx-0" />
          <Skeleton className="mx-auto h-9 w-2/3 rounded-full md:mx-0" />
          <Skeleton className="mx-auto h-3 w-1/3 rounded-full md:mx-0" />
          <Skeleton className="mx-auto h-3 w-1/4 rounded-full md:mx-0" />
          <Skeleton className="mx-auto h-14 w-32 rounded-full md:mx-0" />
        </div>
      </div>
      <div className="mt-8 flex flex-col gap-1">
        {SKELETON_KEYS.map((key) => (
          <div key={key} className="flex h-12 items-center gap-3 px-2">
            <Skeleton className="h-4 w-6" />
            <Skeleton className="size-10 shrink-0 rounded-[4px]" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-1/2 rounded-full" />
              <Skeleton className="h-3 w-1/3 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlaylistError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <p className="text-sm text-muted-foreground">Failed to load playlist.</p>
      <Button variant="outline" onClick={onRetry} className="rounded-full">
        Retry
      </Button>
    </div>
  );
}