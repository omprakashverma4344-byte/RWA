import { NextResponse } from "next/server";
import { getTopics } from "@/lib/data";
import { UpstreamBusyError } from "@/lib/upstream";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; sid: string }> }
) {
  try {
    const { id, sid } = await params;
    const topics = await getTopics(id, sid);
    return NextResponse.json(
      topics.map((t) => ({
        topicId: t.topicId,
        topicName: t.topicName,
        topicLogo: t.topicLogo,
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
