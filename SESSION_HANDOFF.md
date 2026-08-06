═══════════════════════════════════════════════
MUSICFLOW — SESSION HANDOFF
═══════════════════════════════════════════════

## Last session ended: 2026-08-06

## COMMITS SHIPPED TODAY (chronological):
1. 6bd640b — feat(3.3-alt): bulletproof streaming with yt-dlp primary + Piped fallback
2. 71cdb69 — wip(4.6): home page foundation Steps 1-3

Both pushed to origin/main. Working tree CLEAN.

## SLICE 3.3-alt STATUS: ✅ COMPLETE

### What shipped:
- Self-hosted yt-dlp service on Render Free tier (zero cost, permanent)
- URL: https://musicflow-ytdlp.onrender.com
- Separate GitHub repo: https://github.com/kamroon93100/musicflow-ytdlp
- 3-layer streaming orchestrator:
  * Layer 0: Redis cache (5h TTL)
  * Layer 1: yt-dlp (30s timeout for cold starts)
  * Layer 2: Piped multi-instance fallback (existing)
- Structured error handling: StreamError class with per-layer details
- Response telemetry: X-Stream-Source header + X-Cache header
- Body preserves legacy { success, data } shape (backward compat)
- KNOWN_ISSUE [2.2] Piped IP block RESOLVED (Piped demoted to fallback)

### Verified end-to-end:
- Direct Render test: /stream/dQw4w9WgXcQ returns valid Google video URL
- In-app test: /api/stream/dQw4w9WgXcQ returns HTTP 200 via ytdlp layer
- Streaming works reliably even when Piped instances are down

### Environment vars (in .env.local, do NOT delete):
- YTDLP_URL=https://musicflow-ytdlp.onrender.com

## SLICE 4.6 STATUS: 🚧 IN PROGRESS (Steps 1-3 done, 4-13 remaining)

### Completed (committed as 71cdb69):
- Step 1: src/lib/cover.ts — extracted COVER_GRADIENTS + hashOf + gradientFor
  * Single source of truth for playlist header + future home cards
  * playlist-header.tsx imports from it (behavior unchanged)
- Step 2a: src/lib/db/supabase-service.ts (NEW)
  * Isolated RLS-BYPASS client with DANGER-ZONE JSDoc
  * Used ONLY by getPopularTracks
- Step 2b: src/lib/history/actions.ts (NEW)
  * getRecentlyPlayed(limit=8) — anon client, RLS-scoped user reads
  * getPopularTracks(limit=6) — service-role for cross-user aggregate, Redis cached 5min
  * trackPlayEvent(track, duration) — 30s threshold, 5min rate limit
- Step 3: src/stores/player-store.ts — wired trackPlayEvent
  * Module-level recordedThisSession Set (dedup per session)
  * Fires at 30s threshold in progress handler
  * Rolls back on error (allows retry)
  * Clears on stopPlayback

### REMAINING STEPS (do in order):
- Step 4: Create src/hooks/use-home.ts
  * useRecentlyPlayed() — TanStack Query, 60s stale
  * usePopularTracks() — TanStack Query, 5min stale (matches server Redis TTL)
- Step 5: Update src/components/home/greeting-section.tsx
  * Time-based greeting (morning/afternoon/evening)
  * User name from useUser() hook
- Step 5b: Create HomeTrackCard component (reusable for Steps 6-7)
  * 160px square, thumbnail + title + artist
  * Hover reveals 48px green play chip
  * Active track: shares layoutId with now-playing-bar thumb (spatial morph)
- Step 6: Rewrite src/components/home/recently-played-section.tsx
  * Uses useRecentlyPlayed() + HomeTrackCard
  * Skeleton/empty/error states with retry
  * Click card = playQueue(tracks, index)
- Step 7: Rewrite src/components/home/recommended-section.tsx
  * Uses usePopularTracks() + HomeTrackCard
  * Same states pattern
- Step 8: Create src/components/home/your-playlists-section.tsx
  * Uses useMyPlaylists() (existing)
  * FNV-1a gradient cards from cover.ts
  * Click = navigate to /playlist/[id]
  * Skip render if 0 playlists
- Step 9: Polish src/components/home/genre-grid.tsx
  * Add brand-green outline on hover
  * Add TODO comment for future genre pages
- Step 10: Wire everything into src/app/(main)/page.tsx
  * Compose: Greeting → RecentlyPlayed → YourPlaylists → Recommended → GenreGrid
  * 50ms section stagger + 30ms card stagger (first render only)
  * MotionConfig reducedMotion="user"
- Step 11: Run tsc --noEmit
- Step 12: Run npm run build
- Step 13: Commit as "feat(4.6): home page with real data + play tracking"

## SLICE 4.6 KEY DECISIONS ALREADY MADE:
- D1: Service-role client for getPopularTracks (documented in KNOWN_ISSUE [4.6])
- D2: JS-side dedup for recently played (no PostgREST GROUP BY)
- D3: Play tracking = 30s threshold + client Set + server 5min throttle
- D4: Active card uses layoutId matching now-playing-bar thumb
- D5: Each section owns its own useQuery (no useQueries bundle)
- D6: Stagger on first render only via stable keys
- D7: playQueue(sectionTracks, index) — fills queue with section
- D8: 160px square cards, 48px play chip, whole card is a button

## MANDATORY PROTOCOLS FOR TOMORROW:
- Karpathy Rule 1: State assumptions before coding, wait for user confirmation
- Karpathy Rule 3: Surgical changes, don't rewrite what works
- Karpathy Rule 4: Verify success criteria (tsc + build + visual)
- Pause after each step for user visual verification
- Zero new dependencies (pick-ui-library)
- All UI decisions per: design-taste-frontend, emil-design-eng, animation-vocabulary, apple-design, ui-ux-pro-max, find-animation-opportunities
- Impeccable auto-runs via PostToolUse hook

## KNOWN INFRASTRUCTURE FACTS:
- Render Free spins down after 15 min idle (30-50s cold start)
- Piped instances currently all 500/502 (that's why yt-dlp is primary)
- All documented in KNOWN_ISSUE [2.2] + [3.3-alt]
- Windows: after adding new files, restart dev server + clear .next 
  (KNOWN_ISSUE [3.1] amendment)

## TOOLS AVAILABLE (all still configured):
- MCPs: 21st.dev, Context7, sequential-thinking, filesystem, fetch, memory
  (Note: may or may not be connected — fall back to WebFetch + inline reasoning)
- Skills: design-taste-frontend, emil-design-eng, apple-design, 
  animation-vocabulary, pick-ui-library, find-animation-opportunities, 
  review-animations, improve-animations, prototype, impeccable, ui-ux-pro-max
- Hooks: impeccable via PostToolUse (auto-runs on Edit/Write/MultiEdit)

## WHAT TO DO TOMORROW (first message from user):
Expect user to say something like "I'm back, resume Slice 4.6 from Step 4."

Response protocol:
1. Read: CLAUDE.md, BUILD_PLAN.md, KNOWN_ISSUE.md, this file
2. Verify git status is clean, HEAD at 71cdb69 (or later if user pushed)
3. Confirm understanding of Slice 4.6 remaining steps (4-13)
4. WAIT for user to send Step 4 prompt (they have it drafted with their web Claude)
5. Follow same slice protocol: build → pause → verify → next step

End of handoff.
═══════════════════════════════════════════════
