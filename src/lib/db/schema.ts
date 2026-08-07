import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * MusicFlow Postgres schema (public schema, Drizzle ORM).
 *
 * Design decisions:
 * - UUID PKs default to gen_random_uuid() (v4). UUID v7 needs PostgreSQL 18+
 *   (native uuidv7()) — Supabase runs 15-17, so v4 it is. See KNOWN_ISSUE.md.
 * - track_id is the Piped/YouTube video id (text), not a local FK — there is
 *   no tracks table. Display data is snapshotted into track_metadata (jsonb)
 *   so list/feed rendering needs zero JOINs (120fps rule).
 * - users.id mirrors auth.users.id and is inserted by the auth handler — no
 *   default; the FK → auth.users(id) ON DELETE CASCADE is applied in the
 *   Supabase SQL migration (Slice 1.3), not modeled in Drizzle.
 */

/** Extends Supabase Auth users; id mirrors auth.users.id. */
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  // FK → auth.users(id) ON DELETE CASCADE applied in the Supabase SQL
  // migration (Slice 1.3). Cross-schema (public.users → auth.users) and
  // drizzle-kit can't push it anyway, so Drizzle keeps the plain PK and the
  // SQL owns the constraint.
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const playlists = pgTable(
  "playlists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    coverUrl: text("cover_url"),
    isPublic: boolean("is_public").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("playlists_user_id_idx").on(table.userId),
    // Public browse / discover (Phase 3 /api/playlists).
    index("playlists_public_created_idx").on(table.isPublic, table.createdAt),
  ],
);

export const playlistTracks = pgTable(
  "playlist_tracks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playlistId: uuid("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    trackId: text("track_id").notNull(), // Piped/YouTube video id.
    trackMetadata: jsonb("track_metadata"), // Display snapshot: title, artist, duration, thumb.
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("playlist_tracks_playlist_position_uq").on(
      table.playlistId,
      table.position,
    ),
    // "Which playlists contain this track?"
    index("playlist_tracks_track_id_idx").on(table.trackId),
  ],
);

export const likedTracks = pgTable(
  "liked_tracks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    trackId: text("track_id").notNull(),
    trackMetadata: jsonb("track_metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("liked_tracks_user_track_uq").on(table.userId, table.trackId),
    // "My liked feed" ordered newest-first.
    index("liked_tracks_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const listeningHistory = pgTable(
  "listening_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    trackId: text("track_id").notNull(),
    playedAt: timestamp("played_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    playDuration: integer("play_duration").notNull().default(0), // seconds.
    trackMetadata: jsonb("track_metadata"),
  },
  (table) => [
    // "Recent plays" per user.
    index("listening_history_user_played_idx").on(table.userId, table.playedAt),
    // "Most played track" aggregation.
    index("listening_history_track_id_idx").on(table.trackId),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  playlists: many(playlists),
  likedTracks: many(likedTracks),
  listeningHistory: many(listeningHistory),
}));

export const playlistsRelations = relations(playlists, ({ one, many }) => ({
  user: one(users, { fields: [playlists.userId], references: [users.id] }),
  tracks: many(playlistTracks),
}));

export const playlistTracksRelations = relations(playlistTracks, ({ one }) => ({
  playlist: one(playlists, {
    fields: [playlistTracks.playlistId],
    references: [playlists.id],
  }),
}));

export const likedTracksRelations = relations(likedTracks, ({ one }) => ({
  user: one(users, { fields: [likedTracks.userId], references: [users.id] }),
}));

export const listeningHistoryRelations = relations(listeningHistory, ({ one }) => ({
  user: one(users, {
    fields: [listeningHistory.userId],
    references: [users.id],
  }),
}));
