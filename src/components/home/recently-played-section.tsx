import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Placeholder cover card. One large feature card + smaller siblings creates an
 * asymmetric bento (no three-equal-card rows, per taste rules). Real data +
 * virtualization land in Phase 3/4.
 */
function CoverCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "group/card overflow-hidden rounded-[8px] bg-card ring-1 ring-white/10 transition-colors duration-150 hover:bg-elevated",
        className,
      )}
    >
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-3 w-3/4 rounded-[4px]" />
        <Skeleton className="h-3 w-1/2 rounded-[4px]" />
      </div>
    </div>
  );
}

export function RecentlyPlayedSection() {
  return (
    <section aria-labelledby="recently-played-heading">
      <h2
        id="recently-played-heading"
        className="text-2xl font-semibold tracking-tight"
      >
        Recently played
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <CoverCard className="col-span-2 row-span-2" />
        <CoverCard />
        <CoverCard />
        <CoverCard />
        <CoverCard />
        <CoverCard />
      </div>
    </section>
  );
}