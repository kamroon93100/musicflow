"use client";

/**
 * Home page track card (Slice 4.6). A 160px square button: thumbnail top,
 * title + artist strip below. Hover fades a 48px brand-green play chip over
 * the thumb (opacity only, 150ms ease-out — no scale; restraint per
 * find-animation-opportunities). Active track gets a brand ring and shares the
 * now-playing-bar artwork layoutId so clicking play morphs the thumb into the
 * bar (apple-design spatial continuity).
 *
 * Thumbnail is a plain <img> (not next/image) — Piped/YT hosts aren't in
 * next.config remotePatterns (KNOWN_ISSUE [4.1]); matches search rows, the
 * bar, and full-screen player.
 *
 * MEMOIZED: list-item rule from CLAUDE.md; the parent passes stable onPlay
 * callbacks (section-scoped) so cards don't re-render on unrelated state.
 */
import { memo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { gradientFor } from "@/lib/cover";
import type { Track } from "@/types/piped";

type HomeTrackCardProps = {
  track: Track;
  isActive: boolean;
  onPlay: () => void;
};

function PlayChip() {
  return (
    <span className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100">
      <span className="grid size-12 place-items-center rounded-full bg-brand text-black shadow-[0_8px_24px_rgba(29,185,84,0.35)]">
        <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    </span>
  );
}

export const HomeTrackCard = memo(function HomeTrackCard({
  track,
  isActive,
  onPlay,
}: HomeTrackCardProps) {
  return (
    <button
      type="button"
      onClick={onPlay}
      aria-pressed={isActive}
      className={cn(
        "group relative w-40 shrink-0 overflow-hidden rounded-[8px] bg-elevated text-left outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50",
        isActive && "ring-2 ring-brand",
      )}
    >
      <motion.span
        layoutId={isActive ? `nowplaying-art-${track.id}` : undefined}
        className="relative block h-[120px] w-full overflow-hidden"
      >
        {track.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={track.thumbnail}
            alt=""
            width={160}
            height={120}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <span
            className={cn("block size-full", gradientFor(track.title))}
            aria-hidden
          />
        )}
        <PlayChip />
      </motion.span>
      <span className="block px-2 py-1.5">
        <span className="block truncate text-sm font-medium text-foreground">
          {track.title}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {track.artist ?? "Unknown artist"}
        </span>
      </span>
    </button>
  );
});