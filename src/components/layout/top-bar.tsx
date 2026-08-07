"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUser } from "@/hooks/use-user";
import { logout } from "@/lib/auth/actions";

/**
 * 64px bar pinned to the top of the content column (right of the sidebar).
 * Header search: Enter → /search?q=X; Cmd/Ctrl+K focuses it (Slice 4.7).
 * Avatar menu is the only place users can sign out.
 */
export default function TopBar() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const { data: user } = useUser();

  const [q, setQ] = useState(""); // ephemeral local state — no global

  // Cmd/Ctrl+K → focus search. Single window listener, torn down on unmount;
  // no editable-target skip (shortcut always wins); preventDefault stops the
  // browser's own Cmd+K (address bar) from hijacking.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const handleSignOut = () =>
    startTransition(async () => {
      await logout();
    });

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-base/70 px-4 backdrop-blur md:px-6">
      <form role="search" onSubmit={handleSubmit} className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search music…"
          aria-label="Search music"
          className="h-9 rounded-full pl-9"
        />
      </form>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Account menu"
          className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Avatar className="size-8">
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            {user?.email ?? "Signed in"}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={isPending}
            onClick={handleSignOut}
          >
            <LogOut />
            {isPending ? "Signing out…" : "Sign out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}