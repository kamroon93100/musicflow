/**
 * Upstash Redis cache — typed, best-effort, server-only (Slice 3.1).
 *
 * Importable from route handlers / server modules ONLY. Never import from a
 * client component: reading UPSTASH_* here would surface server tokens.
 * No `import "server-only"` guard (package isn't installed) — documented
 * convention, consistent with src/lib/api/piped.ts.
 *
 * BEST-EFFORT by design: Redis is an optimization, never a source of truth.
 *  - If UPSTASH_REDIS_REST_URL/TOKEN aren't configured, getRedis() returns
 *    null and every helper is a silent no-op (cache miss → upstream fetch).
 *  - If a command throws (transient Upstash hiccup), we catch and degrade to
 *    a cache miss rather than fail the request.
 * This matches the stream-resolver / lazy-secret seams used elsewhere.
 *
 * TTLs follow CLAUDE.md's cache rules exactly (search 5m, lyrics 30d).
 * Stream URLs are cached 5h (STREAM_TTL_SECONDS) — under the
 * ~6h YouTube URL expiry, leaving buffer for clock drift (Slice 3.3-alt).
 */
import { Redis } from "@upstash/redis";
import { getRedisEnv } from "@/lib/env";

export const SEARCH_TTL_SECONDS = 300; // 5 min
export const LYRICS_TTL_SECONDS = 2_592_000; // 30 d
/** Stream URL cache TTL (5h). Under the ~6h YouTube URL expiry, leaves buffer
 *  for clock drift. Set by getStreamUrl orchestrator in src/lib/api/piped.ts
 *  (Slice 3.3-alt). */
export const STREAM_TTL_SECONDS = 5 * 3600;

const KEY_PREFIX = "muuzic";

/* ---- Client singleton (lazy) ------------------------------------------------ */
let redis: Redis | null | undefined;

/** Lazily create + memoize the Redis client. null when unconfigured. */
export function getRedis(): Redis | null {
  if (redis === undefined) {
    const envCfg = getRedisEnv();
    // Leave undefined→null cached so we don't re-validate env every call.
    redis = envCfg ? new Redis({ url: envCfg.url, token: envCfg.token }) : null;
  }
  return redis;
}

/** Build a namespaced, normalized cache key: `muuzic:<kind>:<clean-key>`. */
export function cacheKey(kind: string, rawKey: string): string {
  const clean = rawKey.trim().toLowerCase().replace(/\s+/g, " ");
  return `${KEY_PREFIX}:${kind}:${clean}`;
}

/** Read a JSON cache value, or null on miss/error (never throws). */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const client = getRedis();
    if (!client) return null;
    const raw = await client.get<unknown>(key);
    if (raw == null) return null;
    // Upstash REST may return either the stored JSON string or an
    // already-deserialized value depending on its response-type handling.
    // Accept both — otherwise JSON.parse() on a live object throws and we
    // degrade a valid hit into a miss (exposed by the Slice 3.1 probe).
    return typeof raw === "string" ? (JSON.parse(raw) as T) : (raw as T);
  } catch {
    return null;
  }
}

/** Write a JSON cache value with a TTL. No-op when Redis is unavailable. */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number,
): Promise<void> {
  try {
    const client = getRedis();
    if (!client) return;
    await client.set(key, JSON.stringify(value), { ex: ttlSeconds });
  } catch {
    // Best-effort — a failed write is not worth failing the request.
  }
}