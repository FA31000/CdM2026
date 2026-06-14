import { NextResponse } from "next/server";
import { fetchEvents } from "@/lib/espn";
import { computeProjection } from "@/lib/projection";

export const revalidate = 120;

export async function GET() {
  try {
    const events = await fetchEvents();
    const projection = computeProjection(events);
    return NextResponse.json(projection);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
