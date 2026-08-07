/**
 * Vercel cron pre-warm (Slice 4.9 Phase 3). Keeps the yt-dlp Render Free
 * instance awake during active hours so a user's first play doesn't eat a
 * 30-50s cold start (see KNOWN_ISSUE [3.3-alt]). Fired by vercel.json cron
 * every 10 minutes; Vercel attaches `Authorization: Bearer <CRON_SECRET>`.
 *
 * The probe is deliberately dumb: it only touches the service's /health (or
 * root as a 404 fallback) — it never resolves a stream, so it costs the
 * service nothing and warms the container (import + app boot) which is the
 * slow part. Zero user-facing surface; unauthorized callers get a 401.
 *
 * Node runtime: we need real fetch timing for the latencyMs metric.
 */
import { NextResponse } from "next/server";
import { getServerEnv, getYtdlpEnv } from "@/lib/env";

export const runtime = "nodejs";

/** Render cold starts take 30-50s; the cron must never hang on a dead one. */
const PROBE_TIMEOUT_MS = 10_000;

export async function GET(req: Request): Promise<NextResponse> {
  // Auth gate: Vercel cron sends `Authorization: Bearer <CRON_SECRET>`.
  // Exact match only — reject before doing any work.
  const auth = req.headers.get("authorization") ?? "";
  const { CRON_SECRET } = getServerEnv();
  if (auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const base = getYtdlpEnv();
  if (!base) {
    const payload = {
      ok: false,
      error: "YTDLP_URL not configured",
      endpoint: "none",
    };
    console.log("[cron:warm-ytdlp]", payload);
    return NextResponse.json(payload, { status: 502 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const started = Date.now();
  // Which endpoint the current/aborted request is against (for the error path).
  let endpoint = "/health";

  try {
    let response = await fetch(`${base}/health`, {
      signal: controller.signal,
      cache: "no-store",
    });
    // 404 → this service has no /health; fall back to root.
    if (response.status === 404) {
      endpoint = "/";
      response = await fetch(`${base}/`, {
        signal: controller.signal,
        cache: "no-store",
      });
      if (response.status === 404) {
        endpoint = "none";
        const payload = { ok: false, error: "HTTP 404", endpoint };
        console.log("[cron:warm-ytdlp]", payload);
        return NextResponse.json(payload, { status: 502 });
      }
    }

    const latencyMs = Date.now() - started;
    const payload = response.ok
      ? { ok: true, status: response.status, latencyMs, endpoint }
      : { ok: false, error: `HTTP ${response.status}`, endpoint };
    console.log("[cron:warm-ytdlp]", payload);
    return NextResponse.json(payload, { status: response.ok ? 200 : 502 });
  } catch (err) {
    // Network error or the 10s abort (timeout) — report against the endpoint
    // we were probing; never a /stream URL.
    const error = err instanceof Error ? err.message : String(err);
    const payload = { ok: false, error, endpoint };
    console.log("[cron:warm-ytdlp]", payload);
    return NextResponse.json(payload, { status: 502 });
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}