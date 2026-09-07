import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/pg";
import { getSessionUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import type { MissionTask } from "@/lib/types";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const missions = await sql`
    SELECT m.*, COUNT(t.id)::int AS task_total,
      COALESCE(SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END), 0)::int AS task_done
    FROM mission_tasks m LEFT JOIN tasks t ON t.mission_id = m.id
    GROUP BY m.id
    ORDER BY m.sort_order, m.id`;
  return NextResponse.json({ missions });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (!isStaff(user.role)) {
    return NextResponse.json({ error: "只有隊長或老師可以管理比賽任務" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as {
    title?: string;
    description?: string;
    points?: number;
  } | null;
  const title = String(body?.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "請填寫任務名稱" }, { status: 400 });
  await sql`
    INSERT INTO mission_tasks (title, description, points, sort_order)
    VALUES (${title}, ${String(body?.description ?? "")}, ${body?.points ? Number(body.points) : null}, ${Date.now()})`;
  return NextResponse.json({ ok: true });
}
