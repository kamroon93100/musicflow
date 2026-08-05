"use client";

/**
 * Playlist track row (Slice 4.5) — a single 48px row rendering one
 * PlaylistTrackEntry's snapshot metadata. Playable row (index → play icon on
 * hover, equalizer when active) + trailing duration + remove (X) button.
 *
 * Perf (CRITICAL — a list item):
 *   - React.memo whole component.
 *   - NO player-store subscription here. `isPlaying` is passed in as a prop
 *     by the parent list, and only the active row receives `true` — so a
 *     play/pause toggle re-renders at most the one active row, not all of them.
 *   - The equalizer animates with transform scaleY (GPU), not height.
 *   - When not animating (paused/static), it's plain spans — no rAF ticking.
 *
 * Motion (emil):
 *   - Row bg change ~150ms ease-out on hover.
 *   - Row press whileTap scale(0.995) — subtle, list not button-first.
 *   - X hover scale(1.1) 100ms ease-out.
 *   - Drag lift is handled by the parent Reorder.Item whileDrag (scale +
 *     shadow), so this row carries no drag state.
 *
 * The X button is a sibling of the row <button> (absolutely positioned, like
 * the before-reorder page) so its click never bubbles into onPlay.
 *
 * Root is a <div>: in PlaylistTrackList the Reorder.Item wrapper is the <li>,
 * giving valid <ul><li><div> nesting.
 */
import { memo } from "react";
import { motion } from "framer-motion";
import { Music, Play, X } from "lucide-react";
import { cn, formatDuration } from "@/lib/utils";
import type { PlaylistTrackEntry } from "@/types/playlist";

/* Stable ids for the equalizer bars — never index keys (CLAUDE.md). */
const EQ_BARS = [
  { key: "eq-a", duration: 0.6, h: "h-2" },
  { key: "eq-b", duration: 0.9, h: "h-4" },
  { key: "eq-c", duration: 0.75, h: "h-3" },
] as const;

/**
 * Active-track indicator. 3 bars scaleY pulse (0.35→1) each on its own loop
 * when playing; a static set when paused. transform-scaleY only (GPU).
 */
function Equalizer({ isPlaying }: { isPlaying: boolean }) {
  const bar =
    "w-[3px] origin-bottom rounded-full bg-brand";
  if (!isPlaying) {
    return (
      <span className="flex h-4 items-end gap-[3px]" aria-hidden>
        {EQ_BARS.map((b) => (
          <span key={b.key} className={cn(bar, b.h)} />
        ))}
      </span>
    );
  }
  return (
    <span className="flex h-4 items-end gap-[3px]" aria-hidden>
      {EQ_BARS.map((b) => (
        <motion.span
          key={b.key}
          className={cn(bar, "h-4")}
          animate={{ scaleY: [0.35, 1, 0.35] }}
          transition={{
            duration: b.duration,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut",
          }}
        />
      ))}
    </span>
  );
}

interface PlaylistTrackRowProps {
  entry: PlaylistTrackEntry;
  index: number;
  isActive: boolean;
  isPlaying: boolean;
  /** Stable handlers (same identity every render) so React.memo holds. Each
   *  receives the entry; the row binds its own entry internally on click. */
  onPlay: (entry: PlaylistTrackEntry) => void;
  onRemove: (entry: PlaylistTrackEntry) => void;
}

function PlaylistTrackRowBase({
  entry,
  index,
  isActive,
  isPlaying,
  onPlay,
  onRemove,
}: PlaylistTrackRowProps) {
  const track = entry.metadata;
  // Defensive: a valid row always has snapshot metadata; bail if somehow null.
  if (!track) return null;

  const label = `Play ${track.title}${track.artist ? ` by ${track.artist}` : ""}`;

  // Root is a div: Reorder.Item (the list wrapper) is the <li>. ul > li > div.
  return (
    <div className="group relative">
      {/* Play row — the row IS the button (48px target, mirrors SearchResultItem) */}
      <motion.button
        type="button"
        onClick={() => onPlay(entry)}
        whileTap={{ scale: 0.995 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        aria-label={label}
        aria-current={isActive ? "true" : undefined}
        className={cn(
          "flex h-12 w-full min-w-0 cursor-pointer items-center gap-3 rounded-[8px] px-2 text-left outline-none transition-colors duration-150 ease-out focus-visible:ring-3 focus-visible:ring-ring/50",
          isActive ? "bg-elevated/70 ring-1 ring-brand/70" : "hover:bg-elevated/40",
        )}
      >
        {/* Col 1 — index | play-on-hover | active equalizer */}
        <span className="grid w-6 shrink-0 place-items-center" aria-hidden>
          {isActive ? (
            <Equalizer isPlaying={isPlaying} />
          ) : (
            <>
              <span className="text-sm tabular-nums text-muted-foreground group-hover:hidden">
                {index + 1}
              </span>
              <Play className="hidden size-4 text-brand group-hover:block" />
            </>
          )}
        </span>

        {/* Col 2 — thumbnail + title/artist */}
        <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-[4px] bg-surface text-muted-foreground">
          {track.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={track.thumbnail}
              alt=""
              width={40}
              height={40}
              loading="lazy"
              className="size-10 object-cover"
            />
          ) : (
            <Music className="size-4" />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-sm font-medium", isActive ? "text-brand" : "text-foreground")}>
            {track.title}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {track.artist ?? "Unknown artist"}
          </span>
        </span>

        {/* Col 3 — duration, padded clear of the trailing X */}
        <span className="shrink-0 pr-12 text-xs tabular-nums text-muted-foreground">
          {formatDuration(track.duration ?? 0)}
        </span>
      </motion.button>

      {/* Col 4 — Remove (X): hover-reveal on desktop, always on touch */}
      <button
        type="button"
        onClick={() => onRemove(entry)}
        aria-label={`Remove ${track.title} from playlist`}
        title="Remove from playlist"
        className={cn(
          "absolute top-1/2 right-2 grid size-9 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-muted-foreground outline-none transition-transform duration-100 ease-out focus-visible:ring-3 focus-visible:ring-ring/50",
          "hover:scale-110 hover:bg-destructive/20 hover:text-destructive",
          "md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100",
        )}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

const PlaylistTrackRow = memo(PlaylistTrackRowBase);
export default PlaylistTrackRow;