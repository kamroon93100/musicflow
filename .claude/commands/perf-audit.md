Audit the current codebase for 120fps performance following CLAUDE.md standards:

1. Check all list components are wrapped in React.memo()
2. Verify player state doesn't cascade re-renders to other components
3. Check all animations use ONLY transform/opacity
4. Verify lists >30 items use TanStack Virtual
5. Check all images use next/image with proper sizes
6. Verify search is debounced (300ms)
7. Check scroll handlers use requestAnimationFrame
8. Verify audio preloading for gapless playback
9. Check bundle size per route (<30KB gzipped)
10. Verify Suspense boundaries on async components
11. Check for memory leaks (audio instances, listeners)

Report findings: 🔴 Critical | 🟡 Warning | 🟢 Good
