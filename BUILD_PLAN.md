# MusicFlow Build Plan

## 🎯 Project Goal
Build a free music streaming web app (Spotify clone) with 120fps performance.

## 📊 Progress Tracker

### Phase 1: Foundation ⏳
- [x] 1.1 Providers setup (TanStack Query, Zustand, Theme, PWA)
- [x] 1.2 Supabase client + Drizzle ORM schema
- [x] 1.3 Auth system (signup, login, session)
- [x] 1.4 Base layout with sidebar + player bar placeholder

### Phase 2: Audio Engine 🔒
- [x] 2.1 Howler.js wrapper (play, pause, seek, volume)
- [x] 2.2 Piped API integration for stream URLs
- [x] 2.3 Gapless playback with next song preloader
- [x] 2.4 Media Session API for OS controls
- [x] 2.5 Player Zustand store + usePlayer hook

### Phase 3: API Layer 🔒
- [x] 3.1 Redis caching setup (Upstash)
- [x] 3.2 Search API cache layer
- [ ] 3.3 Stream URL caching
- [ ] 3.4 Spotify metadata enrichment
- [ ] 3.5 LRCLIB lyrics integration
- [ ] 3.6 Playlists CRUD (uses Supabase)
- [ ] 3.7 Rate limiting middleware

### Phase 4: Core UI 🔒
- [ ] 4.1 Sidebar navigation + library section
- [ ] 4.2 Top bar with search
- [ ] 4.3 NowPlayingBar (bottom fixed player)
- [ ] 4.4 Full-screen player (expandable, spring physics)
- [ ] 4.5 Virtualized track list component
- [ ] 4.6 Home page with sections
- [ ] 4.7 Search page with results
- [ ] 4.8 Playlist detail page

### Phase 5: Advanced Features 🔒
- [ ] 5.1 Synced lyrics overlay
- [ ] 5.2 Queue with drag-to-reorder
- [ ] 5.3 Canvas audio visualizer
- [ ] 5.4 Keyboard shortcuts
- [ ] 5.5 Color extraction from album art
- [ ] 5.6 Offline PWA support
- [ ] 5.7 Like/unlike with optimistic updates

### Phase 6: Polish + Deploy 🔒
- [ ] 6.1 Impeccable audit on all pages
- [ ] 6.2 120fps performance audit
- [ ] 6.3 Error boundaries at every route
- [ ] 6.4 Mobile responsiveness final pass
- [ ] 6.5 Sentry + Vercel Analytics setup
- [ ] 6.6 Vercel deployment
- [ ] 6.7 Load testing
- [ ] 6.8 Production launch 🚀

## 📋 Rules for Every Slice
1. Follow CLAUDE.md standards
2. State assumptions before coding (Karpathy Rule 1)
3. Present numbered plan with verification steps
4. Wait for confirmation before writing code
5. Check 21st.dev MCP for components
6. Check Context7 MCP for library docs
7. Minimum code (Karpathy Rule 2)
8. Surgical changes (Karpathy Rule 3)
9. Verify success criteria (Karpathy Rule 4)
10. Update this file - check off completed items

## 🔑 API Keys Needed (Before Phase 2)
- [ ] Supabase URL + Anon Key + Service Role Key
- [ ] Supabase DATABASE_URL
- [ ] Upstash Redis URL + Token
- [ ] Spotify Client ID + Secret
- [ ] Last.fm API Key
- [ ] (Piped API is public - no key needed)

## 📌 Current Status
Slices 1.1-1.4 complete (providers, Supabase clients + Drizzle schema, auth
system, base layout with sidebar + player bar). Slice 2.1 complete: Howler.js
audio engine — verified end-to-end with SoundHelix.
Slice 2.2 complete with known Piped IP block (see KNOWN_ISSUE.md [2.2]):
search verified live (6 results for "shape of you"); stream integration correct
but unverifiable until YouTube unblocks the Piped instance IPs or we self-host.
Slice 2.3 complete: gapless playback with next-song preloader — engine owns
mechanics (queue-agnostic), caller owns timing; auto-promote on end; chained
next-next preload; verified 65ms gap (Spotify-quality) in the temp
/test-gapless page (deleted after verification). See KNOWN_ISSUE.md [2.3].
Slice 2.4 complete: Media Session API — MediaSessionController mirrors engine
state to the OS Now Playing widget (play/pause/seekto real, prev/next inert
until 2.5); verified in Windows Chrome (widget shows metadata + controls,
widget play/pause works, Stop clears it). Engine unchanged (no browser-API
coupling). See KNOWN_ISSUE.md [2.4].
Slice 2.5 complete: Player Zustand store + usePlayer hook — single source of
truth for playback, queue, history, and modes. Glue layer connecting the
AudioEngine, Piped stream API, gapless preloader, and Media Session. PlayerState
with 14 actions (playTrack/playQueue/pause/resume/stop/next/previous/seek/
setVolume/toggleShuffle/cycleRepeat/queue actions). Stream-resolver seam for
testability. Engine event wiring (play/pause/end/error/progress) drives store
state. Gapless: engine auto-promotes, store correlates via internal
preloadedTrack; preload triggered at 80% or −20s; eager chain keeps gapless.
Repeat off/one/all (one replay, all chronological wrap). Next/Previous manage
history (most-recent-first). Media Session metadata synced on every track
change; OS prev/next WIRED to store actions via usePlayerStore.getState()
(imperative pattern, benign circular import). usePlayer() + 13 granular
selector hooks for 120fps; usePlayerActions() with useShallow for stable action
refs. Verified end-to-end (12-step walkthrough + extras): auto-advance, history,
queue management, repeat/shuffle, volume, OS widget + prev/next, Stop clears
state while retaining history.

# 🎉 PHASE 2: AUDIO ENGINE — 100% COMPLETE 🎉

### ✅ Summary
- **2.1** Howler.js wrapper (state machine, events, volume, seek)
- **2.2** Piped API integration (real YouTube Music search + streams)
- **2.3** Gapless playback (65ms verified, Spotify-quality)
- **2.4** Media Session API (OS Now Playing widget + media keys)
- **2.5** Player Zustand store (glue layer, all actions, prev/next wired)

The complete audio pipeline — request → stream → decode → play → advance →
preload-next — is done and verified end-to-end.

Slice 3.1 complete: Redis caching infrastructure (Upstash) — getRedis()
singleton with lazy init + graceful no-op fallback; cacheGet/cacheSet/cacheKey
helpers with JSON serialization; TTL consts match CLAUDE.md (search 5m,
metadata 24h, lyrics 30d); `muuzic:<kind>:<key>` namespace with normalized
keys; lazy optional Redis env (Supabase never depends on it). Verified live
against Upstash Tokyo (asia-northeast1): set/get/ttl/del round-trip, warm
latency ~757ms (4 sequential ops), cold-start ~1300ms. Fixed Upstash REST
auto-deserialize edge case (cacheGet now accepts string OR object). See
KNOWN_ISSUE.md [3.1].
Slice 3.2 complete: Search API Redis cache — searchSongs owns the cache,
returning `{ tracks, fromCache }` (cache provenance for X-Cache headers). The
in-memory searchCache Map was replaced with the Slice 3.1 helpers
(cacheKey/cacheGet/cacheSet, 5-min TTL). /api/search returns `X-Cache:
HIT | MISS` on 200. Empty results cached 5 min (prevents Piped hammering on
typos). Best-effort writes + graceful no-op without UPSTASH keys. Verified
live: MISS on first query, HIT on repeat, ~8x faster on hit, 20 real results,
body shape unchanged. See KNOWN_ISSUE.md [3.2].
Next: **Slice 3.3 — Stream URL caching** (decide whether/when to cache Piped
stream URLs; currently uncached by design — URLs are region-locked).
