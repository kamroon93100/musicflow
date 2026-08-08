import { type NextRequest } from "next/server";
import { z } from "zod";
import { searchSongs } from "@/lib/api/piped";
import { enrichSearchResults } from "@/lib/api/youtube";

const querySchema = z.object({
  q: z.string().trim().min(1, "Query is required").max(200, "Query is too long"),
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    q: request.nextUrl.searchParams.get("q"),
  });

  if (!parsed.success) {
    return Response.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid query" },
      { status: 400 },
    );
  }

  try {
    const { tracks, fromCache } = await searchSongs(parsed.data.q);
    // Enrich the top results with YT Data API metadata. Never breaks search:
    // on any enrichment failure this returns the original tracks unchanged.
    const enriched = await enrichSearchResults(tracks);
    const anyEnriched = enriched.some((t) => t.metadata !== undefined);
    return Response.json(
      { success: true, data: enriched },
      {
        headers: {
          "X-Cache": fromCache ? "HIT" : "MISS",
          "X-Enrichment": anyEnriched ? "youtube" : "skipped",
        },
      },
    );
  } catch {
    // Generic, internal-detail-free failure — never leak Piped instance URLs.
    return Response.json({ success: false, error: "Search unavailable" }, { status: 502 });
  }
}