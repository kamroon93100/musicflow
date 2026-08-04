"use client";

import { useQuery } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth/actions";

/**
 * Current auth user via TanStack Query. Auth state lives OUTSIDE the player
 * stores — nothing audio-related subscribes to this query, so a login/logout
 * never re-renders the player (120fps rule #4).
 */
export function useUser() {
  return useQuery<User | null>({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const user = await getCurrentUser();
      return user;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}