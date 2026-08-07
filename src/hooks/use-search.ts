"use client";

/**
 * Search query hook (Slice 4.7). `query` is the ALREADY-debounced value from
 * SearchClient — this hook does not debounce (that's the component's job, so
 * URL sync and the query key fire on the same tick).
 *
 * Cancellation: TanStack attaches an AbortController to each queryFn's
 * `{ signal }`. Passing it to fetch means typing "a" then "ab" aborts the
 * in-flight "a" request the moment the query key changes — no manual cleanup.
 *
 * Smooth transitions: `placeholderData: keepPreviousData` keeps the last
 * results visible during refetch instead of flashing the skeleton. The
 * `enabled: query.length > 0` guard short-circuits the network entirely when
 * the query is cleared, so stale "abc" results never linger in the idle
 * state.
 */
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { Track } from "@/types/piped";

/** Client fetch for /api/search — throws so TanStack Query errors cleanly.
 *  Error strings are user-safe (server message only, no stack traces). */
async function searchTracks(
  query: string,
  signal?: AbortSignal,
): Promise<Track[]> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
    signal,
  });
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

export function useSearch(query: string) {
  return useQuery({
    queryKey: ["search", query],
    queryFn: ({ signal }) => searchTracks(query, signal),
    enabled: query.length > 0,
    staleTime: 10 * 60 * 1000, // server Redis-caches 5min; skip re-fetch on revisit
    placeholderData: keepPreviousData,
    retry: 1,
  });
}