import { z } from "zod";
import { getStreamUrl } from "@/lib/api/piped";

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
    const stream = await getStreamUrl(parsed.data);
    return Response.json({ success: true, data: stream });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch stream";
    return Response.json({ success: false, error: message }, { status: 502 });
  }
}