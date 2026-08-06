═══════════════════════════════════════════════
WEB CLAUDE HANDOFF — FOR NEXT CHAT SESSION
═══════════════════════════════════════════════

## PURPOSE
This file is for the user's WEB CLAUDE (Arena/ChatGPT-style, not Claude Code).
When the user starts a new chat session with web Claude, they will paste this
file's content so the new session immediately understands the project state
and workflow patterns we've established.

## PROJECT: MusicFlow
- Repo: https://github.com/kamroon93100/musicflow
- Type: Spotify-clone music streaming web app
- Stack: Next.js 16.2.12, React 19, Tailwind v4, Supabase (Tokyo), Upstash Redis (Tokyo), Zustand, TanStack Query, Framer Motion
- Path: C:\dev\muuzic (Windows)
- Dev command: npm run dev
- Streaming: Self-hosted yt-dlp on Render Free (bulletproof, permanent, free)

## COMPANION SERVICE
- Repo: https://github.com/kamroon93100/musicflow-ytdlp (separate)
- Runtime: Python + FastAPI + yt-dlp on Docker
- Deployed: https://musicflow-ytdlp.onrender.com
- Cost: $0/month permanently (Render Free tier)

## WORKFLOW PATTERN (proven across 3 slices)

The user works with BOTH:
1. Claude Code (in-terminal, has file access, runs commands)
2. Web Claude (Arena/browser, strategic guidance, prompt engineering)

Web Claude's role:
- Design slice plans with full toolbox invocation
- Write detailed prompts for Claude Code
- Review Claude Code's output for quality/correctness
- Interpret errors and provide fix strategies
- Never touches code directly — only orchestrates via prompts

Claude Code's role:
- Actually reads/writes files
- Runs tsc + build gates
- Commits + pushes to GitHub
- Reports back to user who forwards to web Claude

## COMMUNICATION PATTERN

User posts Claude Code's output to web Claude.
Web Claude analyzes + drafts next prompt.
User copies web Claude's prompt back to Claude Code.
Claude Code executes + reports back.
Repeat.

## MANDATORY TOOLBOX (invoke in every prompt)

Karpathy Rules:
1. Think before coding — state assumptions
2. Simplicity first — minimum viable code
3. Surgical changes — touch only what's needed
4. Goal-driven — numbered success criteria

Skills (in .claude/skills/):
- design-taste-frontend — no random gradients, no 3-equal-card rows, single accent color
- emil-design-eng — motion physics (spring stiffness/damping specs)
- apple-design — spatial continuity via layoutId
- animation-vocabulary — precise easing + duration specs
- pick-ui-library — ZERO new dependencies rule
- find-animation-opportunities — where NOT to animate
- ui-ux-pro-max — Music Streaming rules (48px touch targets, etc.)
- impeccable — auto-runs via PostToolUse hook (design detector)
- output-skill — no lazy implementations, every state handled

MCPs (may or may not connect):
- 21st.dev — search UI components before building from scratch
- Context7 — fetch latest library docs
- sequential-thinking — reason through architecture decisions
- filesystem, fetch, memory — standard MCP tools
- If unavailable: fall back to WebFetch + inline reasoning

Docs to reference:
- CLAUDE.md — master rules (perf, security, design system)
- BUILD_PLAN.md — slice progress tracker
- KNOWN_ISSUE.md — documented issues, resolutions, deferrals
- SESSION_HANDOFF.md — session-to-session continuity

## CURRENT STATE (last session end)

Latest commits (git log --oneline):
- 0b3001a chore: session handoff — slice 3.3-alt shipped, 4.6 resumes from step 4
- 6bd640b feat(3.3-alt): bulletproof primary + fallback streaming
- 71cdb69 wip(4.6): home page foundation Steps 1-3

Working tree: CLEAN
HEAD: on main, pushed to origin

## ACTIVE SLICE: 4.6 Home Page with Real Data

Steps 1-3 complete (committed as 71cdb69, work-in-progress).
Steps 4-13 remaining.

Full step breakdown is in SESSION_HANDOFF.md — read that first.

## SLICE PROTOCOL (do this for every step)

1. Web Claude drafts prompt invoking specific skills/rules
2. User pastes to Claude Code
3. Claude Code writes code, reads back, reports handoff notes
4. Attempts tsc (may be blocked by classifier)
5. If classifier blocks, user runs "! npx tsc --noEmit" manually
6. Web Claude reviews output, approves or requests changes
7. User visually tests in browser at localhost:3000
8. Web Claude interprets results
9. If good → proceed to next step
10. If bad → debug + fix + retry process flows forward only

Never batch steps. Pause after each for verification.
Never commit without tsc + build passing.

## KEY LEARNINGS FROM PREVIOUS SESSIONS

- Windows: adding new source files can corrupt .next cache
  → Fix: rm -rf .next + restart dev server (KNOWN_ISSUE [3.1])
- Base-ui DropdownMenuLabel needs Menu.Group parent
  → Use plain <div> instead (KNOWN_ISSUE [1.4])
- Supabase-js does NOT camelCase transform columns
  → Use snake_case column names in queries (KNOWN_ISSUE [3.6])
- Framer Reorder.Group needs stable DOM order
  → Skip TanStack Virtual on drag-reorder lists (KNOWN_ISSUE [4.5])
- Zustand: put non-reactive state at module scope, not inside create()
- React.memo requires stable prop references
  → Use entry-passing handlers, not zero-arg closures
- Player subscriptions must be granular (perf rule)
  → Never subscribe to position at page/section level
- Optimistic mutations: onMutate → cancelQueries → snapshot must be taken
  → onError rollback, onSettled invalidate

## HOW USER STARTS NEXT SESSION

1. Open Claude Code, project C:\dev\muuzic
2. Paste to Claude Code: "Read SESSION_HANDOFF.md, CLAUDE.md, BUILD_PLAN.md, KNOWN_ISSUE.md. Confirm understanding, wait for slice prompt."
3. Open new web Claude chat
4. Paste to web Claude: "I'm resuming MusicFlow. Here's our handoff:" + paste this file's content
5. Web Claude confirms understanding + drafts Step 4 prompt for Slice 4.6
6. User pastes Step 4 prompt to Claude Code
7. Work proceeds

## COMMIT MESSAGE CONVENTIONS

- feat(X.Y): completed slice
- wip(X.Y): work-in-progress slice
- fix(X.Y): bug fix for a slice
- chore: session handoff, docs, config

Always split commits by concern (proven best practice today).
Never sweep unrelated changes into a single commit.

End of web Claude handoff.
═══════════════════════════════════════════════