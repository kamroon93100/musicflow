import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getServerEnv } from "@/lib/env";
import * as schema from "./schema";

/**
 * Lazy Drizzle client (postgres-js driver, Node runtime only — never Edge).
 * Built on first getDb() call so the app compiles/builds before DATABASE_URL
 * exists; the memoized singleton survives across requests (postgres-js pools
 * internally). Read-only imports are safe; calling getDb() without
 * DATABASE_URL throws a clear error (fail-fast at use).
 */
let _db: ReturnType<typeof createDb> | undefined;

function createDb() {
  const { DATABASE_URL } = getServerEnv();
  const client = postgres(DATABASE_URL, { max: 10 });
  return drizzle(client, { schema });
}

export function getDb() {
  if (!_db) {
    _db = createDb();
  }
  return _db;
}
