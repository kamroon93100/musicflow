"use client";

import { memo, useState } from "react";
import { motion } from "framer-motion";
import { ListMusic, MoreHorizontal, Play, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreatePlaylistDialog } from "@/components/playlist/create-playlist-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAddTrack, useMyPlaylists } from "@/hooks/use-playlists";
import { toast } from "@/components/ui/toast";
import type { Track } from "@/types/piped";
import { cn } from "@/lib/utils";

/** Seconds → m:ss (e.g. 274 → "4:34"). Null → "–". */
function formatDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "–";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface SearchResultItemProps {
  track: Track;
  /** True when this is the currently playing track (green ring + play icon). */
  active: boolean;
  onSelect: (track: Track) => void;
}

/**
 * One playable search row (Slice 4.5). Memoized so position ticks never
 * re-render the result list. Row IS the button — full-row 48px tap target —
 * with a SIBLING "..." button (DropdownMenu trigger) for "Add to playlist".
 *
 * Structure (no nested buttons — X-button pattern from playlist-track-row):
 *   <div.group.relative>
 *     <motion.button>        ← play row
 *     <DropdownMenu>         ← "..." trigger + menu (sibling, absolute right)
 *     <CreatePlaylistDialog> ← OUTSIDE the menu popup
 *
 * Why the dialog lives outside: base-ui Menu.Popup unmounts its content when
 * the menu closes, so a dialog rendered inside would vanish the moment the
 * "Create new playlist" item closes the menu. State + mutation (addTrack) live
 * at the row level; the lazy data fetch (useMyPlaylists) lives in the
 * AddToPlaylistMenu child, which only mounts when the menu is open — so the
 * playlists query never fires on initial render (perf).
 *
 * Chain-add: "Create new playlist" opens the shared dialog; on success its
 * onCreated(playlist) fires and we chain addTrack with the new id (option a —
 * dialog stays single-purpose and reusable by sidebar/library).
 */
function SearchResultItemBase({ track, active, onSelect }: SearchResultItemProps) {
  const addTrack = useAddTrack();
  const [createOpen, setCreateOpen] = useState(false);

  /**
   * Optimistic add + outcome toasts. TanStack v5 per-call mutate options are
   * only onSuccess/onError/onSettled — onMutate is a HOOK-level option, so the
   * toast confirms on success (a failed add shows only the error, never a false
   * "Added"). The instant list/count update comes from the hook's onMutate
   * cache write, which fires before this returns — UX stays optimistic.
   */
  const handleAdd = (playlistId: string, playlistName: string) => {
    addTrack.mutate(
      { playlistId, track },
      {
        onSuccess: () => {
          toast.add({ title: `Added to ${playlistName}`, type: "success" });
        },
        onError: () => {
          toast.add({ title: "Could not add to playlist", type: "error" });
        },
      },
    );
  };

  // Chained from the create dialog: add the just-created playlist's track.
  const handleCreateAndAdd = (created: { id: string; name: string }) => {
    handleAdd(created.id, created.name);
  };

  return (
    <div className="group relative">
      {/* Play row — the row IS the button (48px target) */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.1, ease: "easeOut" }}
        onClick={() => onSelect(track)}
        aria-label={`Play ${track.title} by ${track.artist ?? "Unknown artist"}`}
        className={cn(
          "flex h-12 w-full cursor-pointer items-center gap-3 rounded-[8px] px-2 text-left outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50",
          active ? "bg-elevated/70 ring-1 ring-brand/70" : "hover:bg-elevated",
        )}
      >
        {/* Thumbnail (48px, 8px radius) + decorative play indicator. Active
            row shares the now-playing-bar layoutId so it morphs into the bar
            thumb on play — slice 4.7 D6, mirroring HomeTrackCard. Only the
            ACTIVE row has a layoutId (undefined otherwise → no Framer
            conflict from duplicate ids in a long list). */}
        <motion.span
          layoutId={active ? `nowplaying-art-${track.id}` : undefined}
          className="relative grid size-12 shrink-0"
        >
          {track.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={track.thumbnail}
              alt=""
              width={48}
              height={48}
              loading="lazy"
              className={cn(
                "size-12 rounded-[8px] object-cover transition-opacity duration-150 ease-out",
                !active && "opacity-90 group-hover:opacity-100",
              )}
            />
          ) : (
            <span className="grid size-12 place-items-center rounded-[8px] bg-surface text-muted-foreground">
              <Play className="size-4" />
            </span>
          )}
          {/* Hover play chip — fades in 150ms ease-out, purely decorative */}
          <span
            aria-hidden
            className={cn(
              "absolute inset-0 grid place-items-center rounded-[8px] bg-black/40 opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100",
              active && "opacity-0",
            )}
          >
            <Play className="size-4 fill-foreground text-foreground" />
          </span>
        </motion.span>

        {/* Metadata */}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            {track.title}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {track.artist ?? "Unknown artist"}
          </span>
        </span>

        {/* Duration — pr-10 keeps it clear of the "..." button */}
        <span className="shrink-0 pr-10 text-xs tabular-nums text-muted-foreground">
          {formatDuration(track.duration)}
        </span>
      </motion.button>

      {/* "..." — Add to playlist menu. Sibling, so its click never plays.
          Hover-reveal on desktop, always visible on touch. */}
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Add ${track.title} to playlist`}
          title="Add to playlist"
          className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-muted-foreground outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 hover:bg-elevated hover:text-foreground md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <AddToPlaylistMenu
            track={track}
            onAdd={handleAdd}
            onCreateClick={() => setCreateOpen(true)}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Outside the menu popup so it survives menu close (see header note). */}
      <CreatePlaylistDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreateAndAdd}
      />
    </div>
  );
}

export const SearchResultItem = memo(SearchResultItemBase);

/* ---- Menu content ---------------------------------------------------------- */

interface AddToPlaylistMenuProps {
  track: Track;
  onAdd: (playlistId: string, playlistName: string) => void;
  onCreateClick: () => void;
}

/**
 * Lazy menu body — only mounted while the menu is open, so useMyPlaylists
 * fetches on demand (never on search render). Loading → skeleton row; error →
 * non-interactive message; zero playlists → skip the header, just create.
 */
function AddToPlaylistMenu({ track, onAdd, onCreateClick }: AddToPlaylistMenuProps) {
  const { data: playlists, isPending, isError } = useMyPlaylists();

  return (
    <>
      {isPending ? (
        <div className="px-1.5 py-1">
          <Skeleton className="h-8 w-full rounded-md" />
        </div>
      ) : isError ? (
        <p className="px-1.5 py-1.5 text-sm text-muted-foreground">
          Failed to load playlists
        </p>
      ) : playlists && playlists.length > 0 ? (
        <>
          {/* Plain div, NOT DropdownMenuLabel — base-ui MenuGroupLabel throws
              MenuGroupContext missing without a Menu.Group parent (KNOWN_ISSUE
              [1.4]). Matches the top-bar email pattern. */}
          <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Add to playlist
          </div>
          {playlists.map((p) => (
            <DropdownMenuItem key={p.id} onClick={() => onAdd(p.id, p.name)}>
              <ListMusic />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
        </>
      ) : null}

      <DropdownMenuItem onClick={onCreateClick}>
        <Plus />
        Create new playlist
      </DropdownMenuItem>
    </>
  );
}