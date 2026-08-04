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
- [ ] 2.4 Media Session API for OS controls
- [ ] 2.5 Player Zustand store + usePlayer hook

### Phase 3: API Layer 🔒
- [ ] 3.1 /api/search route (Piped proxy + Redis cache)
- [ ] 3.2 /api/stream/[id] route (get audio URL)
- [ ] 3.3 /api/metadata/[id] route (Spotify enrichment)
- [ ] 3.4 /api/lyrics/[id] route (LRCLIB synced lyrics)
- [ ] 3.5 /api/recommendations route
- [ ] 3.6 /api/playlists CRUD routes
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
Next: **Slice 2.4 — Media Session API for OS-level controls.**
