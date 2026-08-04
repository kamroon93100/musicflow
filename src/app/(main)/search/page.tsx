/**
 * Minimal /search placeholder so the sidebar/mobile-nav "Search" link works.
 * The real search page (Piped results + Redis cache) lands in Slice 4.7.
 */
export default function SearchPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <h1 className="text-3xl font-bold tracking-tight">Search</h1>
      <p className="mt-3 text-muted-foreground">
        Search is coming in Slice 4.7 — check back soon.
      </p>
    </div>
  );
}