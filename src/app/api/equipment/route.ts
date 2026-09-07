import { isStaff } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import type { Equipment } from "@/lib/types";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const equipment = db
    .prepare(
      `SELECT e.*, u.display_name AS borrower_name
       FROM equipment e LEFT JOIN users u ON u.id = e.borrower_id
       ORDER BY e.category, e.id`
    )
    .all() as unknown as Equipment[];
  return NextResponse.json({ equipment });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (!isStaff(user.role)) {
    return NextResponse.json({ error: "只有隊長可以新增設備" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as {
    name?: string;
    category?: string;
    note?: string;
  } | null;
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "請填寫設備名稱" }, { status: 400 });
  db.prepare(
    "INSERT INTO equipment (name, category, note) VALUES (?, ?, ?)"
  ).run(name, String(body?.category ?? "其他"), String(body?.note ?? ""));
  return NextResponse.json({ ok: true });
}
