import { cn } from "@/lib/utils";

const GENRES = [
  "Pop",
  "Hip-Hop",
  "Rock",
  "Electronic",
  "R&B",
  "Jazz",
  "Classical",
  "Lo-fi",
  "Indie",
  "House",
  "Folk",
  "Metal",
] as const;

/**
 * 12 flat genre tiles. Flat #282828 fills only — single-accent rule means no
 * per-genre color palettes. Two tiles span a column for a subtle bento so the
 * grid never reads as three-equal rows.
 */
export function GenreGrid() {
  return (
    <section aria-labelledby="genres-heading">
      <h2
        id="genres-heading"
        className="text-2xl font-semibold tracking-tight"
      >
        Browse genres
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {GENRES.map((genre, i) => (
          // TODO(slice-5.x): wire genre tile clicks to /genre/[slug] when genre
          // pages are built. Tiles are static divs for now — no nav yet.
          <div
            key={genre}
            className={cn(
              "flex h-24 items-end rounded-[8px] bg-elevated/80 p-3 text-sm font-semibold transition-[box-shadow,background-color] duration-150 ease-out hover:bg-elevated hover:ring-2 hover:ring-brand",
              (i === 0 || i === 6) && "col-span-2",
            )}
          >
            {genre}
          </div>
        ))}
      </div>
    </section>
  );
}