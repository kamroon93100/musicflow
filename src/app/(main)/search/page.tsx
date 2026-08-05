"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SearchX, Search } from "lucide-react";
import type { Track } from "@/types/piped";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchResultItem } from "@/components/search/search-result-item";
import { useCurrentTrack, usePlayerActions } from "@/hooks/use-player";

/** Client fetch for /api/search — throws so TanStack Query errors cleanly. */
async function searchTracks(query: string): Promise<Track[]> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  const json = (await res.json()) as {
    success?: boolean;
    data?: Track[];
    error?: string;
  };
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? "Search failed");
  }
  return json.data;
}

/** Debounce `value` by 300ms (CLAUDE.md). Initial render = value, no flash. */
function useDebouncedValue(value: string, delay = 300): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value.trim()), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

const LOADING_ROWS = 8;

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query);
  const activeId = useCurrentTrack()?.id ?? null;
  const { playTrack } = usePlayerActions();

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => searchTracks(debounced),
    enabled: debounced.length > 0,
    staleTime: 10 * 60 * 1000, // server Redis-caches 5min; skip re-fetch on revisit
    retry: 1,
  });

  const idle = debounced.length === 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8">
      <h1 className="sr-only">Search</h1>

      {/* Search input — rounded-full to match TopBar */}
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search songs, artists…"
          aria-label="Search songs"
          autoFocus
          className="h-11 rounded-full pl-10 pr-4"
        />
      </div>

      <div className="mt-6">
        {idle ? (
          <p className="text-sm text-muted-foreground">
            Search for a song to start playing. Results appear as you type.
          </p>
        ) : isPending && isFetching ? (
          <LoadingList />
        ) : isError ? (
          <ErrorState
            message={error?.message ?? "Something went wrong"}
            onRetry={() => void refetch()}
          />
        ) : !data || data.length === 0 ? (
          <EmptyState query={debounced} />
        ) : (
          <ResultsList
            tracks={data}
            activeId={activeId}
            onSelect={(track) => void playTrack(track)}
          />
        )}
      </div>
    </div>
  );
}

function LoadingList() {
  return (
    <ul className="space-y-2" aria-label="Loading results" role="status" aria-live="polite">
      {Array.from({ length: LOADING_ROWS }, (_, i) => (
        <li
          key={i}
          className="flex h-12 items-center gap-3 rounded-[8px] px-2"
        >
          <Skeleton className="size-12 shrink-0 rounded-[8px]" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <SearchX className="size-10 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        No results for “{query}”.
      </p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="max-w-sm text-sm text-muted-foreground">
        Couldn&apos;t search right now. {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="cursor-pointer rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors duration-150 hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}

/** Memoized row list — `active` computed one level up to keep rows cheap. */
function ResultsList({
  tracks,
  activeId,
  onSelect,
}: {
  tracks: Track[];
  activeId: string | null;
  onSelect: (t: Track) => void;
}) {
  return (
    <ul className="space-y-1" aria-label="Search results">
      {tracks.map((track) => (
        <li key={track.id}>
          <SearchResultItem
            track={track}
            active={track.id === activeId}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  );
}