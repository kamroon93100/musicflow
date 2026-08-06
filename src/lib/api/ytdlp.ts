/**
 * Server-side yt-dlp streaming client (Slice 3.3-alt). Primary stream source:
 * our self-hosted yt-dlp service on Render, which bypasses the Piped/YouTube
 * IP block permanently (see KNOWN_ISSUE.md [2.2]).
 *
 * Design:
 * - 30s timeout: Render Free spins down after ~15 min idle; cold starts take
 *   30-50s. With Piped currently non-functional (all instances 500/502 as of
 *   Slice 3.3-alt commit), yt-dlp is our ONLY reliable layer — must give
 *   cold starts a chance to succeed. Worst case: first song of a cold
 *   session waits ~30s while service wakes; subsequent songs 2-5s (warm).
 * - 1 attempt, throws on failure (orchestrator catches, tries Piped fallback).
 * - Structured logs: videoId + ms + error for future Sentry integration.
 *
 * Verified end-to-end (Slice 3.3-alt commit): Rick Astley (dQw4w9WgXcQ)
 * plays through the app; response includes valid Google videoplayback URL.
 *
 * The format hint is normalized via toHowlerFormat (exported from piped.ts) so
 * both sources share one mapping (piped emits "WEBMA"/yt-dlp emits "webm" —
 * the shared map handles both via the WEBM entry).
 */
import { toHowlerFormat } from "@/lib/api/piped";
import type { StreamInfo } from "@/types/piped";

/** Render Free cold-start survival — allow up to 30s while the service wakes. */
const YTDLP_TIMEOUT_MS = 30_000;

/** The yt-dlp `/stream/:id` response fields we consume (Rest ignored). */
interface YtdlpStreamResponse {
  url?: string;
  format?: string;
  bitrate?: number | null;
  mimeType?: string | null;
  contentLength?: number | null;
}

/**
 * Resolve a direct audio URL for a video via our yt-dlp service.
 * Promise<StreamInfo> normalized to the shared shape (duration/title/uploader
 * from yt-dlp are intentionally dropped — the client only needs url + format).
 * Throws on any failure (timeout, non-2xx, missing url); the orchestrator
 * handles fallback.
 */
export async function getStreamFromYtdlp(videoId: string): Promise<StreamInfo> {
  const base = process.env.YTDLP_URL;
  if (!base) throw new Error("ytdlp not configured");

  const started = Date.now();

  let response: Response;
  try {
    response = await fetch(`${base}/stream/${encodeURIComponent(videoId)}`, {
      signal: AbortSignal.timeout(YTDLP_TIMEOUT_MS),
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "network error";
    console.warn("[stream] ytdlp failed", {
      videoId,
      error: message,
      ms: Date.now() - started,
    });
    throw new Error(message);
  }

  if (!response.ok) {
    const message = `HTTP ${response.status}`;
    console.warn("[stream] ytdlp failed", {
      videoId,
      error: message,
      ms: Date.now() - started,
    });
    throw new Error(message);
  }

  const raw = (await response.json()) as YtdlpStreamResponse;
  if (typeof raw.url !== "string" || !raw.url) {
    const message = "ytdlp returned no audio URL";
    console.warn("[stream] ytdlp failed", {
      videoId,
      error: message,
      ms: Date.now() - started,
    });
    throw new Error(message);
  }

  console.log("[stream] ytdlp OK", { videoId, ms: Date.now() - started });
  return {
    url: raw.url,
    format: toHowlerFormat(raw.format),
    bitrate: typeof raw.bitrate === "number" ? raw.bitrate : null,
    mimeType: raw.mimeType ?? null,
    contentLength: typeof raw.contentLength === "number" ? raw.contentLength : null,
  };
}