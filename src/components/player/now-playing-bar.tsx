"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { Music, Play, Volume2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";

/**
 * Fixed bottom player bar (90px). Placeholder only — every control is
 * disabled; real playback lands in Slice 2.5 (Howler + Zustand player store).
 * Memoized so it never re-renders as other UI changes (120fps rule #4).
 *
 * Mobile: floats above the bottom nav (bottom-14) so the tab bar sits at the
 * very bottom. Desktop: flush at the viewport bottom.
 */
function NowPlayingBarBase() {
  return (
    <motion.div
      initial={{ y: 96 }}
      animate={{ y: 0 }}
      transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
      className="fixed inset-x-0 bottom-14 z-30 h-[90px] bg-elevated/60 shadow-[0_-8px_32px_rgba(0,0,0,0.5)] backdrop-blur md:bottom-0"
    >
      <div className="grid h-full grid-cols-[1fr_2fr_1fr] items-center gap-4 px-4 md:px-6">
        {/* Left (25%): now-playing info */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-12 shrink-0 place-items-center rounded-[8px] bg-surface text-muted-foreground">
            <Music className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              Not playing
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Pick a song to start
            </p>
          </div>
        </div>

        {/* Center (50%): transport + progress */}
        <div className="flex flex-col items-center justify-center gap-2">
          <button
            type="button"
            disabled
            aria-label="Play"
            aria-disabled="true"
            title="Available in Slice 2.5"
            className="grid size-9 place-items-center rounded-full bg-foreground text-background disabled:opacity-40"
          >
            <Play className="ml-0.5 size-5" />
          </button>
          <div className="flex w-full max-w-md items-center gap-2">
            <span className="text-[11px] tabular-nums text-muted-foreground">
              0:00
            </span>
            <Slider defaultValue={[0]} min={0} max={100} disabled className="flex-1" />
            <span className="text-[11px] tabular-nums text-muted-foreground">
              0:00
            </span>
          </div>
        </div>

        {/* Right (25%): volume */}
        <div className="flex items-center justify-end gap-2">
          <Volume2 className="size-4 shrink-0 text-muted-foreground" />
          <Slider defaultValue={[0]} min={0} max={100} disabled className="w-24" />
        </div>
      </div>
    </motion.div>
  );
}

export default memo(NowPlayingBarBase);