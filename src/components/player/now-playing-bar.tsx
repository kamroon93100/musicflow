"use client";

/**
 * Fixed bottom player bar (90px) — discovery-first (Slice 4.11). No audio
 * transport: MusicFlow hands playback to the user's own service. The bar shows
 * the selected track (artwork + title/artist) and the three external playback
 * buttons, each opening its service in a new tab (and recording a "played"
 * event). The track info is the trigger for the full-screen card, sharing a
 * Framer layoutId so the artwork morphs between the two surfaces.
 *
 * Rendered as two isolated memoized sub-components, each subscribing to its own
 * granular store selectors, so a track change re-renders only what it must
 * (120fps rule #4):
 *   - TrackInfo   → currentTrack
 *   - External bar buttons → currentTrack (via the same prop from the shell)
 * The shell subscribes to nothing, so it never re-renders.
 *
 * Mobile: floats above the bottom nav (bottom-14); Desktop: flush at bottom.
 */
import { memo } from "react";
import { motion } from "framer-motion";
import { Music } from "lucide-react";
import { pickArtwork } from "@/lib/streaming/artwork";
import { useUIStore } from "@/stores/ui-store";
import { useCurrentTrack } from "@/hooks/use-player";
import ExternalPlaybackButtons from "@/components/player/external-playback-buttons";

function NowPlayingBarBase() {
  return (
    <motion.div
      initial={{ y: 96 }}
      animate={{ y: 0 }}
      transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
      className="fixed inset-x-0 bottom-14 z-30 h-[90px] bg-elevated/60 shadow-[0_-8px_32px_rgba(0,0,0,0.5)] backdrop-blur md:bottom-0"
    >
      <div className="flex h-full items-center justify-between gap-4 px-4 md:px-6">
        <TrackInfo />
        <ExternalButtons />
      </div>
    </motion.div>
  );
}

/* ---- Left: now-playing info (click → full-screen card) --------------------- */

function TrackInfoBase() {
  const currentTrack = useCurrentTrack();
  const openFullScreen = useUIStore((s) => s.openFullScreenPlayer);

  const hasTrack = currentTrack !== null;
  // Progressive art: CAA coverUrl once on-play enrichment lands, else the
  // YouTube thumbnail. Both surfaces share this so the layoutId morph stays in
  // sync when one upgrades to album art.
  const artwork = hasTrack ? pickArtwork(currentTrack) : null;

  return (
    <button
      type="button"
      onClick={openFullScreen}
      disabled={!hasTrack}
      aria-label={hasTrack ? "Open full screen player" : undefined}
      title={hasTrack ? "Open full screen player" : "Pick a song to start"}
      className="group flex min-w-0 cursor-pointer items-center gap-3 rounded-[8px] p-2 -m-2 text-left outline-none transition-colors duration-150 disabled:cursor-default focus-visible:ring-3 focus-visible:ring-ring/50 hover:bg-elevated/40"
    >
      {hasTrack && artwork ? (
        <motion.span
          layoutId={`nowplaying-art-${currentTrack.id}`}
          className="relative grid size-12 shrink-0"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={artwork}
            alt=""
            width={48}
            height={48}
            loading="lazy"
            className="size-12 rounded-[8px] object-cover"
          />
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
        <p className="truncate text-xs text-muted-foreground">
          {hasTrack ? (currentTrack.artist ?? "Unknown artist") : "Pick a song to start"}
        </p>
      </div>
    </button>
  );
}

const TrackInfo = memo(TrackInfoBase);

/* ---- Right: external playback buttons (bar size) --------------------------- */

function ExternalButtonsBase() {
  const currentTrack = useCurrentTrack();
  if (!currentTrack) return null;
  return <ExternalPlaybackButtons track={currentTrack} variant="bar" />;
}

const ExternalButtons = memo(ExternalButtonsBase);

export default memo(NowPlayingBarBase);
