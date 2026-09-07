import { isStaff } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";
import db, { getEvents } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import type { TeamEvent } from "@/lib/types";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  return NextResponse.json({ events: getEvents() });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (!isStaff(user.role)) {
    return NextResponse.json(
      { error: "只有隊長可以建立活動" },
      { status: 403 }
    );
  }
  const body = (await req.json().catch(() => null)) as {
    title?: string;
    type?: string;
    date?: string;
    time?: string;
    location?: string;
    notes?: string;
  } | null;
  const title = String(body?.title ?? "").trim();
  const date = String(body?.date ?? "");
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "請填寫標題與日期" }, { status: 400 });
  }
  const info = db
    .prepare(
      "INSERT INTO events (title, type, date, time, location, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      title,
      String(body?.type ?? "other"),
      date,
      body?.time ? String(body.time) : null,
      String(body?.location ?? ""),
      String(body?.notes ?? ""),
      user.id
    );
  const event = db
    .prepare("SELECT * FROM events WHERE id = ?")
    .get(info.lastInsertRowid) as unknown as TeamEvent;
  return NextResponse.json({ event });
}
