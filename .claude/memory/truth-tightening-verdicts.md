---
name: truth-tightening-verdicts
description: Locked Slice 4.8 dead-weight and CLAUDE.md correction decisions + hardened slice order
metadata: 
  node_type: memory
  type: project
  originSessionId: 147abe50-baf5-480a-9ca1-88e95424e154
  modified: 2026-08-07T08:27:16.055Z
---

User accepted the full project audit on 2026-08-07 and locked the following decisions. Applies to MusicFlow (`C:\dev\muuzic`).

**Slice order (LOCKED):** 4.7 ship search → 4.8 Truth Tightening → 4.9 Streaming Cascade (LIFEBLOOD) → 4.10 YT Data API + MusicBrainz + LRCLib → 4.11 real recs → 4.12 discovery → 4.13 playlist public + covers → 4.14 player/PWA/liked → 4.15 hardening+ratelimit+CSP.

**4.8 dead-weight verdicts:**
- Drizzle runtime → DELETE (keep src/lib/db/schema.ts — it's documentation; runtime db access is Supabase POSTgREST anon only; `db/index.ts` getDb() is never imported)
- @upstash/ratelimit → KEEP, wire in 4.15
- @tanstack/react-virtual → DELETE
- @use-gesture/react → DELETE
- date-fns → DELETE
- METADATA_TTL_SECONDS → KEEP, wire in 4.10
- liked_tracks table → KEEP (4.14, non-negotiable Spotify parity)
- search_history table → DELETE
- is_public column → KEEP (4.13)
- cover_url column → KEEP (4.13)
- env keys DELETE: NEXT_PUBLIC_PIPED_API, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, LASTFM_API_KEY

**CLAUDE.md corrections:** ratelimit→DEFER(4.15); CSP→DEFER(4.15); offline PWA→DEFER(4.14); recommendations→RENAME "Recommended for you"→"Popular now" now + note "Personalized recommendations in 4.11"; virtualization→DEFER guideline; <30KB→measurement target measured 4.15; 120fps→design principle benchmarked 4.15; tests/CI→FIX-NOW in 4.8 (GitHub Actions tsc+build+eslint per PR; one Playwright smoke test on `/`; playwright.config.ts).

**Why:** audit found CLAUDE.md promises were fiction — no rate limit route, no CSP (empty next.config.ts), no service worker, no Spotify/LastFM code, entire Drizzle runtime dead.

**How to apply:** when executing 4.8, follow the verdicts above; ship 4.7 first as its own atomic commit, never combine with 4.8. The `key={i}` skeleton keys in recommended-section.tsx:36 and recently-played-section.tsx:33 should be fixed (or at least noted) during 4.8.