import { NextResponse } from "next/server";
import { fetchEvents } from "@/lib/espn";
import { computeStandings } from "@/lib/standings";

export const revalidate = 120;

export async function GET() {
  try {
    const events = await fetchEvents();
    const standings = computeStandings(events);
    return NextResponse.json(standings);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
