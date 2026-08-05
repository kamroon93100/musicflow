"use server";

/**
 * Playlist Server Actions (Slice 3.6). First slice writing to our Drizzle
 * schema — via the anon-key Supabase server client so RLS stays enforced
 * (each user only sees/mutates their own playlists). Drizzle/service-role
 * would bypass RLS; deliberately not used here.
 *
 * Convention matches src/lib/auth/actions.ts: actions return `{ error }` on
 * failure (never throw), so error text survives the server-action boundary.
 * TanStack Query hooks adapt `{ error }` into a thrown rejection.
 *
 * Column casing: supabase-js does NOT camelCase-transform for us — it sends
 * keys verbatim to PostgREST, which resolves raw snake_case columns. So all
 * queries here use explicit snake_case names (user_id, created_at), matching
 * the Database type (database.types.ts remaps Drizzle camelCase → snake_case).
 * See KNOWN_ISSUE [3.6].
 */
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import type { Database } from "@/lib/db/database.types";
import type { Track } from "@/types/piped";
import {
  createPlaylistSchema,
  idSchema,
  updatePlaylistSchema,
  type CreatePlaylistInput,
  type Playlist,
  type PlaylistTrackEntry,
  type PlaylistWithTracks,
  type UpdatePlaylistInput,
} from "@/types/playlist";

type PlaylistsRow = Database["public"]["Tables"]["playlists"]["Row"];
type PlaylistTracksRow = Database["public"]["Tables"]["playlist_tracks"]["Row"];

/** Supabase REST returns timestamps as ISO strings; Drizzle types them Date. */
function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

/**
 * Count aggregate from `select("playlist_tracks(count)")`. PostgREST always
 * returns the to-many embed as `[{ count: N }]`, but the typed Database can
 * surface it as a single `{ count: number }` — normalize either shape.
 */
function countOf(value: unknown): number {
  if (Array.isArray(value)) {
    const first = value[0];
    if (first && typeof first === "object" && "count" in first) {
      return (first as { count: number }).count ?? 0;
    }
    return 0;
  }
  if (value && typeof value === "object" && "count" in value) {
    return (value as { count: number }).count ?? 0;
  }
  return 0;
}

/** Map a playlists row to the user-facing shape (drop user_id/cover_url). */
function toPlaylist(row: PlaylistsRow): Playlist {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    isPublic: row.is_public ?? false,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

/** Authenticated user id, or null. */
async function getUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function createPlaylist(
  input: CreatePlaylistInput,
): Promise<Playlist | { error: string }> {
  const parsed = createPlaylistSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const userId = await getUserId();
  if (!userId) return { error: "Not authenticated" };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("playlists")
    .insert({
      user_id: userId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    })
    .select()
    .single();

  if (error || !data) return { error: error?.message ?? "Failed to create playlist" };
  // A brand-new playlist has zero tracks (accurate).
  return { ...toPlaylist(data), trackCount: 0 };
}

/**
 * Current user's playlists, newest first. Embeds a Supabase count aggregate so
 * the library/sidebar can render "N tracks" with zero JOINs. The
 * playlist_tracks relationship entry (database.types.ts) makes this type-safe.
 */
export async function getMyPlaylists(): Promise<Playlist[] | { error: string }> {
  const userId = await getUserId();
  if (!userId) return { error: "Not authenticated" };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("playlists")
    .select("*, playlist_tracks(count)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };
  return (data ?? []).map((row) => ({
    ...toPlaylist(row),
    trackCount: countOf(row.playlist_tracks),
  }));
}

export async function getPlaylistWithTracks(
  playlistId: string,
): Promise<PlaylistWithTracks | { error: string }> {
  const parsedId = idSchema.safeParse(playlistId);
  if (!parsedId.success) return { error: "Invalid playlist id" };
  const userId = await getUserId();
  if (!userId) return { error: "Not authenticated" };

  const supabase = await createSupabaseServerClient();
  const { data: playlist, error: playlistError } = await supabase
    .from("playlists")
    .select()
    .eq("id", parsedId.data)
    .eq("user_id", userId)
    .single();
  if (playlistError || !playlist) {
    return { error: playlistError?.message ?? "Playlist not found" };
  }

  const { data: trackRows, error: tracksError } = await supabase
    .from("playlist_tracks")
    .select()
    .eq("playlist_id", parsedId.data)
    .order("position", { ascending: true });
  if (tracksError) return { error: tracksError.message };

  const tracks: PlaylistTrackEntry[] = (trackRows ?? []).map((r: PlaylistTracksRow) => ({
    id: r.id,
    trackId: r.track_id,
    position: r.position,
    metadata: (r.track_metadata as Track | null) ?? null,
  }));

  // tracks was fully fetched — its length is the exact count.
  return { ...toPlaylist(playlist), trackCount: tracks.length, tracks };
}

export async function updatePlaylist(
  playlistId: string,
  input: UpdatePlaylistInput,
): Promise<Playlist | { error: string }> {
  const parsedId = idSchema.safeParse(playlistId);
  if (!parsedId.success) return { error: "Invalid playlist id" };
  const parsed = updatePlaylistSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const userId = await getUserId();
  if (!userId) return { error: "Not authenticated" };

  const patch: Database["public"]["Tables"]["playlists"]["Update"] = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (Object.keys(patch).length === 0) return { error: "Nothing to update" };
  // defaultNow() fires on insert only — bump updated_at explicitly (A3).
  // Update type is Date; supabase serializes it to ISO in the request body.
  patch.updated_at = new Date();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("playlists")
    .update(patch)
    .eq("id", parsedId.data)
    .eq("user_id", userId)
    .select()
    .single();

  if (error || !data) return { error: error?.message ?? "Failed to update playlist" };
  return toPlaylist(data);
}

export async function deletePlaylist(
  playlistId: string,
): Promise<{ error?: string }> {
  const parsedId = idSchema.safeParse(playlistId);
  if (!parsedId.success) return { error: "Invalid playlist id" };
  const userId = await getUserId();
  if (!userId) return { error: "Not authenticated" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("playlists")
    .delete()
    .eq("id", parsedId.data)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  return {};
}