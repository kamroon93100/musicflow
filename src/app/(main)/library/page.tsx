/**
 * Minimal protected placeholder — exists so middleware route protection is
 * verifiable in Slice 1.3. Real library UI lands in Slice 4.
 */
export default function LibraryPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-2xl font-semibold">Your Library</h1>
      <p className="max-w-sm text-muted-foreground">
        Playlists and liked tracks will live here. This page is protected — if
        you can see it, the auth middleware is working.
      </p>
    </main>
  );
}