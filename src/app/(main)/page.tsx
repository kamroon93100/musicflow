import { GreetingSection } from "@/components/home/greeting-section";
import { RecentlyPlayedSection } from "@/components/home/recently-played-section";
import { RecommendedSection } from "@/components/home/recommended-section";
import { GenreGrid } from "@/components/home/genre-grid";

/**
 * Home page (served at / via the (main) route group). Landing spot after
 * login/signup. Static placeholder sections until the Phase 3 API layer feeds
 * real recommendations and history.
 */
export default function HomePage() {
  return (
    <div className="space-y-10 px-4 py-6 md:px-8 md:py-8">
      <GreetingSection />
      <RecentlyPlayedSection />
      <RecommendedSection />
      <GenreGrid />
    </div>
  );
}