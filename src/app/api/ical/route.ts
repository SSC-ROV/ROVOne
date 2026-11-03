import { NextRequest, NextResponse } from "next/server";
import { buildIcs } from "@/lib/ical";
import { getOrCreateIcalToken } from "@/lib/db";

/** iCal 訂閱端點：用手機 / 電腦日曆 App 訂閱，免登入（token 即授權） */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!token || token !== (await getOrCreateIcalToken())) {
    return NextResponse.json({ error: "訂閱連結不正確" }, { status: 403 });
  }
  // ?subteam=<key> limits the feed to one subteam (plus team-wide items); omit for the full calendar.
  const { body } = await buildIcs(req.nextUrl.searchParams.get("subteam"));
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
