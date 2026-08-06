/**
 * Deterministic gradient cover generation (extracted from PlaylistHeader,
 * Slice 4.5 — now the single source of truth for the home page's playlist
 * cards AND the playlist detail header, so the two can never drift).
 *
 * Pattern: entities that have no real artwork (playlists) get a stable
 * placeholder gradient derived from their id. FNV-1a hashes the id to one of
 * four pre-defined dark gradients — deterministic across renders and reloads,
 * never Math.random (CLAUDE.md perf/UX). Two different ids may collide onto
 * the same gradient (4 buckets) — acceptable; the point is stability, not
 * uniqueness. No layout-triggering classes; the gradient is a pure background
 * paint, safe for 120fps.
 *
 * The hash function is exported on its own (hashOf) so any future placeholder
 * art (e.g. genre tiles, user avatars) can reuse the same deterministic pick.
 */
/** Four pre-defined dark gradients — hashed by id for stability. */
export const COVER_GRADIENTS = [
  "bg-[radial-gradient(circle_at_30%_20%,#1e3264_0%,#121212_70%)]",
  "bg-[radial-gradient(circle_at_70%_30%,#503750_0%,#121212_70%)]",
  "bg-[radial-gradient(circle_at_50%_10%,#1f3d2e_0%,#121212_70%)]",
  "bg-[radial-gradient(circle_at_25%_75%,#4d2f35_0%,#121212_70%)]",
];

/** FNV-1a 32-bit hash of a string → unsigned int (stable, no random). */
export function hashOf(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Pick the deterministic cover gradient class for an entity id. */
export function gradientFor(id: string): string {
  return COVER_GRADIENTS[hashOf(id) % COVER_GRADIENTS.length];
}
