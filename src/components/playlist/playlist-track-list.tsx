"use client";

/**
 * Playlist track list (Slice 4.5, discovery-first tweak Slice 4.11) — framer-
 * motion Reorder.Group wrapper around the PlaylistTrackRow items. This is the
 * one component with real architectural risk (drag + optimistic + race
 * conditions), so the pattern here is explicit.
 *
 * DRAG → EXACTLY ONE MUTATION (the hard part):
 *   Reorder.Group.onReorder fires CONTINUOUSLY during a drag (once per swap) —
 *   we never mutate there. Instead:
 *     - onReorder just mirrors the new order into local state (instant visual)
 *       and flags dragRef.
 *     - Each Reorder.Item's onDragEnd fires once when the drag stops; there we
 *       read the live order from a ref (NOT state — state may be stale in the
 *       onDragEnd closure), compute the moved track's old vs new index, and
 *       fire useReorderTrack ONCE if it actually moved.
 *   A ref is used because onDragEnd fires synchronously right after the last
 *   onReorder; reading `order` (React state) there can see the pre-final-swap
 *   value due to batching. orderRef always has the latest.
 *
 * RACE LOCK: dragListener={!reorderPending && !coarse}. reorderPending (from
 * useReorderTrack) disables drags while a reorder is in-flight — the server
 * reorder is not transactional (KNOWN_ISSUE [4.5] serialization via isPending).
 * Touch reorder is deferred this slice: matchMedia("(pointer: coarse)") turns
 * dragListener off entirely on touch while leaving row taps intact.
 *
 * Resync: local `order` syncs from playlist.tracks (server/cache truth) via
 * useEffect — but ONLY when not mid-drag (dragRef) so a refetch while dragging
 * can't clobber the in-progress order.
 *
 * Valid HTML: Reorder.Group defaults to <ul>, Reorder.Item to <li>, and the
 * row renders a <div> → ul > li > div (screen-reader list semantics included).
 *
 * Perf: memo list; stable useCallback handlers (handlePlay/handleRemove) mean
 * row props are referentially stable, so on a selection change only the active
 * row re-renders (each row gets isActive). No audio state — there's no playing/
 * paused toggling anymore (Slice 4.11).
 */
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Reorder } from "framer-motion";
import { Music } from "lucide-react";
import Link from "next/link";
import PlaylistTrackRow from "@/components/playlist/playlist-track-row";
import { useReorderTrack } from "@/hooks/use-playlists";
import type { PlaylistTrackEntry, PlaylistWithTracks } from "@/types/playlist";

/* ---- Media query hook: coarse pointer (touch) ------------------------------ */

function subscribeMediaChange(onStoreChange: () => void) {
  const mql = window.matchMedia("(pointer: coarse)");
  mql.addEventListener("change", onStoreChange);
  return () => mql.removeEventListener("change", onStoreChange);
}

/** true when the primary input is coarse (touch) — touch reorder deferred (KNOWN_ISSUE [4.5]). */
function useIsCoarsePointer(): boolean {
  return useSyncExternalStore(
    subscribeMediaChange,
    () => window.matchMedia("(pointer: coarse)").matches,
    () => false,
  );
}

/* ---- Component ------------------------------------------------------------ */

interface PlaylistTrackListProps {
  playlist: PlaylistWithTracks;
  /** current selected track's YouTube id (useCurrentTrack()?.id ?? null). */
  activeTrackId: string | null;
  onPlayTrack: (index: number) => void;
  onRemoveTrack: (trackId: string) => void;
}

function PlaylistTrackListBase({
  playlist,
  activeTrackId,
  onPlayTrack,
  onRemoveTrack,
}: PlaylistTrackListProps) {
  const { mutate: reorderMutate, isPending: reorderPending } = useReorderTrack();

  // Local working order during a drag; truth is playlist.tracks.
  const [order, setOrder] = useState<PlaylistTrackEntry[]>(playlist.tracks);
  const dragRef = useRef(false);
  const orderRef = useRef<PlaylistTrackEntry[]>(playlist.tracks);

  // Resync to cache truth whenever it changes — unless a drag is in flight.
  useEffect(() => {
    if (!dragRef.current) {
      orderRef.current = playlist.tracks;
      setOrder(playlist.tracks);
    }
  }, [playlist.tracks]);

  // Called on every micro-swap during a drag. Mirror the order into a ref
  // synchronously (onDragEnd reads the ref, never React state — see header).
  const handleReorder = useCallback((newOrder: PlaylistTrackEntry[]) => {
    dragRef.current = true;
    orderRef.current = newOrder;
    setOrder(newOrder);
  }, []);

  // Fired once per Reorder.Item when its drag ends. Fire the mutation once if
  // the item actually changed position.
  const handleDragEnd = useCallback(
    (entry: PlaylistTrackEntry) => {
      dragRef.current = false;
      const newIndex = orderRef.current.findIndex((t) => t.id === entry.id);
      const oldIndex = playlist.tracks.findIndex((t) => t.id === entry.id);
      if (newIndex !== -1 && newIndex !== oldIndex) {
        reorderMutate({
          playlistId: playlist.id,
          trackId: entry.trackId,
          newPosition: newIndex,
        });
      }
    },
    [playlist.tracks, playlist.id, reorderMutate],
  );

  // Stable handlers so the memo'd rows hold. Rows bind their own entry.
  const handlePlay = useCallback(
    (entry: PlaylistTrackEntry) => {
      const index = orderRef.current.findIndex((t) => t.id === entry.id);
      if (index !== -1) onPlayTrack(index);
    },
    [onPlayTrack],
  );

  const handleRemove = useCallback(
    (entry: PlaylistTrackEntry) => onRemoveTrack(entry.trackId),
    [onRemoveTrack],
  );

  const touchDisabled = useIsCoarsePointer();

  if (order.length === 0) return <EmptyPlaylist />;

  // Column labels live in the PAGE (sticky header row) — this component is just
  // the list, so the labels can stick to the scroll viewport during long drags.
  return (
    <section aria-label="Playlist tracks">
      <Reorder.Group
        axis="y"
        values={order}
        onReorder={handleReorder}
        className="flex flex-col gap-1"
      >
        {order.map((entry, index) => (
          <Reorder.Item
            key={entry.id}
            value={entry}
            dragListener={!reorderPending && !touchDisabled}
            onDragEnd={() => handleDragEnd(entry)}
            whileDrag={{ scale: 1.02 }}
            className="relative"
          >
            <PlaylistTrackRow
              entry={entry}
              index={index}
              isActive={entry.trackId === activeTrackId}
              onPlay={handlePlay}
              onRemove={handleRemove}
            />
          </Reorder.Item>
        ))}
      </Reorder.Group>
    </section>
  );
}

/* ---- Empty state ----------------------------------------------------------- */

function EmptyPlaylist() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[8px] border border-dashed border-border px-6 py-16 text-center">
      <Music className="size-12 text-muted-foreground" />
      <h2 className="font-medium text-foreground">This playlist is empty</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Add tracks from search to start building your collection.
      </p>
      {/* Plain Link styled as the brand button — base-ui Button's render prop
          can't retarget to a non-<button> element (nativeButton warning). */}
      <Link
        href="/search"
        className="mt-2 inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
      >
        Go to search
      </Link>
    </div>
  );
}

const PlaylistTrackList = memo(PlaylistTrackListBase);
export default PlaylistTrackList;