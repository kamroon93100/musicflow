import { z } from "zod";

/**
 * MusicFlow environment access.
 *
 * Split by bundle boundary:
 * - Public vars (NEXT_PUBLIC_*) are validated EAGERLY at import. Both the
 *   server and browser need them, and a missing value is a hard config error
 *   — fail fast rather than limp along. Each var is read via a direct
 *   process.env.NEXT_PUBLIC_* reference so Next.js inlines it into client
 *   bundles at build time.
 * - Server secrets (SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL) are validated
 *   LAZILY via getServerEnv(), called only from server-only modules. This
 *   lets `next build`/dev succeed before keys exist (they land in Slice 1.3).
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const publicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

/** Typed, validated public env. Safe to import from client components. */
export const env = {
  supabaseUrl: publicEnv.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
} as const;

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
});

let cachedServerEnv: z.infer<typeof serverEnvSchema> | undefined;

/**
 * Server-only secrets, validated on first call and memoized. Importing env.ts
 * from a client bundle is safe; calling getServerEnv() there will throw (the
 * browser never has these vars) rather than leak them.
 */
export function getServerEnv() {
  if (!cachedServerEnv) {
    cachedServerEnv = serverEnvSchema.parse({
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      DATABASE_URL: process.env.DATABASE_URL,
    });
  }
  return cachedServerEnv;
}
