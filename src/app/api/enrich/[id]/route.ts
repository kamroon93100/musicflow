import { type NextRequest } from "next/server";
import { z } from "zod";
import { cacheGet } from "@/lib/cache/redis";
import { enrichTrackFromMusicBrainz, mbCacheKey } from "@/lib/api/musicbrainz";
import type { Track } from "@/types/piped";

// YouTube video IDs are 11 chars of [A-Za-z0-9_-] (matches stream/lyrics routes).
const idSchema = z.string().regex(/^[A-Za-z0-9_-]{11}$/, "Invalid video ID");

// MB enrichment needs both title and artist (MusicBrainz has no video-ID notion).
const querySchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Title is too long"),
  artist: z
    .string()
    .trim()
    .min(1, "Artist is required")
    .max(200, "Artist is too long"),
});

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return Response.json(
      { success: false, error: "Invalid video ID" },
      { status: 400 },
    );
  }

  const parsed = querySchema.safeParse({
    title: request.nextUrl.searchParams.get("title"),
    artist: request.nextUrl.searchParams.get("artist") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const track: Track = {
    id: parsedId.data,
    title: parsed.data.title,
    artist: parsed.data.artist,
    duration: null,
    thumbnail: null,
  };

  try {
    // X-Cache reports whether this request hit the 30d cache (i.e. no MB call).
    const cached = await cacheGet(mbCacheKey(track));
    const metadata = await enrichTrackFromMusicBrainz(track);
    return Response.json(
      { success: true, data: metadata },
      { headers: { "X-Cache": cached !== null ? "HIT" : "MISS" } },
    );
  } catch (err) {
    // enrichTrackFromMusicBrainz never throws, so this is defensive only.
    const message = err instanceof Error ? err.message : "Enrichment failed";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}