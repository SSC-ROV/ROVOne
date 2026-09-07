import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { notifyDiscord } from "@/lib/notify";
import type { Cycle, CycleMemberRef } from "@/lib/types";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const rows = db
    .prepare(
      `SELECT c.*, a.display_name AS proposer_name, b.display_name AS decided_by_name
       FROM cycles c
       LEFT JOIN users a ON a.id = c.proposer_id
       LEFT JOIN users b ON b.id = c.decided_by
       ORDER BY CASE c.status
          WHEN 'active' THEN 0 WHEN 'pending_teacher' THEN 1 WHEN 'pending_leader' THEN 2
          WHEN 'completed' THEN 3 ELSE 4 END, c.end_date, c.id`
    )
    .all() as unknown as (Omit<Cycle, "members" | "task_total" | "task_done">)[];

  const memberRows = db
    .prepare(
      `SELECT cm.cycle_id, u.id, u.display_name
       FROM cycle_members cm JOIN users u ON u.id = cm.user_id
       ORDER BY u.id`
    )
    .all() as unknown as { cycle_id: number; id: number; display_name: string }[];
  const membersBy = new Map<number, CycleMemberRef[]>();
  for (const m of memberRows) {
    const arr = membersBy.get(m.cycle_id) ?? [];
    arr.push({ id: m.id, display_name: m.display_name });
    membersBy.set(m.cycle_id, arr);
  }

  const taskRows = db
    .prepare(
      `SELECT cycle_id, COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END), 0) AS done
       FROM tasks WHERE cycle_id IS NOT NULL GROUP BY cycle_id`
    )
    .all() as unknown as { cycle_id: number; total: number; done: number }[];
  const taskBy = new Map(taskRows.map((t) => [t.cycle_id, t]));

  const cycles: Cycle[] = rows.map((c) => ({
    ...c,
    members: membersBy.get(c.id) ?? [],
    task_total: taskBy.get(c.id)?.total ?? 0,
    task_done: taskBy.get(c.id)?.done ?? 0,
  }));
  return NextResponse.json({ cycles });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as {
    title?: string;
    description?: string;
    start_date?: string;
    end_date?: string;
    member_ids?: number[];
  } | null;
  const title = String(body?.title ?? "").trim();
  const start = String(body?.start_date ?? "");
  const end = String(body?.end_date ?? "");
  if (!title) return NextResponse.json({ error: "請填寫週期名稱" }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return NextResponse.json({ error: "請填寫開始與結束日期" }, { status: 400 });
  }
  if (end < start) {
    return NextResponse.json({ error: "結束日期不能早於開始日期" }, { status: 400 });
  }

  // 審批鏈：老師提案直接生效；隊長提案跳過隊長層級；成員提案送隊長審批
  const status =
    user.role === "teacher" ? "active" : isStaff(user.role) ? "pending_teacher" : "pending_leader";

  const info = db
    .prepare(
      "INSERT INTO cycles (title, description, start_date, end_date, status, proposer_id) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(title, String(body?.description ?? ""), start, end, status, user.id);
  const cycleId = info.lastInsertRowid as number;

  const ids = new Set<number>([user.id]);
  for (const id of body?.member_ids ?? []) {
    const n = Number(id);
    if (n && db.prepare("SELECT 1 FROM users WHERE id = ?").get(n)) ids.add(n);
  }
  const insMember = db.prepare(
    "INSERT OR IGNORE INTO cycle_members (cycle_id, user_id) VALUES (?, ?)"
  );
  for (const id of ids) insMember.run(cycleId, id);

  await notifyDiscord(
    `🚀 新開發週期提案：「${title}」（${start} ~ ${end}）— ${
      status === "active" ? "老師提案，直接生效" : status === "pending_teacher" ? "待老師審批" : "待隊長審批"
    }`
  );
  return NextResponse.json({ ok: true, id: cycleId });
}
