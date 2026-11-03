import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getOrCreateIcalToken } from "@/lib/db";

/** Signed-in members get the calendar feed token so they can subscribe from the Calendar page. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  return NextResponse.json({ token: await getOrCreateIcalToken() });
}
