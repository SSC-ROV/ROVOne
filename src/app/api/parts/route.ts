import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { randomBytes } from "crypto";
import type { Part } from "@/lib/types";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const parts = db
    .prepare(
      `SELECT p.*, u.display_name AS requested_by_name
       FROM parts p LEFT JOIN users u ON u.id = p.requested_by
       ORDER BY p.created_at DESC, p.id DESC`
    )
    .all() as unknown as Part[];
  return NextResponse.json({ parts });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "請填寫零件名稱" }, { status: 400 });
  db.prepare(
    `INSERT INTO parts (name, spec, link, qty, unit, est_price, purpose, subteam, status, requested_by, approve_token)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
  ).run(
    name,
    String(body?.spec ?? ""),
    String(body?.link ?? ""),
    Math.max(1, Number(body?.qty) || 1),
    String(body?.unit ?? "個"),
    Math.max(0, Number(body?.est_price) || 0),
    String(body?.purpose ?? ""),
    String(body?.subteam ?? "general"),
    user.id,
    randomBytes(16).toString("hex")
  );
  return NextResponse.json({ ok: true });
}
