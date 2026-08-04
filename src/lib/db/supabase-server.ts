import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Server-side Supabase client for API routes and server components.
 * Reads the user's session from the request cookies. Create a fresh client
 * per request — never cache one (cookies differ per request).
 *
 * Token refreshes write back to cookies via setAll. In Server Components
 * cookies are read-only, so setAll swallows the write error there — the
 * middleware (Slice 1.3) owns session refresh on the response path.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — cookie writes are forbidden.
          // Middleware handles the refresh there (see Supabase SSR docs).
        }
      },
    },
  });
}
