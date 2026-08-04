"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Library, Search, User } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Home", icon: House },
  { href: "/search", label: "Search", icon: Search },
  { href: "/library", label: "Library", icon: Library },
] as const;

/**
 * iOS/Android-style tab bar. Visible only below md, fixed at the very bottom
 * with the NowPlayingBar floating directly above it (56px + 90px reserved in
 * the scroll container's padding). Min 44px touch targets per impeccable.
 */
export default function MobileNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 grid h-14 grid-cols-4 border-t border-border bg-surface/95 backdrop-blur md:hidden"
    >
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-[44px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors duration-150",
              active
                ? "text-brand"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-6" />
            <span>{label}</span>
          </Link>
        );
      })}
      {/* Profile — no page yet (real account page lands later). */}
      <div
        title="Profile — coming soon"
        className="flex min-h-[44px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground"
      >
        <User className="size-6" />
        <span>Profile</span>
      </div>
    </nav>
  );
}