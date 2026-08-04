"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { House, Library, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: House },
  { href: "/search", label: "Search", icon: Search },
  { href: "/library", label: "Your Library", icon: Library },
] as const;

/** Near-critical spring — settles fast, no overshoot wobble (emil rule). */
const WIDTH_SPRING = { type: "spring", stiffness: 300, damping: 30 } as const;

/** Desktop rail: 240px expanded, 72px collapsed. Hidden below md (mobile nav). */
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
      <nav className="mt-2 flex flex-1 flex-col gap-1 px-3">
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