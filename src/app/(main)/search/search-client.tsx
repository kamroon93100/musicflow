"use client";

/**
 * Search page — client search experience (Slice 4.7).
 *
 * URL query string (?q=X) is the source of truth (decision D2). This
 * component mirrors it into a local input value, debounces, writes the
 * debounced value back to the URL via router.replace (NOT push — typing
 * must not spam history), and re-syncs local state when the URL changes
 * externally (browser back/forward).
 *
 * All four states (idle / loading / empty / error) and the query logic are
 * carried over unchanged from the pre-split page. Rows are selected via
 * playQueue(results, index) (decision D5) — clicking a search result fills
 * the queue with the whole result set so next/prev traverse search results.
 *
 * Only this component subscribes to URL/query; it must NOT leak player
 * re-renders (it reads player state via granular selectors only).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchX, Search } from "lucide-react";
import type { Track } from "@/types/piped";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchResultItem } from "@/components/search/search-result-item";
import { useCurrentTrack, usePlayerActions } from "@/hooks/use-player";
import { useSearch } from "@/hooks/use-search";

/** Debounce `value` by 300ms (CLAUDE.md). Initial render = value, no flash. */
function useDebouncedValue(value: string, delay = 300): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value.trim()), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/** Stable loading-skeleton keys — never use `index` as a React key (CLAUDE.md). */
const LOADING_KEYS = ["l1", "l2", "l3", "l4", "l5", "l6", "l7", "l8"] as const;

export default function SearchClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";

  // Capture the initial ?q once: seeds input state and decides autoFocus.
  const initialQuery = useRef(urlQuery).current;

  // Local input value — seeded from the URL (source of truth).
  const [query, setQuery] = useState(initialQuery);

  // Track the last value WE wrote to the URL. When urlQuery matches this,
  // the change is our own router.replace echo — ignore it. When it differs,
  // the URL changed externally (browser back/forward, link click) — sync
  // local state. Seeded with initialQuery so mount doesn't trigger a sync.
  const lastWrittenRef = useRef<string>(initialQuery);

  // Re-sync local input when URL changes EXTERNALLY (back/forward, link).
  // Skip our own echoes — router.replace of `debounced` would loop-clobber
  // user typing without this guard (that was the shipped Step 2 bug).
  useEffect(() => {
    if (urlQuery === lastWrittenRef.current) return; // our own echo
    setQuery(urlQuery);
  }, [urlQuery]);

  const debounced = useDebouncedValue(query);

  // Publish the (debounced) typed query to the URL — replace, no history.
  // Record what we're writing so the external-sync effect can ignore the
  // echo when urlQuery updates on the next tick.
  useEffect(() => {
    if (debounced === urlQuery) return;
    lastWrittenRef.current = debounced;

    const params = new URLSearchParams(searchParams.toString());
    if (debounced.length === 0) {
      params.delete("q");
    } else {
      params.set("q", debounced);
    }
    router.replace(`/search${params.size ? `?${params.toString()}` : ""}`);
  }, [debounced, router, searchParams, urlQuery]);

  const activeId = useCurrentTrack()?.id ?? null;
  const { playQueue } = usePlayerActions();

  const { data, isPending, isError, error, refetch, isFetching } = useSearch(debounced);

  const handleSelect = useCallback(
    (track: Track) => {
      if (!data) return;
      const index = data.findIndex((t) => t.id === track.id);
      if (index < 0) return; // defensive — should never happen
      void playQueue(data, index);
    },
    // playQueue is a stable action ref (usePlayerActions + useShallow), data
    // changes only per query result — both deps are meaningfully stable.
    [data, playQueue],
  );

  const idle = debounced.length === 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8">
      <h1 className="sr-only">Search</h1>

      {/* Search input — rounded-full to match TopBar. role="search" groups
          the field + its labelled status region for assistive tech. */}
      <div className="relative" role="search">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search songs, artists…"
          aria-label="Search songs"
          autoFocus={initialQuery.length === 0}
          className="h-11 rounded-full pl-10 pr-4"
        />
      </div>

      {/* Screen-reader status — announces result count / search state. */}
      <span className="sr-only" role="status" aria-live="polite">
        {idle
          ? ""
          : isError
            ? "Search failed"
            : data && data.length > 0
              ? `${data.length} results for ${debounced}`
              : data && data.length === 0
                ? `No results for ${debounced}`
                : ""}
      </span>

      <div className="mt-6">
        {idle ? (
          <p className="text-sm text-muted-foreground">
            Search for a song to start playing. Results appear as you type.
          </p>
        ) : isError ? (
          <ErrorState
            message={error?.message ?? "Something went wrong"}
            onRetry={() => void refetch()}
          />
        ) : isPending && isFetching ? (
          <LoadingList />
        ) : !data || data.length === 0 ? (
          <EmptyState query={debounced} />
        ) : (
          <ResultsList tracks={data} activeId={activeId} onSelect={handleSelect} />
        )}
      </div>
    </div>
  );
}

function LoadingList() {
  return (
    <ul className="space-y-2" aria-label="Loading results" role="status" aria-live="polite">
      {LOADING_KEYS.map((k) => (
        <li
          key={k}
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