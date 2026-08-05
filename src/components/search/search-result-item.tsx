"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { Play } from "lucide-react";
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
 * One playable search row. Memoized so position ticks (which re-render only
 * the player bar) never re-render the result list. Row IS the button — a
 * full-row 48px tap/click target, no nested cards/tiles (impeccable). The Play
 * indicator is decorative (a <span>, not a nested button) so there's a single
 * interactive element.
 *
 * Motion (emil / animation-vocabulary):
 * - Hover: row lifts to bg-elevated + thumb dims via 150ms ease-out opacity
 * - Click: pressed scale(0.98) over 100ms
 * - Active row: 1px brand ring + brand play icon (playing affordance)
 */
function SearchResultItemBase({ track, active, onSelect }: SearchResultItemProps) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.1, ease: "easeOut" }}
      onClick={() => onSelect(track)}
      aria-label={`Play ${track.title} by ${track.artist ?? "Unknown artist"}`}
      className={cn(
        "group flex h-12 w-full cursor-pointer items-center gap-3 rounded-[8px] px-2 text-left outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50",
        active ? "bg-elevated/70 ring-1 ring-brand/70" : "hover:bg-elevated",
      )}
    >
      {/* Thumbnail (48px, 8px radius) + decorative play indicator */}
      <span className="relative grid size-12 shrink-0">
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
      </span>

      {/* Metadata */}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">
          {track.title}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {track.artist ?? "Unknown artist"}
        </span>
      </span>

      {/* Duration */}
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {formatDuration(track.duration)}
      </span>
    </motion.button>
  );
}

export const SearchResultItem = memo(SearchResultItemBase);