/**
 * Client-facing stream endpoint (Slice 3.3-alt). Resolves a playable audio URL
 * for a video through the getStreamUrl orchestrator's source cascade:
 * Redis cache → yt-dlp → Piped multi-instance fallback.
 *
 * BODY SHAPE IS A STABLE API. Clients (player-store defaultResolveStream)
 * parse `{ success, data }` where data is the StreamInfo (url/format/...). Do
 * NOT rename fields, and do NOT add `source` to the body — consumers read the
 * winning source from the X-Stream-Source header instead. Changing this shape
 * breaks playback everywhere and requires a coordinated client update.
 *
 * HEADERS ARE INTERNAL TELEMETRY (invisible to the audio engine):
 *   X-Stream-Source: cache | ytdlp | piped-primary | piped-fallback | none
 *   X-Cache:          HIT (from Redis) | MISS (resolved this request)
 * `none` on the failure path lets client-side monitoring see the category.
 *
 * The orchestrator throws StreamError carrying per-layer failure details
 * ({ ytdlp?: string, piped: string[] }); the route logs those for debugging
 * and returns only the generic `error` message to the client.
 */
import { z } from "zod";
import { getStreamUrl, StreamError } from "@/lib/api/piped";

// YouTube video IDs are 11 chars of [A-Za-z0-9_-].
const idSchema = z.string().regex(/^[A-Za-z0-9_-]{11}$/, "Invalid video ID");

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const parsed = idSchema.safeParse(id);

  if (!parsed.success) {
    return Response.json({ success: false, error: "Invalid video ID" }, { status: 400 });
  }

  try {
    const result = await getStreamUrl(parsed.data);
    const headers = new Headers();
    headers.set("X-Stream-Source", result.source);
    headers.set("X-Cache", result.source === "cache" ? "HIT" : "MISS");
    // Body preserves the legacy shape — `data` is the StreamInfo, NOT the
    // { data, source } wrapper. source lives in the header only.
    return Response.json(
      { success: true, data: result.data },
      { headers },
    );
  } catch (err) {
    if (err instanceof StreamError) {
      // Expected failure: every source fell through. Details are server-side
      // debugging breadcrumbs; the client gets the generic message only.
      console.error("[stream] all sources failed", {
        videoId: parsed.data,
        details: err.details,
      });
      const headers = new Headers();
      headers.set("X-Stream-Source", "none");
      return Response.json(
        { success: false, error: err.message },
        { status: 502, headers },
      );
    }
    // Unexpected failure — don't leak internal error strings to the client.
    console.error("[stream] unexpected error", {
      videoId: parsed.data,
      error: err instanceof Error ? err.message : String(err),
    });
    return Response.json(
      { success: false, error: "Failed to fetch stream" },
      { status: 500 },
    );
  }
}
