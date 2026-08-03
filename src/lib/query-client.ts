import { QueryClient } from "@tanstack/react-query";

/**
 * Creates a fresh QueryClient with MusicFlow's cache defaults.
 *
 * - staleTime 60s: sane global default; per-query overrides encode the
 *   CLAUDE.md cache tiers (search 5min, metadata 24h, lyrics 30d).
 * - retry 2: Piped is a public, rate-limited API — don't hammer it.
 * - refetchOnWindowFocus false: a music app shouldn't refetch the whole
 *   tree when the tab regains focus.
 *
 * Must NOT be called at module scope in Server Components — a module-level
 * singleton would be shared across SSR requests. Use the factory inside a
 * provider (see providers.tsx).
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: 2,
        refetchOnWindowFocus: false,
      },
    },
  });
}
