import { z } from "zod";
import type { Track } from "./piped";

/** A playlist row (playlists table), user-facing shape (dropped userId/coverUrl). */
export interface Playlist {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  /**
   * Number of tracks. Optional because only some paths fetch it: getMyPlaylists
   * computes a Supabase count aggregate, getPlaylistWithTracks uses
   * tracks.length, createPlaylist sets 0. updatePlaylist omits it (no count
   * query) — callers must default `?? 0` when displaying.
   */
  trackCount?: number;
}

/** A single track entry within a playlist (playlist_tracks row). */
export interface PlaylistTrackEntry {
  /** playlist_tracks row uuid. */
  id: string;
  /** YouTube video id. */
  trackId: string;
  /** Order within the playlist (0-based after reorder). */
  position: number;
  /** Display snapshot: title, artist, duration, thumbnail (zero-JOIN render). */
  metadata: Track | null;
}

/** A playlist with its ordered tracks. */
export interface PlaylistWithTracks extends Playlist {
  tracks: PlaylistTrackEntry[];
}

/** UUID for playlist/db ids (Zod v4 top-level format, matches z.email() style). */
export const idSchema = z.uuid("Invalid id");

export const createPlaylistSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  description: z
    .string()
    .trim()
    .max(500, "Description is too long")
    .optional(),
});
export type CreatePlaylistInput = z.infer<typeof createPlaylistSchema>;

export const updatePlaylistSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name cannot be empty")
    .max(100, "Name is too long")
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, "Description is too long")
    .nullable()
    .optional(),
});
export type UpdatePlaylistInput = z.infer<typeof updatePlaylistSchema>;