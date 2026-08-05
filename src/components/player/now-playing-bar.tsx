"use client";

import { memo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  Music,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { cn, formatDuration } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";
import {
  useCurrentTrack,
  useDuration,
  useHistory,
  useIsLoading,
  useIsPaused,
  useIsPlaying,
  usePlayerActions,
  usePosition,
  useQueue,
  useStreamError,
  useVolume,
} from "@/hooks/use-player";

/**
 * Fixed bottom player bar (90px) — fully wired (Slice 4.3). Rendered as three
 * isolated memoized sub-components, each subscribing to its own granular store
 * selectors, so a position tick (~60fps) re-renders only the center section:
 *   - TrackInfo        → currentTrack / isLoading / streamError
 *   - PlaybackControls → position / duration / isPlaying / queue / history
 *   - VolumeControl    → volume
 * The shell subscribes to nothing, so it never re-renders (120fps rule #4).
 *
 * Motion (emil / apple): seek is real-time data → linear, no spring; volume is
 * instant; position numbers update with no animation.
 *
 * Mobile: floats above the bottom nav (bottom-14); Desktop: flush at bottom.
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
        <TrackInfo />
        <PlaybackControls />
        <VolumeControl />
      </div>
    </motion.div>
  );
}

/* ---- Left: now-playing info ------------------------------------------------ */

function TrackInfoBase() {
  const currentTrack = useCurrentTrack();
  const isLoading = useIsLoading();
  const streamError = useStreamError();
  const openFullScreen = useUIStore((s) => s.openFullScreenPlayer);

  const hasTrack = currentTrack !== null;
  const hasError = streamError !== null;

  return (
    <button
      type="button"
      onClick={openFullScreen}
      disabled={!hasTrack}
      aria-label={hasTrack ? "Open full screen player" : undefined}
      title={hasTrack ? "Open full screen player" : "Pick a song to start"}
      className="group flex min-w-0 cursor-pointer items-center gap-3 rounded-[8px] p-2 -m-2 text-left outline-none transition-colors duration-150 disabled:cursor-default focus-visible:ring-3 focus-visible:ring-ring/50 hover:bg-elevated/40"
    >
      {hasTrack && currentTrack.thumbnail ? (
        <motion.span
          layoutId={`nowplaying-art-${currentTrack.id}`}
          className="relative grid size-12 shrink-0"
        >
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
              <Loader2 className="size-4 animate-spin text-foreground" aria-hidden />
            </span>
          )}
        </motion.span>
      ) : (
        <motion.div
          layoutId={hasTrack ? `nowplaying-art-${currentTrack.id}` : undefined}
          className="grid size-12 shrink-0 place-items-center rounded-[8px] bg-surface text-muted-foreground"
        >
          <Music className="size-5" />
        </motion.div>
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
    </button>
  );
}

const TrackInfo = memo(TrackInfoBase);

/* ---- Center: transport + seek ---------------------------------------------- */

const TRANSPORT_BTN =
  "grid size-11 shrink-0 place-items-center rounded-full cursor-pointer transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40";

function PlaybackControlsBase() {
  const currentTrack = useCurrentTrack();
  const isPlaying = useIsPlaying();
  const isPaused = useIsPaused();
  const streamError = useStreamError();
  const position = usePosition();
  const duration = useDuration();
  const queue = useQueue();
  const history = useHistory();
  const { resume, pause, seek, next, previous } = usePlayerActions();

  const hasTrack = currentTrack !== null;
  const hasError = streamError !== null;
  const canSeek = hasTrack && duration > 0 && !hasError;
  const max = Math.max(duration, 1);

  // While dragging, hold the pointer value so the rAF position tick doesn't
  // fight the thumb; seek fires once on release (onValueCommit).
  const [drag, setDrag] = useState<number | null>(null);
  const shown = drag ?? Math.min(position, max);

  const togglePlay = () => {
    if (!hasTrack || hasError) return;
    if (isPlaying) pause();
    else resume();
  };

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      {/* Transport row */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void previous()}
          disabled={history.length === 0}
          aria-label="Previous"
          title="Previous"
          className={cn(
            TRANSPORT_BTN,
            "text-muted-foreground hover:bg-elevated hover:text-foreground",
          )}
        >
          <SkipBack className="size-5" />
        </button>

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
          className={cn(
            TRANSPORT_BTN,
            "bg-foreground text-background hover:scale-105",
          )}
        >
          {isPlaying && !isPaused ? (
            <Pause className="size-5" />
          ) : (
            <Play className="ml-0.5 size-5" />
          )}
        </button>

        <button
          type="button"
          onClick={() => void next()}
          disabled={queue.length === 0}
          aria-label="Next"
          title="Next"
          className={cn(
            TRANSPORT_BTN,
            "text-muted-foreground hover:bg-elevated hover:text-foreground",
          )}
        >
          <SkipForward className="size-5" />
        </button>
      </div>

      {/* Seek */}
      <div className="flex w-full max-w-md items-center gap-2">
        <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
          {formatDuration(position)}
        </span>
        <Slider
          value={[shown]}
          min={0}
          max={max}
          step={1}
          disabled={!canSeek}
          onValueChange={(v) => setDrag(Array.isArray(v) ? v[0] : v)}
          onValueCommitted={(v) => {
            setDrag(null);
            if (canSeek) seek(Array.isArray(v) ? v[0] : v);
          }}
          className="flex-1"
        />
        <span className="w-9 shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {formatDuration(duration)}
        </span>
      </div>
    </div>
  );
}

const PlaybackControls = memo(PlaybackControlsBase);

/* ---- Right: volume --------------------------------------------------------- */

function VolumeControlBase() {
  const volume = useVolume();
  const { setVolume } = usePlayerActions();

  const lastNonZero = useRef(1); // restore target for unmute

  const muted = volume <= 0;
  const toggleMute = () => {
    if (muted) setVolume(lastNonZero.current > 0 ? lastNonZero.current : 1);
    else {
      lastNonZero.current = volume;
      setVolume(0);
    }
  };

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? "Unmute" : "Mute"}
        title={muted ? "Unmute" : "Mute"}
        className={cn(
          TRANSPORT_BTN,
          "text-muted-foreground hover:bg-elevated hover:text-foreground",
        )}
      >
        {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
      </button>
      <Slider
        value={[volume]}
        min={0}
        max={1}
        step={0.01}
        onValueChange={(v) => setVolume(Array.isArray(v) ? v[0] : v)}
        className="w-24"
        aria-label="Volume"
      />
    </div>
  );
}

const VolumeControl = memo(VolumeControlBase);

export default memo(NowPlayingBarBase);