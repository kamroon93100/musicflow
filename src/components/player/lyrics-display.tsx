"use client";

/**
 * Synced lyrics for the full-screen player (Slice 4.4).
 *
 * Fetches via /api/lyrics/[id] (Slice 3.5: LRCLIB + 30d Redis cache). TanStack
 * Query mirrors that server cache client-side: staleTime + gcTime 30 days
 * (lyrics are immutable).
 *
 * Rendering:
 *   - synced LRC -> timed lines, current line highlighted #1DB954 and
 *     auto-centered in the nearest scroll container (the player's middle).
 *   - synced absent but plain present -> static plain text (no highlight).
 *   - instrumental -> "Instrumental track"; otherwise "No lyrics available".
 *
 * Perf: the wrapper re-renders on the 60fps position tick, but the line list
 * is memo'd and only re-renders when the active line changes.
 */
import { memo, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCurrentTrack, usePosition } from "@/hooks/use-player";
import type { LyricsData } from "@/types/lyrics";
import type { Track } from "@/types/piped";

/* ---- LRC parsing ------------------------------------------------------------- */

interface SyncedLine {
  /** Stable identity within one parse; lyrics never reorder, so it stays put. */
  id: number;
  time: number;
  text: string;
}

/** `[mm:ss.xx]` (also `[mm:ss:xx]` / `[mm:ss]`) timestamps → sorted timed lines. */
function parseLrc(lrc: string): SyncedLine[] {
  const lines: SyncedLine[] = [];
  let id = 0;
  for (const raw of lrc.split("\n")) {
    const tags = [
      ...raw.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g),
    ];
    if (tags.length === 0) continue;
    const text = raw.replace(/\[[^\]]*\]/g, "").trim();
    for (const match of tags) {
      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      const fraction = match[3] ? Number(match[3].padEnd(3, "0")) / 1000 : 0;
      lines.push({
        id: id++,
        time: minutes * 60 + seconds + fraction,
        text,
      });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

/* ---- Fetch -------------------------------------------------------------------- */

async function fetchLyrics(track: Track): Promise<LyricsData> {
  const params = new URLSearchParams({ title: track.title });
  if (track.artist) params.set("artist", track.artist);
  // Duration disambiguates the LRCLib match (same-title/different-artist);
  // only sent when actually known.
  if (typeof track.duration === "number" && Number.isFinite(track.duration)) {
    params.set("duration", String(Math.round(track.duration)));
  }
  const res = await fetch(`/api/lyrics/${encodeURIComponent(track.id)}?${params.toString()}`);
  const json = (await res.json()) as {
    success?: boolean;
    data?: LyricsData;
    error?: string;
  };
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? "Failed to load lyrics");
  }
  return json.data;
}

/* ---- Component ----------------------------------------------------------------- */

function LyricsDisplayBase({ className }: { className?: string }) {
  const currentTrack = useCurrentTrack();
  const position = usePosition();

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["lyrics", currentTrack?.id],
    queryFn: () => fetchLyrics(currentTrack as Track),
    enabled: currentTrack !== null,
    staleTime: 30 * 24 * 60 * 60 * 1000,
    gcTime: 30 * 24 * 60 * 60 * 1000,
    retry: 1,
  });

  const lines = useMemo(
    () => (data?.syncedLyrics ? parseLrc(data.syncedLyrics) : null),
    [data],
  );

  // Active line = last line whose timestamp is <= current playback position.
  const activeIndex = useMemo(() => {
    if (!lines || lines.length === 0) return -1;
    let index = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= position) index = i;
      else break;
    }
    return index;
  }, [lines, position]);

  const activeLineRef = useRef<HTMLParagraphElement | null>(null);

  // Auto-center the active line within the player's scroll container. Fires
  // only when the active line changes, not every position tick.
  useEffect(() => {
    activeLineRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeIndex]);

  return (
    <section className={className} aria-label="Lyrics">
      {isPending && <LyricsSkeleton />}
      {isError && <LyricsError onRetry={() => void refetch()} />}
      {!isPending && !isError && data && (
        <LyricsBody
          data={data}
          lines={lines}
          activeIndex={activeIndex}
          activeLineRef={activeLineRef}
        />
      )}
    </section>
  );
}

export const LyricsDisplay = memo(LyricsDisplayBase);

/* ---- Body (memo'd: only re-renders when the active line changes) --------------- */

function LyricsBodyBase({
  data,
  lines,
  activeIndex,
  activeLineRef,
}: {
  data: LyricsData;
  lines: SyncedLine[] | null;
  activeIndex: number;
  activeLineRef: React.RefObject<HTMLParagraphElement | null>;
}) {
  if (data.instrumental) {
    return (
      <p className="text-center text-sm text-muted-foreground">Instrumental track</p>
    );
  }

  if (lines && lines.length > 0) {
    return (
      <div className="space-y-2">
        {lines.map((line, i) => (
          <p
            key={line.id}
            ref={i === activeIndex ? activeLineRef : undefined}
            className={cn(
              "text-center text-sm leading-relaxed transition-colors duration-150",
              i === activeIndex ? "font-medium text-brand" : "text-muted-foreground",
            )}
          >
            {line.text || " "}
          </p>
        ))}
      </div>
    );
  }

  if (data.plainLyrics) {
    return (
      <p className="whitespace-pre-wrap text-center text-sm leading-relaxed text-muted-foreground">
        {data.plainLyrics}
      </p>
    );
  }

  return <p className="text-center text-sm text-muted-foreground">No lyrics available</p>;
}

const LyricsBody = memo(LyricsBodyBase);

/* ---- States --------------------------------------------------------------------- */

function LyricsSkeleton() {
  return (
    <div className="space-y-3 px-2">
      <Skeleton className="mx-auto h-4 w-3/4" />
      <Skeleton className="mx-auto h-4 w-1/2" />
      <Skeleton className="mx-auto h-4 w-2/3" />
      <Skeleton className="mx-auto h-4 w-3/5" />
    </div>
  );
}

function LyricsError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p className="text-sm text-muted-foreground">Could not load lyrics.</p>
      <button
        type="button"
        onClick={onRetry}
        className="cursor-pointer rounded-full bg-elevated px-4 py-2 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-elevated/70"
      >
        Try again
      </button>
    </div>
  );
}
