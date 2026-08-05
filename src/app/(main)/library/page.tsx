"use client";

/**
 * Your Library (Slice 4.5) — the user's playlists as a responsive grid.
 * Real data via useMyPlaylists (TanStack Query → Supabase). Create opens the
 * shared CreatePlaylistDialog; delete asks for confirmation first. Track counts
 * come from the getMyPlaylists aggregate (trackCount) and stay fresh because
 * both mutations invalidate ["playlists"].
 *
 * Design: 8px cards on bg-surface lifting to bg-elevated on hover; the green
 * 9999px Create button; 2/3/4-col grid; skeleton cards while loading; empty +
 * error states included.
 */
import { useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { useDeletePlaylist, useMyPlaylists } from "@/hooks/use-playlists";
import { CreatePlaylistDialog } from "@/components/playlist/create-playlist-dialog";
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
import { cn } from "@/lib/utils";
import type { Playlist } from "@/types/playlist";

/** Stable keys for the 8 skeleton cards — never index keys (CLAUDE.md). */
const SKELETON_KEYS = ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"] as const;

const GRID = "grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function LibraryPage() {
  const { data: playlists, isPending, isError, refetch } = useMyPlaylists();
  const deletePlaylist = useDeletePlaylist();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Playlist | null>(null);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold md:text-3xl">Your Library</h1>
        <Button
          onClick={() => setCreateOpen(true)}
          className="rounded-full px-5"
        >
          <Plus className="size-4" />
          Create playlist
        </Button>
      </header>

      {isPending ? (
        <LibrarySkeletons />
      ) : isError ? (
        <LibraryError onRetry={() => void refetch()} />
      ) : !playlists || playlists.length === 0 ? (
        <LibraryEmpty onCreate={() => setCreateOpen(true)} />
      ) : (
        <ul className={GRID}>
          {playlists.map((playlist) => (
            <PlaylistCard
              key={playlist.id}
              playlist={playlist}
              onDelete={() => setDeleteTarget(playlist)}
            />
          ))}
        </ul>
      )}

      <CreatePlaylistDialog open={createOpen} onOpenChange={setCreateOpen} />

      {/* Delete confirmation */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete playlist?</DialogTitle>
            <DialogDescription>
              {deleteTarget ? (
                <>
                  “{deleteTarget.name}” and its{" "}
                  {deleteTarget.trackCount ?? 0}{" "}
                  {(deleteTarget.trackCount ?? 0) === 1 ? "track" : "tracks"}{" "}
                  will be permanently removed.
                </>
              ) : (
                "This can't be undone."
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={deletePlaylist.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="rounded-full"
              disabled={!deleteTarget || deletePlaylist.isPending}
              onClick={() => {
                if (!deleteTarget) return;
                deletePlaylist.mutate(deleteTarget.id, {
                  onSuccess: () => setDeleteTarget(null),
                });
              }}
            >
              {deletePlaylist.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---- Card ------------------------------------------------------------------- */

function PlaylistCard({
  playlist,
  onDelete,
}: {
  playlist: Playlist;
  onDelete: () => void;
}) {
  const count = playlist.trackCount ?? 0;
  const meta = `${count} ${count === 1 ? "track" : "tracks"} · Created ${formatDate(
    playlist.createdAt,
  )}`;

  return (
    <li className="group relative rounded-[8px] bg-surface transition-colors duration-150 hover:bg-elevated">
      <Link
        href={`/playlist/${playlist.id}`}
        aria-label={`Open playlist ${playlist.name}`}
        className="block p-4"
      >
        <div className="mb-3 grid aspect-square w-full place-items-center rounded-[8px] bg-elevated text-4xl font-black text-brand">
          {playlist.name.charAt(0).toUpperCase()}
        </div>
        <h3 className="truncate text-sm font-semibold text-foreground">
          {playlist.name}
        </h3>
        <p className="mt-1 truncate text-xs text-muted-foreground">{meta}</p>
      </Link>

      {/* Delete — always visible on touch, hover-reveal on desktop */}
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${playlist.name}`}
        title="Delete playlist"
        className={cn(
          "absolute top-3 right-3 grid size-9 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors duration-150",
          "hover:bg-destructive/20 hover:text-destructive",
          "md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100",
        )}
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}

/* ---- States ------------------------------------------------------------------ */

function LibrarySkeletons() {
  return (
    <ul className={GRID}>
      {SKELETON_KEYS.map((key) => (
        <li key={key} className="rounded-[8px] bg-surface p-4">
          <Skeleton className="mb-3 aspect-square w-full rounded-[8px]" />
          <Skeleton className="h-4 w-2/3 rounded-full" />
          <Skeleton className="mt-2 h-3 w-1/2 rounded-full" />
        </li>
      ))}
    </ul>
  );
}

function LibraryEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[8px] border border-dashed border-border px-6 py-16 text-center">
      <p className="font-medium text-foreground">Create your first playlist to get started</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Save songs from Search into playlists — they'll show up here and in the
        sidebar.
      </p>
      <Button onClick={onCreate} className="mt-2 rounded-full px-5">
        <Plus className="size-4" />
        Create playlist
      </Button>
    </div>
  );
}

function LibraryError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[8px] border border-dashed border-border px-6 py-16 text-center">
      <p className="text-sm text-muted-foreground">
        Could not load your playlists.
      </p>
      <Button variant="outline" onClick={onRetry} className="rounded-full">
        Try again
      </Button>
    </div>
  );
}
