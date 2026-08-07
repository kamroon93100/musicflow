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
 * - Server secrets (SUPABASE_SERVICE_ROLE_KEY) are validated
 *   LAZILY via getServerEnv(), called only from server-only modules. This
 *   lets `next build`/dev succeed before keys exist.
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
  CRON_SECRET: z.string().min(16, "CRON_SECRET must be at least 16 chars"),
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
      CRON_SECRET: process.env.CRON_SECRET,
    });
  }
  return cachedServerEnv;
}

/* ---- Optional Redis env (Slice 3.1) ------------------------------------------
 * UPSTASH_REDIS_REST_URL/TOKEN are OPTIONAL. When either is missing the cache
 * degrades to a no-op (see src/lib/cache/redis.ts), so the app runs fine before
 * keys exist. Deliberately separate from getServerEnv() — Supabase auth must
 * never depend on Redis being configured.
 */
const redisEnvSchema = z.object({
  url: z.url(),
  token: z.string().min(1),
});

let cachedRedisEnv: { url: string; token: string } | null | undefined;

/** Lazy, optional Redis connection config. Returns null when not configured. */
export function getRedisEnv(): { url: string; token: string } | null {
  if (cachedRedisEnv === undefined) {
    const parsed = redisEnvSchema.safeParse({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    cachedRedisEnv = parsed.success ? parsed.data : null;
  }
  return cachedRedisEnv;
}

/* ---- Optional yt-dlp env (Slice 3.3-alt) -------------------------------------
 * YTDLP_URL is OPTIONAL. When unset, the streaming orchestrator degrades to
 * Piped-only (see src/lib/api/piped.ts getStreamUrl). Kept separate from
 * getServerEnv() — Supabase auth must never depend on yt-dlp being configured.
 */
const ytdlpEnvSchema = z.object({
  url: z.url(),
});

let cachedYtdlpEnv: string | null | undefined;

// Callers that need the validated URL string should prefer this over
// process.env.YTDLP_URL directly. Boolean presence checks (see piped.ts
// orchestrator) can use either.
export function getYtdlpEnv(): string | null {
  if (cachedYtdlpEnv === undefined) {
    const parsed = ytdlpEnvSchema.safeParse({
      url: process.env.YTDLP_URL,
    });
    cachedYtdlpEnv = parsed.success ? parsed.data.url : null;
  }
  return cachedYtdlpEnv;
}
