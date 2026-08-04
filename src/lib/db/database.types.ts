import type {
  likedTracks,
  listeningHistory,
  playlistTracks,
  playlists,
  searchHistory,
  users,
} from "./schema";

/**
 * Supabase `Database` generic, derived from the Drizzle schema so the two
 * can't drift (Drizzle is the single source of truth). Used to type the
 * @supabase/ssr clients.
 *
 * Reads/writes go through Drizzle (service role); the Supabase client is
 * primarily for auth, but this keeps direct `supabase.from(...)` calls typed.
 * Re-generate with `supabase gen types` once a real project exists if we
 * ever need the full remote shape.
 */
export type Database = {
  public: {
    Tables: {
      users: {
        Row: typeof users.$inferSelect;
        Insert: typeof users.$inferInsert;
        Update: Partial<typeof users.$inferInsert>;
        // Supabase `GenericTable` requires `Relationships`. Drizzle models the
        // FKs (users is referenced by playlists, etc.) so supabase-js doesn't
        // need them for typing. Empty is correct and keeps `GenericSchema`
        // satisfied so typed `supabase.from(...)` calls work.
        Relationships: [];
      };
      playlists: {
        Row: typeof playlists.$inferSelect;
        Insert: typeof playlists.$inferInsert;
        Update: Partial<typeof playlists.$inferInsert>;
        Relationships: [];
      };
      playlist_tracks: {
        Row: typeof playlistTracks.$inferSelect;
        Insert: typeof playlistTracks.$inferInsert;
        Update: Partial<typeof playlistTracks.$inferInsert>;
        Relationships: [];
      };
      liked_tracks: {
        Row: typeof likedTracks.$inferSelect;
        Insert: typeof likedTracks.$inferInsert;
        Update: Partial<typeof likedTracks.$inferInsert>;
        Relationships: [];
      };
      listening_history: {
        Row: typeof listeningHistory.$inferSelect;
        Insert: typeof listeningHistory.$inferInsert;
        Update: Partial<typeof listeningHistory.$inferInsert>;
        Relationships: [];
      };
      search_history: {
        Row: typeof searchHistory.$inferSelect;
        Insert: typeof searchHistory.$inferInsert;
        Update: Partial<typeof searchHistory.$inferInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
