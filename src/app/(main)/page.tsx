"use client";

/**
 * Home page (served at / via the (main) route group). A client component
 * because the section stagger needs MotionConfig + motion.*; there is no
 * server data to fetch at page level — each section owns its own TanStack
 * Query (steps 4-9). Children own their data, this file owns only layout +
 * entrance.
 *
 * Stagger (first render): sections rise in with a spring (spatial continuity
 * per apple-design), 50ms apart. GreetingSection is the anchor — it renders
 * instantly, unstaggered. Section order puts personal data (recently played)
 * above algorithmic data (recommended).
 *
 * Parent-arranged spacing via space-y-10; single-column, centered, width cap
 * (the app shell supplies the sidebar).
 */
import { motion, MotionConfig } from "framer-motion";
import { GreetingSection } from "@/components/home/greeting-section";
import { RecentlyPlayedSection } from "@/components/home/recently-played-section";
import { YourPlaylistsSection } from "@/components/home/your-playlists-section";
import { GenreGrid } from "@/components/home/genre-grid";

/** The three staggered sections, in render order, with fixed keys (CLAUDE.md:
 *  never index keys) and their 50ms-spaced delays. (Recommended-for-you is
 *  hidden until Slice 4.11 — the query/component stays on disk, unrendered.) */
const SECTIONS = [
  { key: "recent", Component: RecentlyPlayedSection, delay: 0.0 },
  { key: "library", Component: YourPlaylistsSection, delay: 0.05 },
  { key: "genres", Component: GenreGrid, delay: 0.15 },
] as const;

export default function HomePage() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto max-w-screen-xl space-y-10 px-6 py-8">
        <GreetingSection />
        {SECTIONS.map(({ key, Component, delay }) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30, delay }}
          >
            <Component />
          </motion.div>
        ))}
      </div>
    </MotionConfig>
  );
}