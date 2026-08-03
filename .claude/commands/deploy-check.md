Run pre-deployment checklist:

1. TypeScript: npx tsc --noEmit → zero errors
2. Lint: npm run lint → zero warnings
3. Build: npm run build → successful
4. Bundle size: check against 30KB/route budget
5. Environment variables: all required vars present
6. Database migrations: all applied
7. Security: no exposed secrets, CSP headers set
8. Impeccable audit: npx impeccable detect src/
9. Lighthouse score: >95
10. Test critical paths manually
