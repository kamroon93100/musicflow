"use client";

/**
 * Full-screen player (Slice 4.4, discovery-first rewrite Slice 4.11) —
 * expandable overlay that opens from the NowPlayingBar track-info trigger.
 * Spatial continuity: the artwork shares a Framer `layoutId` with the bar
 * thumbnail, so it morphs out of the bar on open and back into it on close.
 *
 * No audio transport anymore: the card shows the selected track (progressive
 * artwork + title/artist/album) and the three external playback buttons, each
 * opening its service in a new tab. A hint sets the expectation that playback
 * happens in the user's own service.
 *
 * Layout:
 *   - Mobile: full-bleed takeover (h-dvh), closed by swiping the top grab
 *     handle down (Apple Music bottom-sheet pattern) or tapping X.
 *   - Desktop: centered ~600px modal with a dimmed backdrop (click closes).
 *
 * Motion (emil / animation-vocabulary): enter = spring (stiffness 300,
 * damping 30) rising up out of the bar; exit = ease-in 200ms sliding back
 * down.
 */
import { memo, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Music, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { pickArtwork } from "@/lib/streaming/artwork";
import { useCurrentTrack } from "@/hooks/use-player";
import { useUIStore } from "@/stores/ui-store";
import ExternalPlaybackButtons from "@/components/player/external-playback-buttons";
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

        {/* Scrollable middle: artwork, title, external links */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 md:px-8">
          <div className="mx-auto flex w-full max-w-md flex-col items-center">
            <Artwork track={currentTrack} />
            <h1 className="mt-6 w-full truncate text-center text-2xl font-bold text-foreground">
              {currentTrack.title}
            </h1>
            <p className="mt-1 w-full truncate text-center text-sm text-muted-foreground">
              {currentTrack.artist ?? "Unknown artist"}
              {currentTrack.metadata?.channelVerified && (
                <CheckCircle2
                  className="ml-1 inline-block size-3.5 text-muted-foreground"
                  aria-label="Verified channel"
                />
              )}
            </p>
            {currentTrack.metadata?.album && (
              <p className="mt-1 w-full truncate text-center text-sm text-muted-foreground">
                {currentTrack.metadata.album}
              </p>
            )}

            <ExternalPlaybackButtons track={currentTrack} className="mt-8" />

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Playback opens in your preferred service
            </p>
          </div>
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

  // Progressive art: CAA coverUrl when present (arrives on selection), else the
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

const ICON_BTN =
  "grid size-11 shrink-0 place-items-center rounded-full cursor-pointer transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40";
