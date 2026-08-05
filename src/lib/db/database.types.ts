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
 * COLUMN CASING: supabase-js sends query/insert keys VERBATIM to PostgREST,
 * which resolves raw snake_case columns — it does not camelCase-transform for
 * us. Drizzle's object model camelCases keys, so keys here are remapped
 * camelCase → snake_case via ToSnake. That makes both request bodies
 * ({ user_id }) and response objects (row.user_id) match the real columns;
 * otherwise PostgREST fails with "Could not find the 'userId' column".
 * Value types still come from Drizzle. Note: Drizzle types timestamptz as
 * Date but REST returns ISO strings — callers handle both (see toIso).
 *
 * Re-generate with `supabase gen types` once a real project exists if we
 * ever need the full remote shape.
 */

/** "userId" → "user_id" (insert "_" before each uppercase letter, lowercase it). */
type CamelToSnake<S extends string> = S extends `${infer Head}${infer Tail}`
  ? `${Head extends Uppercase<Head> ? `_${Lowercase<Head>}` : Head}${CamelToSnake<Tail>}`
  : S;

/** Remap an object's keys to snake_case, keeping value types. */
type ToSnake<T> = {
  [K in keyof T as K extends string ? CamelToSnake<K> : K]: T[K];
};

export type Database = {
  public: {
    Tables: {
      users: {
        Row: ToSnake<typeof users.$inferSelect>;
        Insert: ToSnake<typeof users.$inferInsert>;
        Update: Partial<ToSnake<typeof users.$inferInsert>>;
        // Supabase `GenericTable` requires `Relationships`. Drizzle models the
        // FKs (users is referenced by playlists, etc.) so supabase-js doesn't
        // need them for typing. Empty is correct and keeps `GenericSchema`
        // satisfied so typed `supabase.from(...)` calls work.
        Relationships: [];
      };
      playlists: {
        Row: ToSnake<typeof playlists.$inferSelect>;
        Insert: ToSnake<typeof playlists.$inferInsert>;
        Update: Partial<ToSnake<typeof playlists.$inferInsert>>;
        // One-to-many playlist -> playlist_tracks (FK playlist_id -> id, cascade).
        // Added so `select("*, playlist_tracks(count)")` type-infers in
        // getMyPlaylists. Mirrors the FK Drizzle already models.
        Relationships: [
          {
            foreignKeyName: "playlist_tracks_playlist_id_fkey",
            columns: ["id"],
            isOneToOne: false,
            referencedRelation: "playlist_tracks",
            referencedColumns: ["playlist_id"],
          },
        ];
      };
      playlist_tracks: {
        Row: ToSnake<typeof playlistTracks.$inferSelect>;
        Insert: ToSnake<typeof playlistTracks.$inferInsert>;
        Update: Partial<ToSnake<typeof playlistTracks.$inferInsert>>;
        Relationships: [];
      };
      liked_tracks: {
        Row: ToSnake<typeof likedTracks.$inferSelect>;
        Insert: ToSnake<typeof likedTracks.$inferInsert>;
        Update: Partial<ToSnake<typeof likedTracks.$inferInsert>>;
        Relationships: [];
      };
      listening_history: {
        Row: ToSnake<typeof listeningHistory.$inferSelect>;
        Insert: ToSnake<typeof listeningHistory.$inferInsert>;
        Update: Partial<ToSnake<typeof listeningHistory.$inferInsert>>;
        Relationships: [];
      };
      search_history: {
        Row: ToSnake<typeof searchHistory.$inferSelect>;
        Insert: ToSnake<typeof searchHistory.$inferInsert>;
        Update: Partial<ToSnake<typeof searchHistory.$inferInsert>>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};