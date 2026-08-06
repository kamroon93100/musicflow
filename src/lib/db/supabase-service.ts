import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/lib/db/database.types";

/**
 * RLS-BYPASS Supabase client — SERVICE ROLE.
 *
 * ⚠️  DANGER ZONE. This client runs with the service-role key, which bypasses
 * RLS entirely. It can read AND write any row in every table, including PII.
 * Treat it as a privileged backdoor, not a convenience.
 *
 * WHAT IT IS FOR:
 *   Aggregate READ-ONLY queries over PUBLIC (non-PII) data that RLS makes
 *   impossible for the anon client to compute — e.g. `getPopularTracks`,
 *   which needs listening_history rows across ALL users to rank global
 *   popularity. Each user's anon session can only see their OWN rows (that's
 *   correct RLS behavior), but a cross-user aggregate is explicitly the rare
 *   case where that isolation is the *obstacle*, not the protection.
 *
 * WHAT IT IS NOT FOR:
 *   - Any per-user query (user{id histories, playlists, profile, etc.) — those
 *     must use the anon server client so RLS keeps users in their own data.
 *   - Any WRITE. There is no write path through this client. If you think you
 *     need to write with service-role, STOP.
 *   - Any PII (emails, names, avatar URLs, auth.users). This client returns
 *     ONLY public track snapshots (track_metadata jsonb) — never schema rows
 *     that carry user identity.
 *
 * DOCUMENTATION GATE: every use of this client MUST be justified in
 * KNOWN_ISSUE.md under the [4.6] entry. The aggregate read is bounded to a
 * fixed row window (no unbounded scans), and the only consumer today is
 * getPopularTracks in src/lib/history/actions.ts.
 *
 * ⚠️ If you need this client outside of getPopularTracks, STOP and discuss with
 * the team first — adding a second service-role path changes the security
 * surface and needs a fresh review, not a silent extension.
 *
 * Implementation: unlike supabase-server.ts, this does NOT use @supabase/ssr —
 * there are no cookies / sessions to manage (the service key authenticates
 * directly). We use the core @supabase/supabase-js createClient and disable
 * session persistence / auto-refresh, which are browser-only concerns and would
 * try to touch localStorage in a server context.
 */
export function createSupabaseServiceClient(): SupabaseClient<Database> {
  const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
  return createClient<Database>(env.supabaseUrl, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}