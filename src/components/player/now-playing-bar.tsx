"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { Loader2, Music, Pause, Play, Volume2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  useCurrentTrack,
  useIsLoading,
  useIsPaused,
  useIsPlaying,
  usePlayerActions,
  useStreamError,
} from "@/hooks/use-player";

/**
 * Fixed bottom player bar (90px). Partial wire-up (Slice 4.1): shows the
 * current track and a working Play/Pause; seek + volume are still disabled
 * until Slice 4.3. Granular selectors only (120fps rule #4) so position/volume
 * updates never re-render unrelated UI.
 *
 * Mobile: floats above the bottom nav (bottom-14) so the tab bar sits at the
 * very bottom. Desktop: flush at the viewport bottom.
 */
function NowPlayingBarBase() {
  const currentTrack = useCurrentTrack();
  const isPlaying = useIsPlaying();
  const isPaused = useIsPaused();
  const isLoading = useIsLoading();
  const streamError = useStreamError();
  const { resume, pause } = usePlayerActions();

  const hasTrack = currentTrack !== null;
  const hasError = streamError !== null;
  const togglePlay = () => {
    if (!hasTrack || hasError) return;
    if (isPlaying) pause();
    else resume();
  };

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
          {hasTrack && currentTrack.thumbnail ? (
            <span className="relative grid size-12 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentTrack.thumbnail}
                alt=""
                width={48}
                height={48}
                loading="lazy"
                className="size-12 rounded-[8px] object-cover"
              />
              {isLoading && (
                <span className="absolute inset-0 grid place-items-center rounded-[8px] bg-black/50">
                  <Loader2
                    className="size-4 animate-spin text-foreground"
                    aria-hidden
                  />
                </span>
              )}
            </span>
          ) : (
            <div className="grid size-12 shrink-0 place-items-center rounded-[8px] bg-surface text-muted-foreground">
              <Music className="size-5" />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {hasTrack ? currentTrack.title : "Not playing"}
            </p>
            <p
              className={cn(
                "truncate text-xs",
                hasError ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {hasTrack
                ? hasError
                  ? "Stream unavailable"
                  : currentTrack.artist ?? "Unknown artist"
                : "Pick a song to start"}
            </p>
          </div>
        </div>

        {/* Center (50%): transport + progress */}
        <div className="flex flex-col items-center justify-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            disabled={!hasTrack || hasError}
            aria-label={isPlaying ? "Pause" : "Play"}
            aria-disabled={!hasTrack || hasError}
            title={
              hasError
                ? "Stream unavailable. Tap the song again to retry."
                : hasTrack
                  ? isPlaying
                    ? "Pause"
                    : "Play"
                  : "Pick a song first"
            }
            className="grid size-9 cursor-pointer place-items-center rounded-full bg-foreground text-background transition-colors duration-150 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPlaying && !isPaused ? (
              <Pause className="size-5" />
            ) : (
              <Play className="ml-0.5 size-5" />
            )}
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