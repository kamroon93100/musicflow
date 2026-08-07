"use client";

/**
 * Full-screen player (Slice 4.4) — expandable overlay that opens from the
 * NowPlayingBar track-info trigger. Spatial continuity: the artwork shares a
 * Framer `layoutId` with the bar thumbnail, so it morphs out of the bar on
 * open and back into it on close (apple-design).
 *
 * Layout:
 *   - Mobile: full-bleed takeover (h-dvh), closed by swiping the top grab
 *     handle down (Apple Music bottom-sheet pattern) or tapping X.
 *   - Desktop: centered ~600px modal with a dimmed backdrop (click closes).
 *
 * Motion (emil / animation-vocabulary): enter = spring (stiffness 300,
 * damping 30) rising up out of the bar; exit = ease-in 200ms sliding back
 * down. Seek/volume are real-time data -> no spring, instant.
 *
 * Perf: the panel's middle (art / title / lyrics) never subscribes to
 * position; only PlayerControls (seek) and the lyrics wrapper do. The lyrics
 * line list is memo'd so the 60fps position tick re-renders just the wrapper.
 */
import { memo, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  ListMusic,
  Music,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { LyricsDisplay } from "@/components/player/lyrics-display";
import { cn, formatDuration } from "@/lib/utils";
import { streamErrorMessage } from "@/lib/streaming/error-messages";
import { pickArtwork } from "@/lib/streaming/artwork";
import {
  useCurrentTrack,
  useDuration,
  useHistory,
  useIsLoading,
  useIsPaused,
  useIsPlaying,
  useIsWarmingUp,
  usePlayerActions,
  usePosition,
  useQueue,
  useRepeatMode,
  useShuffleMode,
  useStreamError,
  useVolume,
} from "@/hooks/use-player";
import { useUIStore } from "@/stores/ui-store";
import type { RepeatMode } from "@/stores/player-store";
import type { Track } from "@/types/piped";

/* ---- Media query hook (mobile = < 768px, mirrors the md: breakpoint) ------ */

function subscribeMediaChange(onStoreChange: () => void) {
  const mql = window.matchMedia("(max-width: 767px)");
  mql.addEventListener("change", onStoreChange);
  return () => mql.removeEventListener("change", onStoreChange);
}

function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribeMediaChange,
    () => window.matchMedia("(max-width: 767px)").matches,
    () => false,
  );
}

/* ---- Component -------------------------------------------------------------- */

export default function FullScreenPlayer() {
  const isOpen = useUIStore((s) => s.isFullScreenPlayerOpen);
  const close = useUIStore((s) => s.closeFullScreenPlayer);

  return (
    <AnimatePresence>
      {isOpen && <FullScreenPanel close={close} />}
    </AnimatePresence>
  );
}

function FullScreenPanel({ close }: { close: () => void }) {
  const currentTrack = useCurrentTrack();
  const isLoading = useIsLoading();
  const isWarmingUp = useIsWarmingUp();
  const streamError = useStreamError();
  const isMobile = useIsMobile();

  if (!currentTrack) return null;

  return (
    <motion.div
      className="fixed inset-0 z-40 md:grid md:place-items-center"
      initial="hidden"
      animate="visible"
      exit="hidden"
    >
      {/* Desktop backdrop */}
      <motion.button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={close}
        variants={{
          hidden: { opacity: 0, transition: { duration: 0.2, ease: "easeIn" } },
          visible: { opacity: 1, transition: { duration: 0.2, ease: "easeOut" } },
        }}
        className="absolute inset-0 hidden bg-black/70 backdrop-blur-sm md:block"
      />

      <motion.div
        variants={{
          hidden: { y: "100dvh", transition: { duration: 0.2, ease: "easeIn" } },
          visible: { y: 0, transition: { type: "spring", stiffness: 300, damping: 30 } },
        }}
        className="relative flex h-dvh w-full flex-col overflow-hidden bg-base md:h-[min(880px,92vh)] md:w-[min(600px,92vw)] md:rounded-2xl md:border md:border-white/10 md:shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
      >
        {/* Header: mobile grab handle (drag down to close) + close button */}
        <header className="relative z-10 shrink-0">
          {isMobile && (
            <motion.div
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.5 }}
              dragSnapToOrigin
              onDragEnd={(_, info) => {
                if (info.offset.y > 120 || info.velocity.y > 500) close();
              }}
              className="absolute inset-x-0 top-0 flex cursor-grab justify-center pt-3 active:cursor-grabbing"
              aria-hidden
            >
              <span className="h-1 w-10 rounded-full bg-white/30" />
            </motion.div>
          )}
          <div className="flex items-center justify-end px-4 pt-2 pb-1 md:px-5 md:pt-3 md:pb-1">
            <button
              type="button"
              onClick={close}
              aria-label="Close player"
              title="Close"
              className={cn(
                ICON_BTN,
                "text-muted-foreground hover:bg-elevated hover:text-foreground",
              )}
            >
              <X className="size-5" />
            </button>
          </div>
        </header>

        {/* Scrollable middle: artwork, title, lyrics */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 md:px-8">
          <div className="mx-auto flex w-full max-w-md flex-col items-center">
            <Artwork track={currentTrack} />
            <h1 className="mt-6 w-full truncate text-center text-2xl font-bold text-foreground">
              {currentTrack.title}
            </h1>
            <p
              className={cn(
                "mt-1 w-full truncate text-center text-sm",
                streamError ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {streamError
                ? streamErrorMessage(streamError)
                : currentTrack.artist ?? "Unknown artist"}
              {!streamError && currentTrack.metadata?.channelVerified && (
                <CheckCircle2
                  className="ml-1 inline-block size-3.5 text-muted-foreground"
                  aria-label="Verified channel"
                />
              )}
            </p>
            {!streamError && currentTrack.metadata?.album && (
              <p className="mt-1 w-full truncate text-center text-sm text-muted-foreground">
                {currentTrack.metadata.album}
              </p>
            )}
            {isWarmingUp && isLoading && (
              <p className="mt-2 text-sm text-muted-foreground">
                Warming up stream…
              </p>
            )}
            <LyricsDisplay className="mt-8 w-full" />
          </div>
        </div>

        {/* Pinned controls */}
        <div className="shrink-0 px-5 pb-5 md:px-8 md:pb-7">
          <PlayerControls />
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ---- Artwork (shares layoutId with the bar thumb -> spatial morph) ---------- */

function ArtworkBase({ track }: { track: Track }) {
  const shared = { type: "spring", stiffness: 300, damping: 30 } as const;
  const artClass =
    "size-[min(300px,60vw)] shrink-0 rounded-[8px] shadow-[0_16px_48px_rgba(0,0,0,0.55)] md:size-[400px]";

  // Progressive art: CAA coverUrl when present (arrives on play), else the
  // YouTube thumbnail. Instant swap on state update — no skeleton/fade needed.
  const artwork = pickArtwork(track);

  if (!artwork) {
    return (
      <motion.div
        layoutId={`nowplaying-art-${track.id}`}
        transition={shared}
        className={cn(
          artClass,
          "grid place-items-center bg-surface text-muted-foreground",
        )}
      >
        <Music className="size-16" />
      </motion.div>
    );
  }

  return (
    <motion.div
      layoutId={`nowplaying-art-${track.id}`}
      transition={shared}
      className={artClass}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={artwork}
        alt={`${track.title} artwork`}
        width={400}
        height={400}
        loading="lazy"
        className="size-full rounded-[8px] object-cover"
      />
    </motion.div>
  );
}

const Artwork = memo(ArtworkBase);

/* ---- Pinned controls: seek + transport + volume/queue ----------------------- */

const ICON_BTN =
  "grid size-11 shrink-0 place-items-center rounded-full cursor-pointer transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40";

const REPEAT_LABEL: Record<RepeatMode, string> = {
  off: "Repeat off",
  one: "Repeat one",
  all: "Repeat all",
};

function PlayerControlsBase() {
  const currentTrack = useCurrentTrack();
  const isPlaying = useIsPlaying();
  const isPaused = useIsPaused();
  const streamError = useStreamError();
  const position = usePosition();
  const duration = useDuration();
  const queue = useQueue();
  const history = useHistory();
  const volume = useVolume();
  const shuffle = useShuffleMode();
  const repeat = useRepeatMode();
  const { resume, pause, seek, next, previous, setVolume, toggleShuffle, cycleRepeat } =
    usePlayerActions();

  const hasTrack = currentTrack !== null;
  const hasError = streamError !== null;
  const canSeek = hasTrack && duration > 0 && !hasError;
  const max = Math.max(duration, 1);

  // Local drag snapshot so the rAF position tick doesn't fight the thumb;
  // seek fires once on release (base-ui onValueCommitted).
  const [drag, setDrag] = useState<number | null>(null);
  const shown = drag ?? Math.min(position, max);

  const lastNonZero = useRef(1); // restore target for unmute
  const muted = volume <= 0;

  const togglePlay = () => {
    if (!hasTrack || hasError) return;
    if (isPlaying) pause();
    else resume();
  };

  const toggleMute = () => {
    if (muted) setVolume(lastNonZero.current > 0 ? lastNonZero.current : 1);
    else {
      lastNonZero.current = volume;
      setVolume(0);
    }
  };

  return (
    <div className="w-full">
      {/* Seek */}
      <div className="flex items-center gap-2">
        <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
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
          aria-label="Seek"
        />
        <span className="w-10 shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {formatDuration(duration)}
        </span>
      </div>

      {/* Transport */}
      <div className="mt-4 flex items-center justify-center gap-3 md:gap-4">
        <button
          type="button"
          onClick={toggleShuffle}
          aria-label={shuffle ? "Turn off shuffle" : "Turn on shuffle"}
          aria-pressed={shuffle}
          title={shuffle ? "Shuffle on" : "Shuffle off"}
          className={cn(
            ICON_BTN,
            shuffle
              ? "text-brand"
              : "text-muted-foreground hover:bg-elevated hover:text-foreground",
          )}
        >
          <Shuffle className="size-5" />
        </button>

        <button
          type="button"
          onClick={() => void previous()}
          disabled={history.length === 0}
          aria-label="Previous"
          title="Previous"
          className={cn(
            ICON_BTN,
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
          title={
            hasError
              ? "Stream unavailable. Tap the song again to retry."
              : isPlaying
                ? "Pause"
                : "Play"
          }
          className={cn(ICON_BTN, "size-14 bg-foreground text-background hover:scale-105")}
        >
          {isPlaying && !isPaused ? (
            <Pause className="size-6" />
          ) : (
            <Play className="ml-0.5 size-6" />
          )}
        </button>

        <button
          type="button"
          onClick={() => void next()}
          disabled={queue.length === 0}
          aria-label="Next"
          title="Next"
          className={cn(
            ICON_BTN,
            "text-muted-foreground hover:bg-elevated hover:text-foreground",
          )}
        >
          <SkipForward className="size-5" />
        </button>

        <button
          type="button"
          onClick={cycleRepeat}
          aria-label={REPEAT_LABEL[repeat]}
          aria-pressed={repeat !== "off"}
          title={REPEAT_LABEL[repeat]}
          className={cn(
            ICON_BTN,
            repeat !== "off"
              ? "text-brand"
              : "text-muted-foreground hover:bg-elevated hover:text-foreground",
          )}
        >
          {repeat === "one" ? (
            <Repeat1 className="size-5" />
          ) : (
            <Repeat className="size-5" />
          )}
        </button>
      </div>

      {/* Volume + queue */}
      <div className="mt-5 flex items-center justify-between gap-4">
        <button
          type="button"
          disabled
          aria-label="Queue"
          title="Queue coming in Slice 5.2"
          className={cn(ICON_BTN, "text-muted-foreground")}
        >
          <ListMusic className="size-5" />
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? "Unmute" : "Mute"}
            title={muted ? "Unmute" : "Mute"}
            className={cn(
              ICON_BTN,
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
            className="w-28"
            aria-label="Volume"
          />
        </div>
      </div>
    </div>
  );
}

const PlayerControls = memo(PlayerControlsBase);
