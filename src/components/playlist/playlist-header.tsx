"use client";

/**
 * Playlist header (Slice 4.5) — cover + name/description + meta + actions.
 * Rendered above the track list on the detail page.
 *
 * Layout:
 *   - Desktop: 232px square cover left, text + actions right.
 *   - Mobile (<md): 160px cover centered, text left-aligned below.
 *
 * Cover: playlists have no artwork, so we render a deterministic gradient
 * placeholder — hashing playlist.id picks one of four pre-defined dark
 * gradients (stable across renders, no Math.random — CLAUDE.md perf/UX).
 * TODO(phase-5): wire real cover once actions/toPlaylist exposes coverUrl.
 *
 * Actions: 56px brand-green Play + 48px ghost Shuffle + "..." menu
 * (Edit details / Delete playlist). When the playlist is empty there's
 * nothing to play — Play and Shuffle are hidden, the menu stays.
 *
 * Motion (emil): the header sits above the fold so it enters instantly (no
 * entrance animation). Play gets whileHover/whileTap spring (stiffness 400,
 * damping 30, matches the full-screen player's transport). The "..." menu
 * animates via base-ui's native popup animation (scale + opacity) rather than
 * a second framer AnimatePresence — wrapping base-ui's Popup would double-
 * animate and fight its open/close lifecycle.
 *
 * Perf: receives the full playlist as a prop — no store subscriptions.
 * memo() + useMemo(gradient) mean parent re-renders don't recompute.
 */
import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { MoreHorizontal, Pencil, Play, Shuffle, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { gradientFor } from "@/lib/cover";
import { cn, formatTotalDuration } from "@/lib/utils";
import type { PlaylistWithTracks } from "@/types/playlist";

interface PlaylistHeaderProps {
  playlist: PlaylistWithTracks;
  onPlayAll: () => void;
  onShufflePlay: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function PlaylistHeaderBase({
  playlist,
  onPlayAll,
  onShufflePlay,
  onEdit,
  onDelete,
}: PlaylistHeaderProps) {
  const gradient = useMemo(() => gradientFor(playlist.id), [playlist.id]);

  const { name, description, tracks } = playlist;
  const hasTracks = tracks.length > 0;

  // Total duration in seconds — null/absent durations skipped silently.
  const totalSeconds = useMemo(
    () => tracks.reduce((sum, t) => sum + (t.metadata?.duration ?? 0), 0),
    [tracks],
  );

  const meta = `${tracks.length} ${tracks.length === 1 ? "track" : "tracks"} · ${formatTotalDuration(totalSeconds)}`;

  return (
    <header className="flex flex-col items-center gap-5 md:flex-row md:items-end md:gap-6">
      {/* Cover — 160px centered on mobile, 232px left-aligned on desktop */}
      <div
        aria-hidden
        className={cn(
          "grid aspect-square shrink-0 place-items-center rounded-[8px]",
          gradient,
          "size-40 md:size-58",
        )}
      >
        <span className="select-none text-6xl font-black text-white/20 md:text-7xl">
          {name.charAt(0).toUpperCase()}
        </span>
      </div>

      {/* Text + actions */}
      <div className="w-full min-w-0 text-center md:text-left">
        <p className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
          Playlist
        </p>
        <h1 className="mt-1 text-3xl font-black text-foreground line-clamp-2 md:text-5xl">
          {name}
        </h1>
        {description && (
          <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
            {description}
          </p>
        )}
        <p className="mt-2 text-xs font-medium text-muted-foreground">{meta}</p>

        {/* Actions */}
        <div className="mt-4 flex items-center justify-center gap-2 md:justify-start">
          {hasTracks && (
            <>
              <motion.button
                type="button"
                onClick={onPlayAll}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                aria-label={`Play ${name}`}
                title={`Play ${name}`}
                className="grid size-14 shrink-0 cursor-pointer place-items-center rounded-full bg-brand text-black shadow-[0_8px_24px_rgba(29,185,84,0.35)] outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 hover:shadow-[0_8px_32px_rgba(29,185,84,0.5)]"
              >
                <Play className="ml-0.5 size-6" />
              </motion.button>

              <motion.button
                type="button"
                onClick={onShufflePlay}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                aria-label={`Shuffle play ${name}`}
                title="Shuffle play"
                className="grid size-12 shrink-0 cursor-pointer place-items-center rounded-full border border-white/20 text-foreground outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 hover:bg-elevated"
              >
                <Shuffle className="size-5" />
              </motion.button>
            </>
          )}

          {/* "..." menu — edit / delete */}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Playlist ${name} options`}
              title="More options"
              className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 hover:bg-elevated hover:text-foreground"
            >
              <MoreHorizontal className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil />
                Edit details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 />
                Delete playlist
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

const PlaylistHeader = memo(PlaylistHeaderBase);
export default PlaylistHeader;
