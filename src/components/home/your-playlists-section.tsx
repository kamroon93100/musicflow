"use client";

/**
 * Home page "Your library" grid (Slice 4.6). The user's playlists as a
 * responsive 2/3/4-col grid; each card is a Next.js Link to /playlist/[id]
 * (prefetch on hover, proper nav semantics). Playlists never carry cover art on
 * our model (no coverUrl field), so each card's cover is the deterministic
 * gradientFor(name) placeholder from cover.ts — allowed here precisely because
 * it's a placeholder, never a real element (single-accent rule).
 *
 * Hover lift only: translateY(-2px) + shadow, 150ms ease-out. No scale, no
 * opacity — restraint per find-animation-opportunities; entrance is owned by
 * the parent's Step 10 stagger. Skips render entirely when the user has no
 * playlists (return null, no heading).
 *
 * Vertical spacing comes from the parent page's space-y-10, matching the other
 * home sections.
 */
import Link from "next/link";
import { useMyPlaylists } from "@/hooks/use-playlists";
import { gradientFor } from "@/lib/cover";
import { cn } from "@/lib/utils";

/** Stable keys for the 6 skeleton cards — never index keys (CLAUDE.md). */
const SKELETON_KEYS = ["p1", "p2", "p3", "p4", "p5", "p6"] as const;

const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4";

export function YourPlaylistsSection() {
  const { data: playlists, isPending, isError, refetch } = useMyPlaylists();

  if (isPending) {
    return (
      <section aria-label="Loading your library">
        <h2 className="text-2xl font-semibold tracking-tight">Your library</h2>
        <div className={cn("mt-4", GRID)}>
          {SKELETON_KEYS.map((key) => (
            <div key={key} className="animate-pulse rounded-[8px] bg-elevated p-3">
              <div className="aspect-square w-full rounded-[8px] bg-surface" />
              <div className="mt-3 h-4 w-2/3 rounded-full bg-surface" />
              <div className="mt-2 h-3 w-1/2 rounded-full bg-surface" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section aria-label="Your library error">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            Couldn't load your playlists
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

  if (!playlists || playlists.length === 0) return null;

  return (
    <section aria-labelledby="your-library-heading">
      <h2
        id="your-library-heading"
        className="text-2xl font-semibold tracking-tight"
      >
        Your library
      </h2>
      <div className={cn("mt-4", GRID)}>
        {playlists.map((playlist) => {
          const count = playlist.trackCount ?? 0;
          return (
            <Link
              key={playlist.id}
              href={`/playlist/${playlist.id}`}
              aria-label={`Open playlist ${playlist.name}`}
              className="block overflow-hidden rounded-[8px] bg-elevated transition-transform duration-150 ease-out hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className={cn("aspect-square w-full", gradientFor(playlist.name))} />
              <div className="p-3">
                <h3 className="truncate text-sm font-medium text-foreground">
                  {playlist.name}
                </h3>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {count} {count === 1 ? "track" : "tracks"}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}