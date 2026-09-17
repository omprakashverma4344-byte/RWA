import { NextResponse } from "next/server";
import { getContent } from "@/lib/data";
import { UpstreamBusyError } from "@/lib/upstream";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  {
    params,
  }: { params: Promise<{ id: string; sid: string; tid: string }> }
) {
  try {
    const { id, sid, tid } = await params;
    const items = await getContent(id, sid, tid);
    return NextResponse.json(
      items.map((c) => ({
        id: c.id,
        contentId: c.contentId,
        courseId: c.courseId,
        subjectId: c.subjectId,
        topicId: c.topicId,
        title: c.title,
        materialType: c.materialType,
        thumbnail: c.thumbnail,
        dateAndTime: c.dateAndTime,
        strtotime: c.strtotime,
        duration: c.duration,
        liveStatus: c.liveStatus,
        embedUrl: c.embedUrl,
      }))
    );
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
