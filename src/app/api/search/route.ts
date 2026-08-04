import { type NextRequest } from "next/server";
import { z } from "zod";
import { searchSongs } from "@/lib/api/piped";

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
    return Response.json(
      { success: true, data: tracks },
      { headers: { "X-Cache": fromCache ? "HIT" : "MISS" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    return Response.json({ success: false, error: message }, { status: 502 });
  }
}