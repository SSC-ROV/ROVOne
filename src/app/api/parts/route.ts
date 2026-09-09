import crypto from "crypto";
import { NextRequest, NextResponse, after } from "next/server";
import { sql } from "@/lib/pg";
import { getSessionUser } from "@/lib/auth";
import { notifyTeams } from "@/lib/notify";
import type { Part } from "@/lib/types";

// after() 背景通知要等 Power Automate 冷啟動，需要更長的函數壽命
export const maxDuration = 60;

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const parts = await sql`
    SELECT p.*, u.display_name AS requested_by_name
    FROM parts p LEFT JOIN users u ON u.id = p.requested_by
    ORDER BY p.created_at DESC, p.id DESC`;
  return NextResponse.json({ parts });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "請填寫零件名稱" }, { status: 400 });
  const token = randomToken();
  await sql`
    INSERT INTO parts (name, spec, link, qty, unit, est_price, purpose, subteam, status, requested_by, approve_token, approve_expires_at)
    VALUES (${name}, ${String(body?.spec ?? "")}, ${String(body?.link ?? "")},
            ${Math.max(1, Number(body?.qty) || 1)}, ${String(body?.unit ?? "個")},
            ${Math.max(0, Number(body?.est_price) || 0)}, ${String(body?.purpose ?? "")},
            ${String(body?.subteam ?? "general")}, 'pending', ${user.id}, ${token},
            now() + interval '72 hours')`;
  const origin = req.nextUrl.origin;
  after(() => notifyTeams("teacher_parts",
    `🛒 新零件申請「${name}」待批准`,
    `申請人：${user.display_name}｜數量：${Math.max(1, Number(body?.qty) || 1)}｜預估：$${Math.max(0, Number(body?.est_price) || 0)}`,
    `${origin}/approve/${token}`));
  return NextResponse.json({ ok: true });
}

function randomToken() {
  return crypto.randomUUID().replace(/-/g, "");
}
