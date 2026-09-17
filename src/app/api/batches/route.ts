import { NextResponse } from "next/server";
import { getBatches } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const batches = await getBatches();
    return NextResponse.json(batches);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 }
    );
  }
}
