"use client";

/**
 * Home page "Recommended for you" row (Slice 4.6). Horizontal scroll of
 * HomeTrackCards fed by usePopularTracks(). Three states: 6 skeleton cards
 * while loading, defensive empty (rare for popular — but return nothing rather
 * than a bare heading), or one error line + Retry. Clicking a card fills the
 * queue with the section's tracks and starts at the clicked one
 * (playQueue(tracks, index) — decision D7). Direct parallel of
 * recently-played-section; only hook, heading, skeleton count, and error text
 * differ.
 *
 * Vertical spacing comes from the parent page's space-y-10, matching genre-grid.
 * Scrollbar is hidden via Tailwind v4 arbitrary properties (no global utility
 * exists yet); the row stays keyboard-navigable because cards are <button>s.
 */
import { usePopularTracks } from "@/hooks/use-home";
import { useCurrentTrack, usePlayerActions } from "@/hooks/use-player";
import { HomeTrackCard } from "@/components/home/home-track-card";

const SKELETON_COUNT = 6; // matches usePopularTracks default limit

export function RecommendedSection() {
  const { data: tracks, isLoading, isError, refetch } = usePopularTracks();
  const currentTrack = useCurrentTrack();
  const { playQueue } = usePlayerActions();

  if (isLoading) {
    return (
      <section aria-label="Loading recommendations">
        <h2 className="text-2xl font-semibold tracking-tight">
          Recommended for you
        </h2>
        <div className="mt-4 flex gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <div
              key={i}
              className="size-40 shrink-0 rounded-[8px] bg-elevated animate-pulse"
            />
          ))}
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section aria-label="Recommendations error">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            Couldn't load recommendations
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-full bg-elevated px-4 py-1.5 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-primary hover:text-black"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  if (!tracks || tracks.length === 0) return null;

  return (
    <section aria-labelledby="recommended-heading">
      <h2 id="recommended-heading" className="text-2xl font-semibold tracking-tight">
        Recommended for you
      </h2>
      <div className="mt-4 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tracks.map((track, index) => (
          <HomeTrackCard
            key={track.id}
            track={track}
            isActive={currentTrack?.id === track.id}
            onPlay={() => playQueue(tracks, index)}
          />
        ))}
      </div>
    </section>
  );
}