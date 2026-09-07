import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/pg";
import { getSessionUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { getEvents } from "@/lib/db";
import { notifyDiscord } from "@/lib/notify";
import type { TeamEvent } from "@/lib/types";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  return NextResponse.json({ events: await getEvents() });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (!isStaff(user.role)) {
    return NextResponse.json({ error: "只有隊長或老師可以建立活動" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as {
    title?: string;
    type?: string;
    date?: string;
    time?: string;
    location?: string;
    notes?: string;
    subteam?: string;
  } | null;
  const title = String(body?.title ?? "").trim();
  const date = String(body?.date ?? "");
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "請填寫標題與日期" }, { status: 400 });
  }
  const [event] = await sql`
    INSERT INTO events (title, type, date, time, location, notes, subteam, created_by)
    VALUES (${title}, ${String(body?.type ?? "other")}, ${date},
            ${body?.time ? String(body.time) : null}, ${String(body?.location ?? "")},
            ${String(body?.notes ?? "")}, ${body?.subteam ? String(body.subteam) : null}, ${user.id})
    RETURNING *`;
  notifyDiscord(`📅 新活動：「${title}」@ ${date}${body?.time ? " " + body.time : ""}`).catch(() => {});
  return NextResponse.json({ event });
}
