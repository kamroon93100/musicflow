"use client";

/**
 * Home page greeting (Slice 4.6). Time-based "Good morning/afternoon/evening"
 * plus the signed-in user's display name when we have one, falling back to
 * "there" otherwise — the h1 never renders broken. Renders immediately with
 * the fallback and updates in place when the auth query resolves (no spinner;
 * CLAUDE.md skeleton-not-spinner rule doesn't apply to a one-line label).
 */
import { useUser } from "@/hooks/use-user";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

export function GreetingSection() {
  const { data: user } = useUser();
  const name =
    (user?.user_metadata?.display_name as string | undefined) ??
    (user?.user_metadata?.full_name as string | undefined);

  return (
    <section aria-labelledby="greeting-heading">
      <h1 id="greeting-heading" className="text-3xl font-bold tracking-tight">
        {getGreeting()}, {name ?? "there"}
      </h1>
    </section>
  );
}