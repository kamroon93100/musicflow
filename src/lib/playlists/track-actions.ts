"use server";

/**
 * Playlist-track Server Actions (Slice 3.6). Same conventions as
 * src/lib/playlists/actions.ts: Supabase anon client (RLS enforced),
 * `{ error }` returns (never throw), explicit snake_case column names.
 *
 * reorderTrack uses a collision-safe shift against the unique
 * (playlist_id, position) index: the moved row is first parked at the sentinel
 * position -1 (positions are >= 0, so this never collides), the in-between
 * rows are shifted one step toward the vacated slot (writing in an order that
 * always targets a free position), then the moved row lands on its final slot.
 * No Postgres RPC/migration required; acceptable non-atomic worst case for MVP.
 */
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import type { Track } from "@/types/piped";
import { idSchema } from "@/types/playlist";

const trackSchema = z.object({
  id: z.string().min(1).max(50),
  title: z.string().min(1).max(500),
  artist: z.string().nullable(),
  duration: z.number().nullable(),
  thumbnail: z.string().nullable(),
});

/**
 * Append a track at max(position) + 1 (0 when the playlist is empty). Decision
 * D: append-only — explicit placement is reorderTrack's job.
 */
export async function addTrackToPlaylist(
  playlistId: string,
  track: Track,
): Promise<{ error?: string }> {
  const parsedId = idSchema.safeParse(playlistId);
  if (!parsedId.success) return { error: "Invalid playlist id" };
  const parsedTrack = trackSchema.safeParse(track);
  if (!parsedTrack.success) return { error: "Invalid track" };

  const supabase = await createSupabaseServerClient();
  const { data: existing, error: readError } = await supabase
    .from("playlist_tracks")
    .select("position")
    .eq("playlist_id", parsedId.data)
    .order("position", { ascending: false })
    .limit(1);
  if (readError) return { error: readError.message };
  const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0;

  const { error } = await supabase
    .from("playlist_tracks")
    .insert({
      playlist_id: parsedId.data,
      track_id: parsedTrack.data.id,
      position: nextPosition,
      track_metadata: parsedTrack.data,
    });
  if (error) return { error: error.message };
  return {};
}

/** Remove a track by its YouTube id. Leaves position gaps (harmless — A6). */
export async function removeTrackFromPlaylist(
  playlistId: string,
  trackId: string,
): Promise<{ error?: string }> {
  const parsedId = idSchema.safeParse(playlistId);
  if (!parsedId.success) return { error: "Invalid playlist id" };
  if (!trackId.trim()) return { error: "Invalid track id" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("playlist_tracks")
    .delete()
    .eq("playlist_id", parsedId.data)
    .eq("track_id", trackId);
  if (error) return { error: error.message };
  return {};
}

/**
 * Move a track to a new 0-based index. Collision-safe sequential shifts (A5).
 */
export async function reorderTrack(
  playlistId: string,
  trackId: string,
  newPosition: number,
): Promise<{ error?: string }> {
  const parsedId = idSchema.safeParse(playlistId);
  if (!parsedId.success) return { error: "Invalid playlist id" };
  if (!trackId.trim()) return { error: "Invalid track id" };
  if (!Number.isInteger(newPosition) || newPosition < 0) {
    return { error: "Invalid position" };
  }

  const supabase = await createSupabaseServerClient();
  const { data: rows, error: readError } = await supabase
    .from("playlist_tracks")
    .select("id, track_id, position")
    .eq("playlist_id", parsedId.data)
    .order("position", { ascending: true });
  if (readError) return { error: readError.message };
  if (!rows || rows.length === 0) return { error: "Playlist is empty" };

  const currentIndex = rows.findIndex((r) => r.track_id === trackId);
  if (currentIndex === -1) return { error: "Track not in playlist" };

  const n = rows.length;
  const targetIndex = Math.max(0, Math.min(newPosition, n - 1));
  if (targetIndex === currentIndex) return {}; // no-op

  const movedId = rows[currentIndex].id;

  // Park the moved row out of range so its old slot is free (A5 sentinel).
  const { error: sentinelError } = await supabase
    .from("playlist_tracks")
    .update({ position: -1 })
    .eq("id", movedId);
  if (sentinelError) return { error: sentinelError.message };

  if (targetIndex < currentIndex) {
    // Rows in [targetIndex, currentIndex-1] shift +1, writing descending so
    // each write targets the slot the previous row just vacated.
    for (let i = currentIndex - 1; i >= targetIndex; i--) {
      const { error } = await supabase
        .from("playlist_tracks")
        .update({ position: i + 1 })
        .eq("id", rows[i].id);
      if (error) return { error: error.message };
    }
  } else {
    // Rows in (currentIndex, targetIndex] shift -1, writing ascending.
    for (let i = currentIndex + 1; i <= targetIndex; i++) {
      const { error } = await supabase
        .from("playlist_tracks")
        .update({ position: i - 1 })
        .eq("id", rows[i].id);
      if (error) return { error: error.message };
    }
  }

  const { error: finalError } = await supabase
    .from("playlist_tracks")
    .update({ position: targetIndex })
    .eq("id", movedId);
  if (finalError) return { error: finalError.message };
  return {};
}