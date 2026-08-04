"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Browser-side Supabase client. isSingleton dedupes across renders so auth
 * state / websocket connections aren't churned per render. Safe to call from
 * any client component.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    isSingleton: true,
  });
}
