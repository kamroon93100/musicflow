"use client";

/**
 * External playback buttons (Slice 4.11 pivot). MusicFlow doesn't stream —
 * these three buttons hand the selected track to a real service, opening in a
 * new tab with noopener. Each click is also a "played" event: trackPlayEvent is
 * called first (fire-and-forget — history must never block opening the player),
 * then window.open. The history insert is throttled server-side (1/track/5min).
 *
 * Used in two sizes:
 *   - "bar": compact circular icon buttons for the now-playing bar.
 *   - "card": full-width labeled buttons for the full-screen player card.
 *
 * Perf: memo'd; props (track) change only when the selection changes.
 */
import { memo } from "react";
import { Music2, Search, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackPlayEvent, type PlayDestination } from "@/lib/history/actions";
import { externalLinkFor } from "@/lib/external-links";
import type { Track } from "@/types/piped";

const DESTINATIONS: Array<{
  destination: PlayDestination;
  label: string;
  hint: string;
  Icon: typeof Music2;
}> = [
  {
    destination: "youtube_music",
    label: "Open in YouTube Music",
    hint: "Open in YouTube Music",
    Icon: Music2,
  },
  {
    destination: "youtube",
    label: "Open in YouTube",
    hint: "Open in YouTube",
    Icon: Play,
  },
  {
    destination: "spotify",
    label: "Search on Spotify",
    hint: "Search on Spotify",
    Icon: Search,
  },
] as const;

interface ExternalPlaybackButtonsProps {
  track: Track;
  variant?: "bar" | "card";
  className?: string;
}

function ExternalPlaybackButtonsBase({
  track,
  variant = "card",
  className,
}: ExternalPlaybackButtonsProps) {
  const open = (destination: PlayDestination) => {
    // Record the "played" event first — never block on it.
    void trackPlayEvent(track, destination).catch(() => {});
    window.open(
      externalLinkFor(track, destination),
      "_blank",
      "noopener,noreferrer",
    );
  };

  if (variant === "bar") {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        {DESTINATIONS.map(({ destination, hint, Icon }) => (
          <button
            key={destination}
            type="button"
            onClick={() => open(destination)}
            aria-label={hint}
            title={hint}
            className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 hover:bg-elevated hover:text-foreground"
          >
            <Icon className="size-5" />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("grid w-full gap-2.5", className)}>
      {DESTINATIONS.map(({ destination, label, Icon }) => (
        <button
          key={destination}
          type="button"
          onClick={() => open(destination)}
          className="flex h-12 w-full cursor-pointer items-center gap-3 rounded-full border border-white/10 bg-elevated px-5 text-sm font-medium text-foreground outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 hover:bg-surface hover:border-white/20"
        >
          <Icon className="size-5 shrink-0" />
          {label}
        </button>
      ))}
    </div>
  );
}

const ExternalPlaybackButtons = memo(ExternalPlaybackButtonsBase);
export default ExternalPlaybackButtons;
