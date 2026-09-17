import { NextResponse } from "next/server";
import { getStatus, startCrawl } from "@/lib/crawler";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getStatus());
}

export async function POST() {
  const status = startCrawl();
  return NextResponse.json(status);
}
