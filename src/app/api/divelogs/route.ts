import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import type { DiveLog } from "@/lib/types";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const logs = db
    .prepare(
      `SELECT d.*, u.display_name AS created_by_name
       FROM dive_logs d LEFT JOIN users u ON u.id = d.created_by
       ORDER BY d.date DESC, d.id DESC`
    )
    .all() as unknown as DiveLog[];
  return NextResponse.json({ logs });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const title = String(body?.title ?? "").trim();
  const date = String(body?.date ?? "");
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "請填寫日期與標題" }, { status: 400 });
  }
  db.prepare(
    "INSERT INTO dive_logs (date, title, participants, tested, issues, fixes, next_steps, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    date,
    title,
    String(body?.participants ?? ""),
    String(body?.tested ?? ""),
    String(body?.issues ?? ""),
    String(body?.fixes ?? ""),
    String(body?.next_steps ?? ""),
    user.id
  );
  return NextResponse.json({ ok: true });
}
