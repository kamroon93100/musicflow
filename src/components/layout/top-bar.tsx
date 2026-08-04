"use client";

import { useTransition } from "react";
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
 * Search is a disabled placeholder until Slice 4.2 wires it to /api/search.
 * The avatar menu is the one place users can sign out (also reachable on
 * mobile, where the bottom nav has no sign-out).
 */
export default function TopBar() {
  const [isPending, startTransition] = useTransition();
  const { data: user } = useUser();

  const handleSignOut = () =>
    startTransition(async () => {
      await logout();
    });

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-base/70 px-4 backdrop-blur md:px-6">
      <div className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          disabled
          aria-disabled="true"
          placeholder="Search music…"
          className="h-9 rounded-full pl-9"
        />
      </div>

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