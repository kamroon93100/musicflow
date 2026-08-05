# Known Issues

## [1.1] `--accent` set to green → hover surfaces render green
- **Status**: Accepted for now (matches Spotify brand).
- **Impact**: shadcn hover surfaces (`bg-accent text-accent-foreground`) use
  `#1db954` with `#121212` foreground. Contrast is fine; the aesthetic may or
  may not hold up once real UI lands.
- **Resolution**: If hover surfaces look bad in Slice 4 (Core UI), add a
  separate `--hover` token (`#282828`) and point hover utilities at it instead
  of `--accent`. Not doing this now — would be speculative.

## [1.1] PWA install prompt needs PNG icons
- **Status**: Deferred intentionally.
- **Impact**: `/manifest.webmanifest` is served and the app is installable in
  practice, but Chrome's install *prompt* requires 192/512 PNG icons — currently
  only an SVG icon exists.
- **Resolution**: Generate 192/512 PNG icons in Slice 5.6 (Offline PWA), where
  installability actually lands.

## [1.2] UUID v7 not feasible on Supabase
- **Status**: Corrected to v4 in schema
- **Reason**: gen_random_uuid() v7 requires PostgreSQL 18+, Supabase runs
  PG 15-17. pg_uuidv7 extension is not in the Supabase catalog.
- **Impact**: Marginal — index locality gains are negligible at our target
  scale (100k users).

## [1.2] drizzle-kit won't install via npm 11.12.1
- **Status**: Workaround adopted — use Supabase SQL editor for migrations
- **Reason**: npm 11.12.1 has a bug that silently drops certain
  devDependencies (@types/node, drizzle-kit, undici-types). The root
  lockfile is correct but npm's resolver excludes them from the installed
  tree.
- **Attempted fixes** (all failed):
  1. Clear hidden lockfile + reinstall
  2. Full npm cache clean --force
  3. Manual --save-dev install
  4. Nuclear reset (delete node_modules + package-lock)
- **Workaround**:
  - @types/node: manually installed via tarball extraction
  - drizzle-kit: SKIP — use Supabase SQL editor UI for migrations
  - Runtime unaffected (drizzle-orm + postgres both work fine)
- **Fix later**: Try npm upgrade or downgrade in Phase 6 polish.
  Alternatively, migrate to pnpm which doesn't have this bug.

## [1.2] Missing Supabase API keys
- **Status**: Slice 1.3 blocker
- **Required**: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL
- **Source**: https://supabase.com → Create project → Settings → API

## [1.3] Email confirmation disabled for dev
- **Status**: Intentional for now
- **Setting**: Supabase → Authentication → Providers → Email → "Confirm
  email" is OFF. signUp() returns a live session → instant login, and the
  users-row sync mirrors immediately.
- **Impact**: Anyone can self-register from /signup. Acceptable for dev; the
  anon key can only act within RLS bounds (own rows only).
- **TODO**: Enable "Confirm email" before production launch (Slice 6.5); the
  /auth/callback route already handles confirmation redirects.

## [1.4] middleware.ts convention deprecated in Next.js 16
- **Status**: Warning only, still functional
- **Warning**: "The 'middleware' file convention is deprecated. Please use
  'proxy' instead."
- **Fix later**: Rename src/middleware.ts → src/proxy.ts in Phase 6 polish
- **Reason for deferral**: Not blocking, working correctly; the deprecation
  removal is a future breaking change.

## [1.4] DropdownMenuLabel requires DropdownMenuGroup context
- **Status**: Fixed - replaced with plain styled div showing user email
- **Reason**: shadcn v4 (@base-ui/react) MenuGroupLabel needs a Menu.Group
  parent, otherwise throws "MenuGroupContext missing"
- **Fix applied**: Used plain <div> instead + wired useUser() hook for email
  display

## [2.1] Web Audio API deferred to Slice 5.3 (visualizer)
- **Status**: Deferred intentionally
- **Reason**: Using HTML5 audio for streaming (simpler, sufficient for MVP)
- **Impact**: Web Audio API will be added when Slice 5.3 visualizer needs
  AnalyserNode; no per-track EQ/effects in Phase 2 (not needed for MVP)

## [2.1] Emil Kowalski skills referenced but not installed as files
- **Status**: Rules applied inline from prompt content (worked correctly)
- **Reason**: Skills referenced by name in prompts don't exist in
  .claude/skills/ — only impeccable is installed there
- **Fix later**: Reinstall in Phase 6 polish:
  `npx skills@latest add emilkowalski/skills -a claude-code`

## [2.2] Piped stream endpoints blocked by YouTube anti-bot (transient)
- **Status**: Upstream throttle - not a code defect
- **Symptom**: /streams returns "SignInConfirmNotBotException: YouTube probably
  temporarily blocked anonymous watch access with this IP, got error
  LOGIN_REQUIRED"
- **Root cause**: YouTube periodically flags Piped instance IPs
- **Verified**: Both private.coffee + kavin.rocks flagged simultaneously (2026-08)
- **Our code handles it correctly**:
  - Multi-instance fallback attempts each host
  - Error message lists all failures per instance
  - Search endpoint unaffected (different YouTube API)
- **Blocks usually clear**: minutes to hours (YouTube-controlled)
- **Fix options for later**:
  1. Self-host Piped instance (own IP, less likely to flag)
  2. Add yt-dlp server-side extraction fallback (Slice 6.x)
  3. Wait for community to add more instances
  4. Switch to SoundCloud API (different content library)
- **Impact on Slices 2.3-2.5**: NONE
  - 2.3 gapless can test with mocked URLs
  - 2.4 media session tests with any playing audio
  - 2.5 player store works regardless of URL source
- **Fix in Phase 6 polish**: Add yt-dlp fallback OR self-host Piped

## [2.3] Gapless playback: verified 65ms gap (well under 100ms target)
- **Status**: Working perfectly - Spotify-quality
- **Measured**: 65ms gap in /test-gapless verification
- **Implementation**: HTML5 audio (streaming), NOT Web Audio API
- **Trade-off**: ~50-100ms gap vs sample-perfect (0ms) with Web Audio
- **User-perceptible impact**: None - anything under 100ms feels instant
- **Alternative**: Web Audio API for sample-perfect (requires full buffer
  download, not streaming) - deferred to Slice 5.3 visualizer
- **Also fixed during Slice 2.3**: AudioEventMap keys must match emitted
  type strings. Multi-word events use kebab-case (preload-ready,
  preload-error). Both TypeScript keys and emit()/on() calls now
  consistent throughout.

## [2.4] Media Session - OS widget confirmed working on Windows Chrome
- **Status**: Working - Windows Action Center shows Now Playing widget
- **Verified**: Widget appears with track title, artist, and controls
- **Widget controls work**: Play/Pause buttons in OS widget function
- **App icon appears**: MusicFlow green icon shows in widget

## [2.4] Media Session - Direct media keys depend on laptop hardware
- **Status**: Widget controls work; direct F7 media keys hardware-dependent
- **Reason**: Some laptops route media keys to specific apps or need Fn key
- **Not a code issue**: Media Session API doesn't control how OS routes keys
- **Workaround**: Users can use widget controls, Bluetooth headphones,
  or configure their laptop keyboard driver
- **No fix needed**: Standard behavior across all web music apps

## [2.4] Media Session - Windows Chrome may ignore SVG artwork
- Placeholder /icon.svg used - green icon does appear in widget
- Fix in Slice 4.x: Real album art from Piped/Spotify metadata

## [2.5] Media Session - OS prev/next wired to player store
- Status: prev/next buttons in the OS Now Playing widget now advance the queue
- Wiring: MediaSessionController handlers call
  usePlayerStore.getState().next() / .previous() (Zustand imperative pattern
  for non-React consumers)
- Note: circular import player-store <-> media-session is benign — the store is
  only touched inside handlers (runtime), never at module scope

## [3.1] Redis cache infrastructure verified live
- Status: Working end-to-end with Upstash Tokyo instance
- Latency from India: ~750ms warm, ~1300ms cold-start (4 sequential ops)
- Real-world usage (single GET/SET): expected ~50-150ms per operation
- Free tier: 10k commands/day sufficient for MVP
- Best-effort design: graceful no-op if Redis unavailable

## [3.1] Upstash REST auto-deserializes JSON on GET
- Issue discovered: client.get returns already-parsed object, not string
- Symptom: JSON.parse on live object threw error, cacheGet returned null
- Fix: cacheGet now handles both string and object responses
- Prevention: Test cache reads against real Upstash behavior early

## [3.1] App Router private folder gotcha
- Issue: _dev folder prefix makes route non-routable
- Symptom: 404 on /api/_dev/cache-check
- Fix: Renamed to /api/cache-check (no _ prefix)
- Lesson: Never use _ prefix for routes meant to be public

## [3.1] Next.js Windows write-race on .next/dev/types
- Issue: Torn TS files (TS1005, TS1128 errors)
- Cause: Dev server writing while tsc reading
- Fix: rm -rf .next then restart dev server
- Prevention: Don't run tsc during dev server compilation

## [3.2] Search cache Redis wiring verified live
- Status: Working - MISS on first query, HIT on repeat
- Speed: 8x improvement on cache hit (863 -> 6942 bytes/sec throughput)
- TTL: 5 minutes (SEARCH_TTL_SECONDS from Slice 3.1)
- Cache key: muuzic:search:<normalized-query>
- Empty results cached too (prevents Piped hammering on typos)
- Header: X-Cache: HIT | MISS on 200 responses only
- Body shape unchanged: { success: true, data: Track[] }

## [3.2] Case-variant queries share cache entry
- "Shape of You" and "shape of you" hit the same key
- Normalization via cacheKey helper (trim + lowercase + single-space)
- Impact: Positive - fewer redundant Piped calls

## [3.5] LRCLIB lyrics integration verified live
- Status: All 5 tests passed
- Positive cache: 30 days (lyrics never change)
- Negative cache: 1 day (community may add lyrics later)
- Search fallback: works when artist missing (Test 5 proved it)
- X-Cache header parity with search route
- Shape of You returned full synced LRC with timestamps

## [3.5] LRCLIB 404 vs outage handling
- 404 (no match): cached null for 1 day, returns success:true
- Network error: returns 502, NOT cached (prevents poisoning)
- Both paths verified working

## [3.6] Playlists CRUD verified against live Supabase
- Status: ALL PASSED - full create/add/reorder/remove/delete cycle
- Client: Supabase JS with RLS (user isolation enforced)
- RLS: All policies working (SELECT/INSERT/UPDATE/DELETE own rows)
- Reorder: Sentinel position -1 shift approach (collision-safe, verified)
- Cascade: deletePlaylist removes playlist_tracks automatically
- camelCase fix: database.types.ts now uses CamelToSnake type transform

## [3.6] Supabase JS requires explicit snake_case column names
- Root cause: PostgREST resolves raw column names, no camelCase transform
- Fix: CamelToSnake type utility in database.types.ts
- Impact: All Supabase queries must use snake_case (user_id, not userId)
- Drizzle schema stays camelCase (source of truth)
- Type safety preserved via ToSnake mapped type
- Auth actions unaffected (single-word keys like id/email)
- Timestamps: Drizzle types them Date, REST returns ISO strings (toIso helper)

## [4.1] Search page verified with real YouTube Music results
- Status: Working end-to-end
- Search: debounced 300ms, TanStack Query, Redis cached (server-side 5min)
- Results: real thumbnails, titles, artists, durations (m:ss)
- Active track highlighted with green ring (useCurrentTrack selector)
- Verified live: typing "shape of you" returns real Piped results

## [4.1] NowPlayingBar optimistic track info (Spotify behavior)
- Status: Track info shows IMMEDIATELY before stream fetch (startTrack sets
  currentTrack first, then awaits resolveStream)
- On stream success: audio plays, loading spinner clears
- On stream failure: track info stays, red "Stream unavailable" subtitle
- Prevents a blank bar on the Piped stream block (KNOWN_ISSUE [2.2])
- Play button disabled on failure; tooltip says tap the song again to retry

## [4.1] Stream fetch bounded retry (was effectively unbounded on failure)
- Previous: 8+ repeated 502 fetches observed per click on the Piped block
- Now: MAX_STREAM_ATTEMPTS = 2 (1 initial + 1 retry), fail-fast on 502/429/403
- Piped anti-bot blocks won't clear mid-retry, so retrying wastes calls
- Only a transient network/5xx failure earns the single retry
- Reduces server load and user-facing latency on failure
- Note: the route's internal 2-Piped-instance fallback (fetchPiped) is
  legitimate failover, not a retry; it is unchanged
