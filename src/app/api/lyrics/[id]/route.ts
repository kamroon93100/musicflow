import { type NextRequest } from "next/server";
import { z } from "zod";
import { getLyrics } from "@/lib/api/lrclib";

// YouTube video IDs are 11 chars of [A-Za-z0-9_-] (matches stream route).
const idSchema = z.string().regex(/^[A-Za-z0-9_-]{11}$/, "Invalid video ID");

const querySchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Title is too long"),
  artist: z.string().trim().max(200, "Artist is too long").optional(),
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

  try {
    const { data, fromCache } = await getLyrics(
      parsedId.data,
      parsed.data.title,
      parsed.data.artist ?? null,
    );
    return Response.json(
      { success: true, data },
      { headers: { "X-Cache": fromCache ? "HIT" : "MISS" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch lyrics";
    return Response.json({ success: false, error: message }, { status: 502 });
  }
}