"use server";

/**
 * Listening-history Server Actions (Slice 4.6). Same conventions as
 * src/lib/playlists/actions.ts: Supabase anon server client (RLS enforced) for
 * per-user reads/writes, `{ error }` returns (never throw), explicit snake_case
 * column names (supabase-js does NOT camelCase-transform — see KNOWN_ISSUE
 * [3.6]).
 *
 * One deliberate exception: getPopularTracks uses the service-role client
 * (src/lib/db/supabase-service.ts) because it aggregates listening_history
 * across ALL users — RLS would hide other users' rows from the anon client.
 * That bypass is bounded (2000-row window), read-only, and documented in
 * KNOWN_ISSUE.md [4.6].
 *
 * Track shape note: the `trackSchema` here mirrors the local copy in
 * src/lib/playlists/track-actions.ts (that one is not exported and Step 2 is
 * surgical). Consolidating it into a shared zod schema is a Phase 6 polish
 * candidate.
 */
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { createSupabaseServiceClient } from "@/lib/db/supabase-service";
import { cacheGet, cacheKey, cacheSet } from "@/lib/cache/redis";
import type { Track } from "@/types/piped";

const POPULAR_CACHE_TTL_SECONDS = 300; // 5 min — matches CLAUDE.md search TTL
const PLAY_TRACKING_THROTTLE_MS = 5 * 60 * 1000; // 1 event / track / 5 min / user
const MIN_PLAY_DURATION_SECONDS = 30; // below this a "play" isn't a real listen

/** Shape-validates a normalized Track (mirrors track-actions.ts). */
const trackSchema = z.object({
  id: z.string().min(1).max(50),
  title: z.string().min(1).max(500),
  artist: z.string().nullable(),
  duration: z.number().nullable(),
  thumbnail: z.string().nullable(),
});

/** Authenticated user id, or null. */
async function getUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** The listening_history row shape relevant to dedup (track_id + snapshot). */
type HistoryRow = {
  track_id: string;
  track_metadata: unknown;
};

/**
 * Dedup a played_at-descending row list to unique tracks, most-recent-first,
 * skipping rows whose metadata snapshot is null. Defensive — a missing snapshot
 * can't render a card, so it is dropped rather than surfaced.
 */
function uniqueTracks(rows: HistoryRow[]): Track[] {
  const seen = new Set<string>();
  const tracks: Track[] = [];
  for (const row of rows) {
    if (!row.track_metadata || typeof row.track_metadata !== "object") continue;
    if (seen.has(row.track_id)) continue;
    seen.add(row.track_id);
    tracks.push(row.track_metadata as Track);
  }
  return tracks;
}

/**
 * The current user's recently played tracks, most recent first, deduped by
 * track_id (each track appears once — its most recent play). Bounded to a
 * 100-row fetch so the JS dedup never scans the full table. No Redis cache:
 * per-user and small; the hook's 60s staleTime covers repeat loads.
 */
export async function getRecentlyPlayed(
  limit = 8,
): Promise<Track[] | { error: string }> {
  const userId = await getUserId();
  if (!userId) return { error: "Not authenticated" };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("listening_history")
    .select("track_id, track_metadata, played_at")
    .eq("user_id", userId)
    .order("played_at", { ascending: false })
    .limit(100);

  if (error) return { error: error.message };
  return uniqueTracks(data ?? []).slice(0, limit);
}

/**
 * Most-played tracks across ALL users (global popularity), Redis-cached 5 min.
 *
 * RLS-BYPASS: cross-user aggregate over listening_history.
 * See KNOWN_ISSUE.md [4.6] for rationale.
 *
 * Bounded to the 2000 most recent plays, then grouped + counted in JS. At MVP
 * scale "popular in the recent window" is indistinguishable from all-time
 * popular; revisit as a SECURITY DEFINER SQL function in Phase 6 polish.
 */
export async function getPopularTracks(
  limit = 6,
): Promise<Track[] | { error: string }> {
  const key = cacheKey("home", "popular");
  const cached = await cacheGet<Track[]>(key);
  if (cached) return cached;

  const supabase = await createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("listening_history")
    .select("track_id, track_metadata")
    .order("played_at", { ascending: false })
    .limit(2000);

  if (error) return { error: error.message };

  // Group by track_id — count occurrences, keep the first non-null snapshot.
  const counts = new Map<string, { track: Track; count: number }>();
  for (const row of data ?? []) {
    if (!row.track_metadata || typeof row.track_metadata !== "object") continue;
    const entry = counts.get(row.track_id);
    if (entry) {
      entry.count += 1;
    } else {
      counts.set(row.track_id, {
        track: row.track_metadata as Track,
        count: 1,
      });
    }
  }

  const tracks = [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((e) => e.track);

  await cacheSet(key, tracks, POPULAR_CACHE_TTL_SECONDS);
  return tracks;
}

/**
 * Record a playback event (fire-and-forget from the player). Silently no-ops
 * unless the listen is real: >= 30s played, authenticated, and not already
 * recorded for this track in the last 5 minutes (throttle). Callers ignore the
 * result — recording history must never interrupt playback.
 */
export async function trackPlayEvent(
  track: Track,
  durationPlayed: number,
): Promise<{ error?: string }> {
  if (durationPlayed < MIN_PLAY_DURATION_SECONDS) return {};
  const parsedTrack = trackSchema.safeParse(track);
  if (!parsedTrack.success) return { error: "Invalid track" };

  const userId = await getUserId();
  if (!userId) return {}; // unauthenticated — not worth an error to the player

  const supabase = await createSupabaseServerClient();

  // Throttle: skip when a play for this track already landed in the window.
  // Pass a Date — the column types as Date (supabase serializes it to ISO).
  const since = new Date(Date.now() - PLAY_TRACKING_THROTTLE_MS);
  const { data: existing, error: readError } = await supabase
    .from("listening_history")
    .select("id")
    .eq("user_id", userId)
    .eq("track_id", parsedTrack.data.id)
    .gte("played_at", since)
    .limit(1);
  if (readError) return { error: readError.message };
  if (existing && existing.length > 0) return {}; // already recorded

  const { error } = await supabase
    .from("listening_history")
    .insert({
      user_id: userId,
      track_id: parsedTrack.data.id,
      play_duration: Math.floor(durationPlayed),
      track_metadata: parsedTrack.data,
      // played_at defaults to now() at the DB level.
    });
  if (error) return { error: error.message };
  return {};
}