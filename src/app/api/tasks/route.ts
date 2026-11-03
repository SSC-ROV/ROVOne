import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/pg";
import { getSessionUser } from "@/lib/auth";
import { getTaskWithItems, parseAssigneeIds, saveAssignees, withAssignees } from "@/lib/db";
import { fmtDue, notifyDiscord } from "@/lib/notify";
import type { ChecklistItem, Task } from "@/lib/types";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const rows = await sql`
    SELECT t.*, u.display_name AS assignee_name
    FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
    ORDER BY t.sort_order, t.id`;
  const items = await sql`
    SELECT * FROM checklist_items ORDER BY sort_order, id`;
  const byTask = new Map<number, ChecklistItem[]>();
  for (const it of items as unknown as ChecklistItem[]) {
    const arr = byTask.get(Number(it.task_id)) ?? [];
    arr.push(it);
    byTask.set(Number(it.task_id), arr);
  }
  const people = await withAssignees(rows as unknown as Record<string, unknown>[]);
  const tasks: Task[] = (people as unknown as Omit<Task, "items">[]).map((r) => ({
    ...r,
    items: byTask.get(r.id) ?? [],
  }));
  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const title = String(body?.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "請填寫任務標題" }, { status: 400 });
  }
  const assigneeIds = Array.isArray(body?.assignee_ids)
    ? parseAssigneeIds(body?.assignee_ids)
    : body?.assignee_id ? parseAssigneeIds([body.assignee_id]) : [];
  const assigneeId = assigneeIds[0] ?? null;
  const cycleId = (body?.cycle_id as number) || null;
  if (!cycleId) {
    return NextResponse.json({ error: "任務必須歸屬一個專案" }, { status: 400 });
  }
  const [cycle] = await sql`
    SELECT status FROM cycles WHERE id = ${cycleId}`;
  if (!cycle) return NextResponse.json({ error: "專案不存在" }, { status: 400 });
  if (["completed", "rejected"].includes(String(cycle.status))) {
    return NextResponse.json({ error: "該專案已完成或已駁回，無法加入任務" }, { status: 400 });
  }
  const [task] = await sql`
    INSERT INTO tasks (title, description, status, priority, subteam, due_date, assignee_id, created_by, cycle_id)
    VALUES (${title}, ${String(body?.description ?? "")}, ${String(body?.status ?? "todo")},
            ${String(body?.priority ?? "medium")}, ${String(body?.subteam ?? "general")},
            ${(body?.due_date as string) || null}, ${assigneeId}, ${user.id},
            ${cycleId})
    RETURNING id`;
  if (assigneeIds.length > 1) await saveAssignees(Number(task.id), assigneeIds);
  else if (assigneeId) {
    try {
      await sql`UPDATE tasks SET assignee_ids = ARRAY[${assigneeId}]::int[] WHERE id = ${Number(task.id)}`;
    } catch {
      /* multi-assignee migration not run yet */
    }
  }
  if (body?.start_date) await sql`UPDATE tasks SET start_date = ${String(body.start_date)} WHERE id = ${Number(task.id)}`;
  const created = await getTaskWithItems(Number(task.id));
  const others = (created?.assignees ?? []).filter((person) => person.id !== user.id);
  if (created && others.length) {
    notifyDiscord(
      `📋 新任務指派給 ${others.map((person) => person.display_name).join("、")}：「${created.title}」${fmtDue(created.due_date)}`
    ).catch(() => {});
  }
  return NextResponse.json({ task: created });
}
