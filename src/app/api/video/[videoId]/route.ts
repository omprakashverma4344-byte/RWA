import { NextResponse } from "next/server";
import { resolveVideo } from "@/lib/data";
import { UpstreamBusyError } from "@/lib/upstream";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;
    const url = new URL(req.url);
    const courseId = url.searchParams.get("courseId") ?? "";
    const force = url.searchParams.get("force") === "1";
    if (!courseId)
      return NextResponse.json({ error: "courseId required" }, { status: 400 });

    const resolved = await resolveVideo(videoId, courseId, force);
    if (!resolved)
      return NextResponse.json({ error: "video not found" }, { status: 404 });

    let qualities: { quality: string; url: string }[] = [];
    try {
      qualities = resolved.qualities ? JSON.parse(resolved.qualities) : [];
    } catch {
      qualities = [];
    }
    return NextResponse.json({
      contentId: resolved.contentId,
      videoUrl: resolved.videoUrl,
      hlsUrl: resolved.hlsUrl,
      qualities,
    });
  } catch (e) {
    if (e instanceof UpstreamBusyError)
      return NextResponse.json(
        { error: "Servers are busy, retrying…" },
        { status: 503 }
      );
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 }
    );
  }
}
