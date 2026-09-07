import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/pg";
import { getSessionUser } from "@/lib/auth";
import { getTaskWithItems } from "@/lib/db";
import { fmtDue, notifyDiscord } from "@/lib/notify";
import type { ChecklistItem, Task } from "@/lib/types";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const rows = await sql`
    SELECT t.*, u.display_name AS assignee_name
    FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
    ORDER BY t.id`;
  const items = await sql`
    SELECT * FROM checklist_items ORDER BY sort_order, id`;
  const byTask = new Map<number, ChecklistItem[]>();
  for (const it of items as unknown as ChecklistItem[]) {
    const arr = byTask.get(Number(it.task_id)) ?? [];
    arr.push(it);
    byTask.set(Number(it.task_id), arr);
  }
  const tasks: Task[] = (rows as unknown as Omit<Task, "items">[]).map((r) => ({
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
  const assigneeId = (body?.assignee_id as number) || null;
  const [task] = await sql`
    INSERT INTO tasks (title, description, status, priority, subteam, due_date, assignee_id, created_by, cycle_id)
    VALUES (${title}, ${String(body?.description ?? "")}, ${String(body?.status ?? "todo")},
            ${String(body?.priority ?? "medium")}, ${String(body?.subteam ?? "general")},
            ${(body?.due_date as string) || null}, ${assigneeId}, ${user.id},
            ${(body?.cycle_id as number) || null})
    RETURNING id`;
  const created = await getTaskWithItems(Number(task.id));
  if (created?.assignee_id && created.assignee_id !== user.id) {
    notifyDiscord(
      `📋 新任務指派給 ${created.assignee_name ?? "隊員"}：「${created.title}」${fmtDue(created.due_date)}`
    ).catch(() => {});
  }
  return NextResponse.json({ task: created });
}
