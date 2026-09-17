import { NextResponse } from "next/server";
import { getSubjects } from "@/lib/data";
import { UpstreamBusyError } from "@/lib/upstream";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const subjects = await getSubjects(id);
    return NextResponse.json(
      subjects.map((s) => ({
        subjectId: s.subjectId,
        subjectName: s.subjectName,
        subjectLogo: s.subjectLogo,
        isPaid: s.isPaid,
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
