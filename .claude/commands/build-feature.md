Build the requested feature following MusicFlow standards from CLAUDE.md:

1. STATE ASSUMPTIONS (Karpathy Rule 1)
2. Present numbered success criteria plan
3. Get confirmation before coding
4. Check 21st.dev MCP for component patterns
5. Check Context7 MCP for library docs
6. Define TypeScript types in src/types/
7. Build API route with Zod validation + Redis cache + rate limit
8. Create API client in src/lib/api/
9. Create TanStack Query hook in src/hooks/
10. Build UI components with:
    - Loading state (skeleton)
    - Error state (with retry)
    - Empty state
    - Success state
11. Framer Motion animations (GPU-only, Emil rules)
12. Ensure player performance not affected
13. Mobile responsive
14. Accessibility (ARIA, keyboard)
15. Verify against success criteria
