import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/pg";
import { getSessionUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { notifyTeams } from "@/lib/notify";
import type { Cycle, CycleMemberRef } from "@/lib/types";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  // 已核准的週期到了開始日期 → 自動轉為進行中（香港時區）
  await sql`
    UPDATE cycles SET status = 'active'
    WHERE status = 'approved' AND start_date <= ((now() AT TIME ZONE 'Asia/Hong_Kong')::date)::text`;

  const rows = await sql`
    SELECT c.*, a.display_name AS proposer_name, b.display_name AS decided_by_name
    FROM cycles c
    LEFT JOIN users a ON a.id = c.proposer_id
    LEFT JOIN users b ON b.id = c.decided_by
    ORDER BY CASE c.status
       WHEN 'active' THEN 0 WHEN 'pending_teacher' THEN 1 WHEN 'pending_leader' THEN 2
       WHEN 'approved' THEN 3 WHEN 'late' THEN 4 WHEN 'completed' THEN 5 ELSE 6 END, c.end_date, c.id`;

  const memberRows = await sql`
    SELECT cm.cycle_id, u.id, u.display_name
    FROM cycle_members cm JOIN users u ON u.id = cm.user_id
    ORDER BY u.id`;
  const membersBy = new Map<number, CycleMemberRef[]>();
  for (const m of memberRows as unknown as { cycle_id: number; id: number; display_name: string }[]) {
    const arr = membersBy.get(Number(m.cycle_id)) ?? [];
    arr.push({ id: Number(m.id), display_name: m.display_name });
    membersBy.set(Number(m.cycle_id), arr);
  }

  const taskRows = await sql`
    SELECT cycle_id, COUNT(*)::int AS total,
      COALESCE(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END), 0)::int AS done
    FROM tasks WHERE cycle_id IS NOT NULL GROUP BY cycle_id`;
  const taskBy = new Map(
    (taskRows as unknown as { cycle_id: number; total: number; done: number }[]).map((t) => [
      Number(t.cycle_id),
      t,
    ])
  );

  const cycles: Cycle[] = (rows as unknown as Omit<Cycle, "members" | "task_total" | "task_done">[]).map(
    (c) => ({
      ...c,
      id: Number(c.id),
      members: membersBy.get(Number(c.id)) ?? [],
      task_total: taskBy.get(Number(c.id))?.total ?? 0,
      task_done: taskBy.get(Number(c.id))?.done ?? 0,
    })
  );
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
    user.role === "teacher" ? "approved" : isStaff(user.role) ? "pending_teacher" : "pending_leader";

  const [created] = await sql`
    INSERT INTO cycles (title, description, start_date, end_date, status, proposer_id)
    VALUES (${title}, ${String(body?.description ?? "")}, ${start}, ${end}, ${status}, ${user.id})
    RETURNING id`;
  const cycleId = Number(created.id);

  const ids = new Set<number>([user.id]);
  for (const id of body?.member_ids ?? []) {
    const n = Number(id);
    if (n && (await sql`SELECT 1 FROM users WHERE id = ${n}`).length) ids.add(n);
  }
  for (const id of ids) {
    await sql`INSERT INTO cycle_members (cycle_id, user_id) VALUES (${cycleId}, ${id}) ON CONFLICT DO NOTHING`;
  }

  const origin = req.nextUrl.origin;
  if (status === "pending_leader") {
    await notifyTeams("leader_cycle",
      `📋 新週期提案「${title}」待隊長批准`,
      `提案人：${user.display_name}｜期間：${start} ~ ${end}`,
      `${origin}/cycles`);
  } else if (status === "pending_teacher") {
    await notifyTeams("teacher_cycle",
      `📋 新週期提案「${title}」待老師批准`,
      `提案人：${user.display_name}｜期間：${start} ~ ${end}`,
      `${origin}/cycles`);
  }

  return NextResponse.json({ ok: true, id: cycleId });
}
