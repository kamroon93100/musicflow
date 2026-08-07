import type { Metadata } from "next";
import { Suspense } from "react";
import SearchClient from "./search-client";

/**
 * Search page — Server Component shell (Slice 4.7).
 *
 * Split from search-client.tsx because generateMetadata is Server-only
 * (Next 16 bundled docs: generate-metadata.md). This file owns the dynamic
 * <title> and the initial Suspense shell; every bit of interactive query
 * state lives in SearchClient.
 *
 * SearchClient reads ?q via useSearchParams. On a statically-rendered route
 * Next 16 requires a <Suspense> boundary around a Client Component that
 * calls useSearchParams ("Missing Suspense boundary"), otherwise the build
 * fails. The fallback is sized 1:1 to the idle SearchClient so hydration
 * causes no CLS.
 */

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

const MAX_TITLE_QUERY = 100;

/** Synthesize the <title>. `q` is a plain bound string — React escapes
 *  metadata text automatically, and we slice to keep it tiny. */
function titleFor(q?: string): string {
  const trimmed = q?.trim();
  if (!trimmed) return "Search — MusicFlow";
  return `Search: ${trimmed.slice(0, MAX_TITLE_QUERY)} — MusicFlow`;
}

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: titleFor(q) };
}

/** Stable skeleton keys — never use `index` as a React key (CLAUDE.md). */
const SKELETON_KEYS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"] as const;

/** Server-rendered shell matching the idle SearchClient dimensions (no CLS).
 *  Plain divs (no client components) so it stays out of the client bundle. */
function SearchPageSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8">
      <div className="relative" role="search" aria-hidden>
        <div className="h-11 animate-pulse rounded-full bg-elevated" />
      </div>
      <ul className="mt-6 space-y-2" aria-hidden>
        {SKELETON_KEYS.map((k) => (
          <li key={k} className="flex h-12 items-center gap-3 rounded-[8px] px-2">
            <span className="size-12 shrink-0 animate-pulse rounded-[8px] bg-elevated" />
            <span className="flex flex-1 flex-col gap-2">
              <span className="h-3.5 w-1/2 animate-pulse rounded bg-elevated" />
              <span className="h-3 w-1/4 animate-pulse rounded bg-elevated" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchPageSkeleton />}>
      <SearchClient />
    </Suspense>
  );
}