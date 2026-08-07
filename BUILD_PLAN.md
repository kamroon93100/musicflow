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
- [x] 3.5 LRCLIB lyrics integration
- [x] 3.6 Playlists CRUD (uses Supabase)
- [ ] 3.7 Rate limiting middleware

### Phase 4: Core UI 🔒
- [ ] 4.1 Sidebar navigation + library section
- [ ] 4.2 Top bar with search
- [ ] 4.3 NowPlayingBar (bottom fixed player)
- [x] 4.4 Full-screen player (expandable, spring physics)
- [ ] 4.5 Virtualized track list component — waived on playlist detail
      (reorder-vs-virtualization conflict, KNOWN_ISSUE [4.5]); revisit at 500+ tracks
- [x] 4.6 Home page with sections
- [x] 4.7 Search page with results
- [x] 4.8 Playlist detail page

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
Slice 3.5 complete: LRCLIB lyrics integration — /api/lyrics/[id] route fetches
synced LRC + plain lyrics by track title + artist; getLyrics client in
src/lib/api/lrclib.ts owns the cache (same pattern as searchSongs). Primary
LRCLIB /api/get lookup, with an /api/search fallback when the artist is null
or the primary misses (Piped artist is a channel name). Cache: 30 days for
found lyrics (immutable), 1 day for misses (LRCLIB is community-curated and
gains lyrics). 404 vs outage are distinguished — a no-match caches a null
result as success, while a reachable-LRCLIB failure returns 502 and is never
cached (prevents poisoning). X-Cache HIT/MISS parity with search. All 5 live
tests passed: known track returns full LRC, repeat is a cache HIT, nonsense
title returns clean null, missing title/malformed id return 400, and the
no-artist search fallback finds lyrics (Test 5). See KNOWN_ISSUE.md [3.5].
Slice 3.6 complete: Playlists CRUD — Server Actions + TanStack Query hooks.
First slice writing to our Drizzle schema, via the anon-key Supabase server
client so RLS stays enforced (each user only sees/mutates their own rows).
5 Server Actions in src/lib/playlists (create/update/delete/getMyPlaylists/
getPlaylistWithTracks) + 3 track actions (addTrack appends at max+1,
removeTrack, reorderTrack via a collision-safe sentinel position -1 shift
against the unique (playlist_id, position) index — no RPC/migration needed).
6 TanStack Query hooks (useMyPlaylists, usePlaylistTracks, useCreatePlaylist,
useDeletePlaylist, useAddTrack, useRemoveTrack) invalidate+refetch on mutation
(no optimistic updates this slice — Phase 4). Track metadata snapshotted as
jsonb (zero-JOIN render). Key discovery: supabase-js does NOT camelCase for
us — PostgREST resolves raw column names, so the Database type now remaps
Drizzle camelCase → snake_case via a CamelToSnake transform (see
KNOWN_ISSUE.md [3.6]). Verified live: all 12 CRUD steps passed (create,
list, append×2, read, reorder, verify, rename, remove, verify, delete,
cascade count=0). Deleted the temp /test-playlists page after passing.
Remaining Phase 3 slices 3.3 (stream cache), 3.4 (Spotify metadata), 3.7
(rate limiting) deliberately deferred — low value vs effort for MVP.
> Phase 4 numbering note: the user runs Phase 4 in their own item order, which
> deviates from the checkbox list at the top of this file. Search page landed
> first (recorded as Slice 4.1 below); the full NowPlayingBar wire-up is 4.3;
> sidebar/library library sections, Home sections, and the track-list page come
> after. The checkbox tracker above is treated as a reference list, not a
> strict sequence.
Slice 4.1 complete: real search page + optimistic NowPlayingBar wire-up.
Search: debounced 300ms input, TanStack Query (queryKey ["search", q],
10-min staleTime riding the server-side Redis 5-min cache), loading skeleton
(8 rows) / empty / error-with-retry / idle states. SearchResultItem memoized —
the row IS a button (48px touch target, 8px radius, m:ss duration, null-artist
"Unknown artist" fallback); the currently-playing row is highlighted via
useCurrentTrack() → 1px #1DB954 ring. Motion (emil/animation-vocabulary):
hover 150ms ease-out (row → bg-elevated + a play chip fades in over the
thumb), click whileTap scale(0.98) 100ms. Thumbnails are plain <img> 48px /
8px radius — Piped/YT hosts aren't in next.config remotePatterns, so next/image
was rejected (assumption A1). NowPlayingBar partially wired (full = 4.3):
publishes currentTrack optimistically BEFORE the stream fetch (Spotify
behavior) so the bar shows the title the instant a result is clicked; a spinner
overlays the thumb while the stream URL resolves; on failure the bar keeps the
track info and shows red "Stream unavailable"; play/pause is functional. Player
store hardening: startTrack sets currentTrack first (FIX A); new streamError
store field + useStreamError() granular selector; defaultResolveStream is now
bounded (MAX_STREAM_ATTEMPTS = 2, fail-fast on 502/429/403) — the previous
path could emit 8+ fetches per click on the Piped block (FIX B/C; the route's
internal 2-instance fallback is legitimate, not a retry). Verified end-to-end:
search returns real YouTube Music results with thumbnails; clicking a result
shows the track in the bar immediately; the still-active Piped stream block
shows a graceful error with no retry storm. See KNOWN_ISSUE.md [4.1].
Slice 4.3 complete: full NowPlayingBar wire-up (seek + volume + transport).
NowPlayingBar rewritten as 3 isolated memoized sub-components + a shell that
subscribes to nothing, so a position tick (~60fps from the rAF progress loop)
re-renders ONLY PlaybackControls; TrackInfo and VolumeControl stay static
(120fps rule #4). TrackInfo (left): thumbnail/title/artist + loading spinner
overlay + red "Stream unavailable" on streamError. PlaybackControls (center):
SkipBack / Play-Pause / SkipForward (44px touch targets, impeccable) + seek bar
with m:ss position/duration labels. Seek is a controlled slider with a local
drag snapshot (so the rAF position tick can't fight the thumb) that fires
engine seek() once on release via base-ui's onValueCommitted; disabled when no
track / duration 0 / stream error. Transport: next disabled when queue empty,
previous when history empty (a lone search track → both disabled). VolumeControl
(right): Volume2/VolumeX icon toggles mute via a lastNonZero ref (no store
change), instant setVolume on change; green fill is the slider's bg-primary
(#1DB954). Motion per emil: seek is real-time data → linear, no spring; volume
is instant. formatDuration(seconds → m:ss) added to src/lib/utils.ts (shared;
search-result-item keeps its local copy, untouched). Base-ui gotcha surfaced by
tsc: the Slider release event is onValueCommitted (NOT onValueCommit) and
callbacks receive `number | readonly number[]` (not always number[]) —
normalized with Array.isArray in both handlers (see KNOWN_ISSUE.md [4.3]).
Verified end-to-end: seek ticks live, drag-to-jump works, volume + mute toggle
work, prev/next disabled for a lone track, play/pause and the stream-error state
are preserved. See KNOWN_ISSUE.md [4.3].
Slice 4.4 complete: full-screen player + synced lyrics + spatial expand. Opens
from the NowPlayingBar track-info trigger (A4); overlay mounts in (main)/layout
via next/dynamic ssr:false + a mounted-latch host so the chunk loads on first
open only (A10). AnimatePresence enter = spring (stiffness 300, damping 30)
rising out of the bar; exit = ease-in 200ms sliding back down (A5). Spatial
continuity: the artwork shares a Framer layoutId with the bar thumbnail, so it
morphs out of the bar on open and back into it on close (A2; degrades to a
plain crossfade when a track has no thumbnail). Layout (A6): mobile full-bleed
takeover with a draggable top grab handle (Apple Music swipe-down-to-close;
dragSnapToOrigin, closes past 120px offset / 500px/s velocity); desktop centered
600px modal (max-h 92vh, rounded-2xl, dimmed backdrop, click closes). Artwork:
size-[min(300px,60vw)] mobile / size-400 desktop, 8px radius, semi-transparent
shadow. Transport: 56px play/pause, 44px shuffle/prev/next/repeat with green
active states (repeat off→all→one via Repeat/Repeat1 icons); full-width seek +
m:ss labels, volume mute + slider, disabled queue placeholder ("Queue coming in
Slice 5.2"). Perf: panel middle (art/title/lyrics) never subscribes to position;
only PlayerControls and the lyrics wrapper do, and the lyric line list is memo'd
so the 60fps tick re-renders just the wrapper (A7). Lyrics: TanStack Query
["lyrics", id] with 30d stale/gcTime mirroring the server Redis 30d cache
(Slice 3.5); client LRC parser; active line highlighted #1DB954 and auto-centered
via scrollIntoView on active-index change; fallbacks: instrumental / plain-text /
"No lyrics available" + skeleton / "Try again" states. State:
isFullScreenPlayerOpen + open/close in ui-store (A3). Verified end-to-end: opens
from bar with spring + art morph, all controls functional, closes cleanly via X /
backdrop / swipe, search page and bar state preserved across open/close. See
KNOWN_ISSUE.md [4.4].
Slice 4.5 complete: playlist detail page with drag-reorder + play-all.
PlaylistHeader (memo'd): deterministic FNV-1a gradient cover (TODO(phase-5):
real cover art once actions/toPlaylist exposes coverUrl), name/description/
meta "N tracks · X hr Y min" (new formatTotalDuration in utils), 56px brand
Play + 48px ghost Shuffle (both hidden when empty), "..." menu → Edit details /
Delete (destructive). Sticky #/Title/Time column row sticks under the top bar
while the list scrolls. PlaylistTrackList: framer Reorder.Group of memo'd
PlaylistTrackRows — drag → EXACTLY ONE mutation (onReorder mirrors to a ref
for instant visuals, onDragEnd fires the reorder once, reading orderRef not
state to dodge the batching stale-closure); RACE LOCK dragListener={!reorderPending
&& !coarse} serializes in-flight reorders (server reorder is not transactional);
touch reorder deferred via useIsCoarsePointer (matchMedia "(pointer: coarse)");
resync from cache truth gated by dragRef so a refetch can't clobber an active
drag; valid ul>li>div nesting; empty state with brand "Go to search" Link.
PlaylistTrackRow: index ↔ play-icon hover swap, equalizer bars animate scaleY
only while that track plays, X-button-as-sibling for remove (no nested
buttons), whileTap 0.995. Hooks layer: useReorderTrack optimistic pure row move
+ position normalization 0..n-1; useUpdatePlaylist optimistic applyUpdate to
both ["playlists"] and ["playlist-tracks", id] caches; useRemoveTrack optimistic
decrement trackCount; useAddTrack optimistic temp id (opt:<id>:<seq>) for the
search flow. EditPlaylistDialog: seeds from playlist on open, no-op guard,
mutateAsync + inline error. Delete confirm Dialog → deletePlaylist →
router.push("/library"), error kept in-dialog with toast. Search result row
restructured (shell + play-row + trailing "..." DropdownMenu): row button +
sibling "..." menu + CreatePlaylistDialog OUTSIDE the menu popup (base-ui
Menu.Popup unmounts content on close — dialog would vanish); chain-add via
onCreated; lazy AddToPlaylistMenu fetches useMyPlaylists only while open; the
"Add to playlist" header is a plain div, NOT DropdownMenuLabel ([1.4] regression
re-hit — see KNOWN_ISSUE [4.5]). Toaster mounted in providers; toast viewport
raised to bottom-28 (above the 90px player bar). Verified end-to-end by the
user: gradient cover, library/search wiring, drag-reorder (desktop), equalizer
on active row, stream-block handling, active-track indicator. See KNOWN_ISSUE.md
[4.5].
Slice 4.6 complete: home page with real data + play tracking. Greeting
(time-based + user name), Recently Played, Popular (Recommended), Your
Playlists, and Genre grid sections. HomeTrackCard (160px square, hover play
chip, layoutId spatial morph with NowPlayingBar thumb on active track).
Data via use-home.ts hooks: useRecentlyPlayed (60s stale) + usePopularTracks
(5min stale, matches server Redis TTL) both riding the Step 2 history
actions (RLS-scoped reads for recently-played, service-role aggregate for
popular). Your Playlists uses existing useMyPlaylists + FNV-1a gradient
covers from src/lib/cover.ts (SoT), skip-render when empty. Genre tiles got
brand-green hover ring + future-page TODO. Page composed Greeting →
RecentlyPlayed → YourPlaylists → Recommended → GenreGrid with 50ms section /
30ms card stagger (first render only) under MotionConfig reducedMotion="user".
Perf: sections each own their useQuery (no useQueries bundle); memoized
cards; player state never re-renders outside the player. Verified: tsc clean,
build passes, visual verification all pass. SEE KNOWN_ISSUE [4.6]: E2E play
-tracking (30s trackPlayEvent → Recently/Popular sections fill) verification
DEFERRED due to upstream streaming outage (yt-dlp 502, both Piped 500/502);
all server actions return 200 and empty-state rendering verified.
Slice 4.7 complete: Search page with URL sync + Cmd/Ctrl+K shortcut +
playQueue integration. URL query string (?q=X) is the source of truth
(decision D2); the client mirrors it into a local input, debounces 300ms,
writes back via router.replace (no history spam), and re-syncs on external
nav. generateMetadata (server shell) renders the dynamic <title>; the
useSearchParams client is wrapped in a <Suspense> boundary (Next 16 build
gate). Data: use-search hook with AbortController {signal} cancellation +
keepPreviousData for flash-free transitions + 10min staleTime riding the
server Redis 5-min cache. Selecting a row calls playQueue(results, index)
so next/prev traverse the result set (D5); the active row's thumbnail shares
a layoutId with the NowPlayingBar thumb so it morphs on play (D6). Header
search (TopBar) is a launch pad: Enter → /search?q=X; Cmd/Ctrl+K focuses it
(single window listener, torn down on unmount, ref-forwarded Input via
base-ui + React 19 ref-as-prop). E2E caught a real bug — fast typing dropped
characters because the external-sync latch clobbered in-flight input; fixed
with the lastWrittenRef echo-detection pattern (see KNOWN_ISSUE [4.7]).
Verified: tsc clean, build passes, fast typing lands every char, back/forward
synccorrectly, header nav + Cmd+K work. KNOWN_ISSUE [4.6] (E2E play-tracking
verification) remains DEFERRED — streaming outage, not a Slice 4.7 bug.
Next: Slice 4.8 — Spotify integration, pivoting to a Meld-inspired
architecture. See SESSION_HANDOFF.md for the Meld GitHub context link.
