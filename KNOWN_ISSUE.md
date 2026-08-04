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
