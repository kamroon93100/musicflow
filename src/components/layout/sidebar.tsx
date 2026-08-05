"use client";

/**
 * Desktop rail: 240px expanded / 72px collapsed (hidden below md — mobile nav).
 * Logo, primary nav, then a scrollable "Playlists" section fed by real data
 * (useMyPlaylists → TanStack Query → Supabase). Sidebar never subscribes to
 * player state, so it stays static during playback (120fps rule #4).
 *
 * Collapsed mode: names hide, each playlist becomes a centered first-letter
 * tile (Spotify-style); the create button stays as a bare +.
 */
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { House, Library, PanelLeftClose, PanelLeftOpen, Plus, Search } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { useMyPlaylists } from "@/hooks/use-playlists";
import { CreatePlaylistDialog } from "@/components/playlist/create-playlist-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Playlist } from "@/types/playlist";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: House },
  { href: "/search", label: "Search", icon: Search },
  { href: "/library", label: "Your Library", icon: Library },
] as const;

/** Stable keys for the 3 skeleton rows — never index keys (CLAUDE.md). */
const SKELETON_KEYS = ["s1", "s2", "s3"] as const;

/** Near-critical spring — settles fast, no overshoot wobble (emil rule). */
const WIDTH_SPRING = { type: "spring", stiffness: 300, damping: 30 } as const;

export default function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 240 }}
      transition={WIDTH_SPRING}
      aria-label="Primary"
      className="hidden h-full shrink-0 flex-col overflow-hidden border-r border-border bg-surface md:flex"
    >
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center gap-2.5 px-4">
        <span className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-brand text-background">
          <span className="text-base font-black">M</span>
        </span>
        <span
          className={cn(
            "whitespace-nowrap text-lg font-bold tracking-tight transition-opacity duration-150",
            collapsed && "opacity-0",
          )}
        >
          Music<span className="text-brand">Flow</span>
        </span>
      </div>

      {/* Nav */}
      <nav className="mt-2 flex shrink-0 flex-col gap-1 px-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-10 items-center rounded-full px-3 text-sm font-medium transition-colors duration-150",
                collapsed && "justify-center px-0",
                active
                  ? "bg-elevated text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon
                className={cn(
                  "size-5 shrink-0 transition-colors duration-150",
                  active && "text-brand",
                )}
              />
              <span
                className={cn(
                  "ml-3 overflow-hidden whitespace-nowrap transition-opacity duration-150",
                  collapsed && "ml-0 w-0 opacity-0",
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Playlists — grows to fill, scrolls when long */}
      <PlaylistsSection collapsed={collapsed} pathname={pathname} />

      {/* Collapse toggle — desktop only */}
      <div className="shrink-0 border-t border-border p-3">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-10 w-full items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-elevated hover:text-foreground"
        >
          {collapsed ? (
            <PanelLeftOpen className="size-5" />
          ) : (
            <PanelLeftClose className="size-5" />
          )}
        </button>
      </div>
    </motion.aside>
  );
}

/* ---- Playlists section ----------------------------------------------------- */

function PlaylistsSection({
  collapsed,
  pathname,
}: {
  collapsed: boolean;
  pathname: string;
}) {
  const { data: playlists, isPending } = useMyPlaylists();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col pt-4">
      {/* Header: "Playlists" label (expanded) + create button */}
      <div
        className={cn(
          "mb-1 flex shrink-0 items-center px-3",
          collapsed && "justify-center px-0",
        )}
      >
        {!collapsed && (
          <h3 className="flex-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Playlists
          </h3>
        )}
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          aria-label="Create playlist"
          title="Create playlist"
          className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-elevated hover:text-brand"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {isPending ? (
          <PlaylistSkeletons collapsed={collapsed} />
        ) : (
          <div
            className={cn(
              "flex flex-col gap-1 pb-2",
              collapsed ? "items-center px-1" : "px-1 pr-2",
            )}
          >
            {!playlists || playlists.length === 0 ? (
              !collapsed && (
                <p className="px-2 py-1 text-xs text-muted-foreground">
                  No playlists yet
                </p>
              )
            ) : (
              playlists.map((playlist) => (
                <PlaylistRow
                  key={playlist.id}
                  playlist={playlist}
                  collapsed={collapsed}
                  active={pathname === `/playlist/${playlist.id}`}
                />
              ))
            )}
          </div>
        )}
      </ScrollArea>

      <CreatePlaylistDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

/* ---- One playlist row ------------------------------------------------------- */

function PlaylistRow({
  playlist,
  collapsed,
  active,
}: {
  playlist: Playlist;
  collapsed: boolean;
  active: boolean;
}) {
  return (
    <Link
      href={`/playlist/${playlist.id}`}
      title={playlist.name}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-11 min-w-0 items-center rounded-[8px] text-sm font-medium transition-colors duration-150",
        collapsed ? "w-full justify-center" : "gap-3 px-2",
        active
          ? "bg-elevated text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "grid shrink-0 place-items-center bg-elevated text-xs font-bold text-foreground",
          collapsed ? "size-9 rounded-full" : "size-9 rounded-[8px]",
        )}
      >
        {playlist.name.charAt(0).toUpperCase()}
      </span>
      {!collapsed && <span className="truncate">{playlist.name}</span>}
    </Link>
  );
}

/* ---- Loading skeletons (3 rows) --------------------------------------------- */

function PlaylistSkeletons({ collapsed }: { collapsed: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 pb-2",
        collapsed ? "items-center px-1" : "px-1 pr-2",
      )}
    >
      {SKELETON_KEYS.map((key) =>
        collapsed ? (
          <Skeleton key={key} className="my-1 size-9 rounded-full" />
        ) : (
          <div key={key} className="flex h-11 items-center gap-3 px-2">
            <Skeleton className="size-9 shrink-0 rounded-[8px]" />
            <Skeleton className="h-3 flex-1 rounded-full" />
          </div>
        ),
      )}
    </div>
  );
}
