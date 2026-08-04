"use client";

import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/top-bar";
import MobileNav from "@/components/layout/mobile-nav";
import NowPlayingBar from "@/components/player/now-playing-bar";

/**
 * Main app shell: fixed sidebar + content column (top bar + scrollable main)
 * + fixed player bar. Everything inside the (main) route group inherits this.
 * Bottom padding reserves the player bar (90px) and, on mobile, the bottom nav
 * (56px) that sits below it.
 */
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-base flex h-dvh overflow-hidden text-foreground">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto pb-[146px] md:pb-[90px]">
          {children}
        </main>
      </div>

      <NowPlayingBar />
      <MobileNav />
    </div>
  );
}